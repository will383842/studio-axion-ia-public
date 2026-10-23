/**
 * BRIQUE MONTEUR — ENVELOPPE D'OPÉRATION envoyée à Claude (panne du 10/10). PUR, importable partout.
 *
 * Panne : « The compiled grammar is too large » sur « Monteur · discussion » et « Monteur · relecture des images ».
 * Le vocabulaire du face caméra (≈ 20 types d'opérations, chacun avec ses champs, ses listes et ses champs
 * facultatifs) partait en UNE union stricte : la grammaire compilée par l'API grossit avec chaque branche et chaque
 * champ facultatif (la doc « Structured outputs » : chaque facultatif double à peu près une partie de l'espace
 * d'états). Elle a dépassé la limite interne, sans chiffre publié.
 *
 * Correctif : on envoie une ENVELOPPE fixe, `{ type: <liste des types>, parametres: "<objet JSON en texte>" }`, sans
 * union ni champ facultatif. Sa grammaire ne dépend plus de la taille du vocabulaire, seulement de la liste des noms.
 * Les champs de chaque type sont décrits dans la consigne (`signaturesOperations`, générées depuis les MÊMES schémas
 * zod). À la réception, `deplierOperation` remet l'opération à plat, puis le schéma zod STRICT de son type la valide
 * (avec les réparateurs du format). Ce qui reste invalide est écarté avec son motif.
 */
import { z } from "zod";

/** Enveloppe d'une opération telle que l'API la contraint (grammaire minimale). */
export function schemaEnveloppeOperation(types: readonly [string, ...string[]]) {
  return z.object({
    /** Nom de l'opération (liste fermée du vocabulaire du format). */
    type: z.enum(types),
    /** Les AUTRES champs de l'opération, en un objet JSON écrit en texte (voir les signatures de la consigne). */
    parametres: z.string(),
  });
}

/** Phrase de consigne qui explique l'enveloppe (commune aux rôles du monteur). */
export const CONSIGNE_ENVELOPPE =
  "Format de chaque opération : { \"type\": nom de l'opération, \"parametres\": texte JSON d'UN objet avec TOUS les autres champs de cette opération, exactement comme dans sa signature ci-dessous } (exemple : {\"type\":\"zoom\",\"parametres\":\"{\\\"debutMot\\\":12,\\\"finMot\\\":14,\\\"style\\\":\\\"punch-in\\\",\\\"cible\\\":\\\"visage\\\"}\"}). Un champ « ou null » vaut null quand il ne sert pas ; aucun champ en plus.";

type Json = Record<string, unknown>;
const estObjet = (x: unknown): x is Json => !!x && typeof x === "object" && !Array.isArray(x);

/**
 * Remet une opération reçue à plat : `{ type, parametres: "<json>" }` → `{ ...json, type }`. Une opération déjà à
 * plat (simulation, ancienne forme) passe telle quelle. Ne lève jamais : un texte JSON illisible donne
 * `{ type, parametresIllisibles }` (le schéma strict l'écartera, avec un motif clair).
 */
export function deplierOperation(op: unknown): unknown {
  if (!estObjet(op) || !("parametres" in op)) return op;
  const { parametres, ...reste } = op;
  let champs: unknown = parametres;
  if (typeof parametres === "string") {
    try {
      champs = JSON.parse(parametres);
    } catch {
      return { ...reste, parametresIllisibles: parametres.slice(0, 80) };
    }
  }
  // Le `type` de l'enveloppe fait foi (un `type` répété dans les paramètres est ignoré).
  return estObjet(champs) ? { ...champs, ...reste } : { ...reste, parametresIllisibles: String(parametres).slice(0, 80) };
}

/* ------------------------------------------------------------------ */
/* Signatures lisibles (consigne), générées depuis les schémas zod      */
/* ------------------------------------------------------------------ */

function typeLisible(s: unknown): string {
  if (!estObjet(s)) return "valeur";
  const union = (s.anyOf ?? s.oneOf) as unknown;
  if (Array.isArray(union)) return union.map(typeLisible).join(" ou ");
  if ("const" in s) return JSON.stringify(s.const);
  if (Array.isArray(s.enum)) return s.enum.map((e) => JSON.stringify(e)).join("|");
  if (Array.isArray(s.type)) return s.type.map((t) => typeLisible({ ...s, type: t })).join(" ou ");
  switch (s.type) {
    case "null":
      return "null";
    case "integer":
      return "entier";
    case "number":
      return "nombre";
    case "boolean":
      return "booléen";
    case "string":
      return "texte";
    case "array":
      return `[${typeLisible(s.items)}]`;
    case "object":
      return signatureObjet(s);
    default:
      return "valeur";
  }
}

function signatureObjet(s: Json, sauf: string[] = []): string {
  const proprietes = estObjet(s.properties) ? s.properties : {};
  return `{ ${Object.entries(proprietes)
    .filter(([k]) => !sauf.includes(k))
    .map(([k, v]) => `${k}: ${typeLisible(v)}`)
    .join(", ")} }`;
}

/** Une ligne par opération : `- zoom : { debutMot: entier, finMot: entier, style: "punch-in"|"lent"|"flou", … }`. */
export function signaturesOperations(schemas: readonly z.ZodObject[]): string {
  return schemas
    .map((s) => {
      const json = z.toJSONSchema(s) as Json;
      const type = (s.shape.type as z.ZodLiteral<string>).value;
      return `- ${type} : ${signatureObjet(json, ["type"])}`;
    })
    .join("\n");
}
