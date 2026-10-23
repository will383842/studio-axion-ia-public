/**
 * SCHÉMA ENVOYÉ À CLAUDE (sortie structurée) — complexité et aller-retour des champs facultatifs. PUR.
 *
 * Panne du 09/10 (après les lots J, K, L) : l'API refusait le monteur face caméra, « Schemas contains too many
 * parameters with union types (17/18 …, limit: 16) ». Chaque champ `.nullable()` de zod devient un `anyOf [X, null]`,
 * et l'API compte chaque propriété à union (`anyOf` ou `type` en tableau), toutes branches confondues.
 *
 * Correctif, GÉNÉRIQUE pour tous les rôles :
 *  - `sansNullables` (côté envoi) : une propriété `anyOf [X, null]` devient `X` et sort de `required` (champ ABSENT
 *    au lieu de null) ; l'union des opérations elle-même reste (une seule union, sur les éléments du tableau) ;
 *  - `restaurerNulls` (côté réception) : un champ absent que le schéma zod accepte à null (et pas absent) est remis
 *    à null AVANT la validation zod du rôle, qui reste exactement aussi stricte qu'avant.
 *  - `complexiteSchema` : les limites documentées de la sortie structurée (doc Anthropic « Structured outputs »,
 *    09/10) vérifiées hors ligne par le test anti-régression `tests/schemas-claude-limites.test.ts`.
 */
import type { z } from "zod";

/** Limites documentées (cumulées sur tous les schémas stricts d'UNE requête). */
export const LIMITES_SORTIE_STRUCTUREE = {
  /** Propriétés à `anyOf` ou `type` en tableau. */
  unions: 16,
  /** Propriétés absentes de `required`. */
  optionnels: 24,
} as const;
/** Marge visée par le studio (alerte du test au-delà). */
export const MARGES_SORTIE_STRUCTUREE = { unions: 12, optionnels: 20 } as const;

type Json = Record<string, unknown>;
const estObjet = (x: unknown): x is Json => !!x && typeof x === "object" && !Array.isArray(x);
const estNull = (x: unknown) => estObjet(x) && x.type === "null" && Object.keys(x).length === 1;

/** `anyOf [X, {type: null}]` → X ; `type: [t, "null"]` → t ; sinon null (pas un simple « nullable »). */
function sansNull(p: unknown): Json | null {
  if (!estObjet(p)) return null;
  const union = (p.anyOf ?? p.oneOf) as unknown;
  if (Array.isArray(union) && union.length === 2 && union.some(estNull)) {
    const autre = union.find((u) => !estNull(u));
    if (!estObjet(autre)) return null;
    const { anyOf: _a, oneOf: _o, ...reste } = p;
    void _a;
    void _o;
    return { ...reste, ...autre };
  }
  if (Array.isArray(p.type) && p.type.length === 2 && p.type.includes("null")) return { ...p, type: p.type.find((t) => t !== "null") };
  return null;
}

/** Remplace chaque propriété nullable par la même propriété, facultative (voir l'en-tête). */
export function sansNullables(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sansNullables);
  if (!estObjet(x)) return x;
  const o: Json = {};
  for (const [k, v] of Object.entries(x)) o[k] = k === "properties" ? v : sansNullables(v);
  if (estObjet(x.properties)) {
    const proprietes: Json = {};
    const facultatives = new Set<string>();
    for (const [k, v] of Object.entries(x.properties)) {
      const simple = sansNull(v);
      if (simple) facultatives.add(k);
      proprietes[k] = sansNullables(simple ?? v);
    }
    o.properties = proprietes;
    if (Array.isArray(x.required)) o.required = x.required.filter((k) => !facultatives.has(String(k)));
  }
  return o;
}

/* ------------------------------------------------------------------ */
/* Réception : champs absents → null                                   */
/* ------------------------------------------------------------------ */

interface DefZod {
  type: string;
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  options?: z.ZodType[];
  innerType?: z.ZodType;
  in?: z.ZodType;
  values?: unknown[];
}
const defDe = (s: z.ZodType) => (s as unknown as { _zod: { def: DefZod } })._zod.def;

/** Le champ accepte null mais pas l'absence : c'est un `.nullable()` envoyé comme facultatif. */
const nulAbsent = (s: z.ZodType) => s.safeParse(null).success && !s.safeParse(undefined).success;

/** Les littéraux d'une branche (ex. `type: "zoom"`) correspondent-ils à la valeur ? */
function brancheCorrespond(s: z.ZodType, v: Json): boolean {
  const d = defDe(s);
  if (d.type !== "object" || !d.shape) return false;
  return Object.entries(d.shape).every(([k, c]) => {
    const dc = defDe(c);
    return dc.type !== "literal" || (dc.values ?? []).includes(v[k]);
  });
}

/**
 * Remet à null les champs nullables ABSENTS d'une réponse (récursif : objets, tableaux, unions, enveloppes). Ne
 * retire ni ne modifie rien d'autre : la validation zod du rôle juge ensuite, aussi strictement qu'avant.
 */
export function restaurerNulls(schema: z.ZodType, valeur: unknown): unknown {
  const d = defDe(schema);
  switch (d.type) {
    case "nullable":
    case "optional":
    case "default":
    case "prefault":
    case "readonly":
    case "catch":
    case "nonoptional":
      return valeur === null || valeur === undefined || !d.innerType ? valeur : restaurerNulls(d.innerType, valeur);
    case "pipe":
      return d.in ? restaurerNulls(d.in, valeur) : valeur;
    case "array":
      return Array.isArray(valeur) && d.element ? valeur.map((e) => restaurerNulls(d.element!, e)) : valeur;
    case "object": {
      if (!estObjet(valeur) || !d.shape) return valeur;
      const o: Json = { ...valeur };
      for (const [k, champ] of Object.entries(d.shape)) {
        if (!(k in o)) {
          if (nulAbsent(champ)) o[k] = null;
        } else o[k] = restaurerNulls(champ, o[k]);
      }
      return o;
    }
    case "union": {
      if (!estObjet(valeur)) return valeur;
      const options = d.options ?? [];
      // La branche désignée par ses littéraux (`type`) ; à défaut, la première qui valide une fois complétée.
      const branche = options.find((s) => brancheCorrespond(s, valeur));
      if (branche) return restaurerNulls(branche, valeur);
      for (const s of options) {
        const c = restaurerNulls(s, valeur);
        if (s.safeParse(c).success) return c;
      }
      return valeur;
    }
    default:
      return valeur;
  }
}

/* ------------------------------------------------------------------ */
/* Complexité (limites documentées, vérifiables hors ligne)             */
/* ------------------------------------------------------------------ */

export interface ComplexiteSchema {
  /** Chemins des nœuds à union (`anyOf`, `oneOf`, `type` en tableau). Compte prudent : l'union des éléments d'un
   *  tableau (vocabulaire des opérations) compte aussi, alors que l'API ne compte que les propriétés. */
  unions: string[];
  /** Chemins des propriétés absentes de `required`. */
  optionnels: string[];
  /** Écarts aux règles « JSON Schema Limitations » (objets ouverts, contraintes refusées, récursion…). */
  problemes: string[];
}

const CLES_INTERDITES = ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "maxItems", "pattern", "uniqueItems", "contains", "minContains", "maxContains"];

export function complexiteSchema(racine: unknown): ComplexiteSchema {
  const r: ComplexiteSchema = { unions: [], optionnels: [], problemes: [] };
  const parcourir = (n: unknown, chemin: string) => {
    if (Array.isArray(n)) return n.forEach((x, i) => parcourir(x, `${chemin}[${i}]`));
    if (!estObjet(n)) return;
    if (n.anyOf || n.oneOf || Array.isArray(n.type)) r.unions.push(chemin || "(racine)");
    if (n.oneOf) r.problemes.push(`${chemin} : oneOf (utiliser anyOf)`);
    if (n.$ref === "#") r.problemes.push(`${chemin} : schéma récursif`);
    for (const c of CLES_INTERDITES) if (c in n) r.problemes.push(`${chemin} : « ${c} » refusé par la sortie structurée`);
    if (typeof n.minItems === "number" && n.minItems > 1) r.problemes.push(`${chemin} : minItems > 1`);
    if (n.type === "object" || estObjet(n.properties)) {
      if (n.additionalProperties !== false) r.problemes.push(`${chemin} : objet sans additionalProperties: false`);
      const requis = new Set(Array.isArray(n.required) ? n.required.map(String) : []);
      for (const k of Object.keys(estObjet(n.properties) ? n.properties : {})) if (!requis.has(k)) r.optionnels.push(`${chemin}.${k}`);
    }
    if (Array.isArray(n.enum) && n.enum.some((e) => e !== null && typeof e === "object")) r.problemes.push(`${chemin} : enum de types complexes`);
    for (const [k, v] of Object.entries(n)) {
      if (k === "properties" && estObjet(v)) for (const [p, s] of Object.entries(v)) parcourir(s, `${chemin}.${p}`);
      else if (typeof v === "object") parcourir(v, `${chemin}.${k}`);
    }
  };
  parcourir(racine, "");
  return r;
}

/* ------------------------------------------------------------------ */
/* Estimation hors ligne de la taille de la grammaire compilée          */
/* ------------------------------------------------------------------ */

/**
 * Panne du 10/10 : « The compiled grammar is too large ». La limite interne n'a pas de chiffre publié (doc
 * « Structured outputs » : unions et champs facultatifs coûtent le plus, chaque facultatif double à peu près une partie
 * de l'espace d'états ; les objets imbriqués aggravent). On mesure donc ce qui fait grossir la grammaire, et le test
 * anti-régression borne chaque mesure avec une marge (`SEUILS_GRAMMAIRE`).
 */
export interface EstimationGrammaire {
  /** Propriétés déclarées, à toutes les profondeurs et dans toutes les branches. */
  proprietes: number;
  /** Profondeur d'imbrication maximale (objets et tableaux). */
  profondeur: number;
  /** Branches d'union au total (somme des `anyOf`/`oneOf`, `type` en tableau). */
  branchesUnion: number;
  /** Listes fermées (`enum`) et valeurs fixes (`const`). */
  enums: number;
  /** Propriétés facultatives (absentes de `required`). */
  optionnels: number;
  /** Taille du schéma envoyé (JSON compact, en caractères). */
  tailleJson: number;
}

export const SEUILS_GRAMMAIRE: EstimationGrammaire = { proprietes: 60, profondeur: 6, branchesUnion: 8, enums: 16, optionnels: 12, tailleJson: 4000 };

export function estimationGrammaire(racine: unknown): EstimationGrammaire {
  const e: EstimationGrammaire = { proprietes: 0, profondeur: 0, branchesUnion: 0, enums: 0, optionnels: 0, tailleJson: JSON.stringify(racine ?? null).length };
  const parcourir = (n: unknown, prof: number) => {
    if (Array.isArray(n)) return n.forEach((x) => parcourir(x, prof));
    if (!estObjet(n)) return;
    const union = (n.anyOf ?? n.oneOf) as unknown;
    if (Array.isArray(union)) e.branchesUnion += union.length;
    if (Array.isArray(n.type)) e.branchesUnion += n.type.length;
    if (Array.isArray(n.enum) || "const" in n) e.enums++;
    const conteneur = n.type === "object" || n.type === "array" || estObjet(n.properties);
    const p = conteneur ? prof + 1 : prof;
    e.profondeur = Math.max(e.profondeur, p);
    if (estObjet(n.properties)) {
      const requis = new Set(Array.isArray(n.required) ? n.required.map(String) : []);
      for (const [k, v] of Object.entries(n.properties)) {
        e.proprietes++;
        if (!requis.has(k)) e.optionnels++;
        parcourir(v, p);
      }
    }
    for (const [k, v] of Object.entries(n)) if (k !== "properties" && typeof v === "object") parcourir(v, p);
  };
  parcourir(racine, 0);
  return e;
}
