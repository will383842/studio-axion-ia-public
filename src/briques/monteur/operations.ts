/**
 * BRIQUE MONTEUR — schémas communs et LECTURE TOLÉRANTE de la réponse de l'agent monteur (mission H, extrait du lot D).
 * PUR, importable partout.
 *
 * Ce qui ne dépend d'aucun format :
 *  - `schemaConsigneLue` : ce que Claude a compris de chaque consigne (dite, écrite, fil) ;
 *  - `schemaReponsePour(op)` : la réponse d'UN appel (phrase à Will, opérations, consignes lues), pour le vocabulaire
 *    d'un format ;
 *  - `lireReponseOperations` : relecture opération par opération (une opération mal formée n'emporte pas les autres),
 *    avec des « réparateurs » propres au format (vocabulaire ouvert du face caméra, effets spéciaux…) ;
 *  - les opérations COMMUNES aux formats qui n'ont pas le vocabulaire complet du face caméra (avocat, formats futurs) :
 *    carte animée (modèles lus dans le catalogue de la brique `motion`, jamais en dur), zoom, titre, retrait, et la
 *    consigne « trois caméras » (brique `multicamera`).
 * Les opérations sont calées sur un MOT de la transcription (`debutMot`, `finMot` : index) : le code calcule les temps.
 */
import { z } from "zod";
import { CATALOGUE_ACTIF } from "@/briques/motion/pourFormat";

const mot = z.number().int();

/** Ce que Claude a compris d'une consigne (dite ou écrite). Même forme pour tous les formats (lot D). */
export const schemaConsigneLue = z.object({
  /** Identifiant de la consigne fournie, ou « fil » pour un message du fil de discussion. */
  consigneId: z.string(),
  comprise: z.boolean(),
  /** Ce que le monteur a fait, en une phrase simple (« Carte des 3 étapes à 0:32 »), ou pourquoi il n'a pas pu. */
  resume: z.string(),
  /** Index des opérations (dans `operations`) qui répondent à cette consigne. */
  operations: z.array(z.number().int()),
});
export type ConsigneLue = z.infer<typeof schemaConsigneLue>;

/** Identifiant de consigne d'un message du fil « Discuter avec mon monteur ». */
export const ID_FIL = "fil";

/** Réponse d'UN appel du monteur, pour le vocabulaire d'un format (sortie structurée). */
export function schemaReponsePour<T extends z.ZodTypeAny>(operation: T) {
  return z.object({
    /** Réponse à Will, en UNE phrase, vouvoiement, sans jargon. */
    reponse: z.string(),
    operations: z.array(operation),
    consignes: z.array(schemaConsigneLue),
  });
}

/* ------------------------------------------------------------------ */
/* Opérations communes (formats sans le vocabulaire face caméra)          */
/* ------------------------------------------------------------------ */

/** Modèles de cartes : ceux du catalogue ACTIF de la brique motion (6 aujourd'hui, 13 avec le lot F2). */
export function modelesCartes(): [string, ...string[]] {
  const ids = [...CATALOGUE_ACTIF.ids()];
  return (ids.length ? ids : ["liste"]) as [string, ...string[]];
}

export const schemaCarteCommune = z.object({
  type: z.literal("ajouterCarte"),
  debutMot: mot,
  finMot: mot,
  /** Modèle du catalogue de la brique motion. */
  modele: z.enum(modelesCartes()),
  /** Textes de la carte, dans l'ordre (convention `CONVENTION_TEXTES` de la brique motion). */
  textes: z.array(z.string()),
  /** Ce que montre la carte, en une phrase (lisible par Will). */
  description: z.string(),
});

export const schemaZoomCommun = z.object({
  type: z.literal("zoom"),
  debutMot: mot,
  finMot: mot,
  style: z.enum(["punch-in", "lent", "flou"]),
  cible: z.enum(["visage", "main"]),
});

export const schemaTitreCommun = z.object({
  type: z.literal("titre"),
  texte: z.string(),
  debutMot: mot.nullable(),
  finMot: mot.nullable(),
  pleinEcran: z.boolean(),
});

export const schemaRetirerCommun = z.object({
  type: z.literal("retirer"),
  passageId: z.string(),
});

/** « Monteur, fais-le en 3 caméras » (brique `multicamera`) : allume ou coupe la multicaméra de CETTE vidéo. */
export const schemaMulticamera = z.object({
  type: z.literal("multicamera"),
  actif: z.boolean(),
});

/* ------------------------------------------------------------------ */
/* Relecture tolérante                                                   */
/* ------------------------------------------------------------------ */

/** Un réparateur propre au format : rend une opération valide à partir d'une opération hors schéma, ou null. */
export type ReparateurOperation<O> = (brut: unknown) => O | null;

export interface LectureOperations<O> {
  reponse: string;
  operations: O[];
  consignes: ConsigneLue[];
  /** Opérations écartées (mal formées, rien pour les réparer), avec le motif. */
  ecartees: { index: number; motif: string }[];
}

/**
 * Relit une réponse BRUTE (JSON déjà parsé). Ne lève jamais. Chaque opération est validée seule ; une opération
 * invalide passe aux réparateurs du format, dans l'ordre ; sinon elle est écartée avec son motif. Les index des
 * consignes sont renumérotés sur la liste gardée ; une consigne « comprise » dont toutes les opérations ont été
 * écartées ne l'est plus. Même algorithme que le face caméra (lot D), pour tous les formats.
 */
export function lireReponseOperations<O>(brut: unknown, schema: z.ZodType<O>, reparateurs: readonly ReparateurOperation<O>[] = []): LectureOperations<O> | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as { reponse?: unknown; operations?: unknown; consignes?: unknown };
  const operations: O[] = [];
  const ecartees: LectureOperations<O>["ecartees"] = [];
  const renumero = new Map<number, number>();
  (Array.isArray(o.operations) ? o.operations : []).forEach((op, i) => {
    const r = schema.safeParse(op);
    if (r.success) {
      renumero.set(i, operations.length);
      operations.push(r.data);
      return;
    }
    for (const reparer of reparateurs) {
      const x = reparer(op);
      if (x) {
        renumero.set(i, operations.length);
        operations.push(x);
        return;
      }
    }
    ecartees.push({ index: i, motif: r.error.issues.map((x) => `${x.path.join(".") || "operation"}: ${x.message}`).join(" ; ").slice(0, 200) });
  });
  const consignes: ConsigneLue[] = [];
  for (const c of Array.isArray(o.consignes) ? o.consignes : []) {
    const r = schemaConsigneLue.safeParse(c);
    if (!r.success) continue;
    const ops = r.data.operations.map((i) => renumero.get(i)).filter((i): i is number => i !== undefined);
    const comprise = r.data.comprise && (ops.length > 0 || r.data.operations.length === 0);
    consignes.push({ ...r.data, operations: ops, comprise });
  }
  return { reponse: typeof o.reponse === "string" ? o.reponse.trim() : "", operations, consignes, ecartees };
}
