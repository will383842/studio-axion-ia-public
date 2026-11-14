/**
 * FAITS DU SCRIPT (GV2-42) : types purs. Aucune dépendance (ni Zod, ni React, ni Remotion, ni `@/`) :
 * la brique est importée côté rendu et côté studio.
 * Chaque fait porte les indices (inclus) des mots qui le portent et son `texte` : les mots dits, recollés, jamais reformulés.
 */

/** Même forme que `MotMinute` du plan de scènes, sans l'importer (pour rester sans Zod). */
export type MotFait = { texte: string; debutMs: number; finMs: number };

export type IntervalleMots = { premier: number; dernier: number };

/** Unités connues (normalisées), ou tout autre texte. */
export type UniteFait = "%" | "€" | "h" | "min" | "s" | "jours" | "semaines" | "mois" | "ans" | "clients" | "fois" | (string & {});

export type ValeurFait = { valeur: number; unite: UniteFait; surMot: number };
export type ElementFait = { texte: string; surMot: number };

type Base = { mots: IntervalleMots; texte: string };

export type Fait =
  | (Base & { type: "nombre"; valeur: number; unite?: UniteFait; surMot: number })
  | (Base & { type: "passage"; avant: ValeurFait; apres: ValeurFait })
  | (Base & { type: "liste"; annonce?: number; elements: ElementFait[] })
  | (Base & { type: "etapes"; elements: ElementFait[] })
  | (Base & { type: "comparaison"; gauche: ElementFait; droite: ElementFait })
  | (Base & { type: "citation"; surMot: number })
  | (Base & { type: "lieu"; nom: string; surMot: number })
  | (Base & { type: "duree"; valeur?: number; unite?: UniteFait; repere?: string; surMot: number })
  | (Base & { type: "question"; surMot: number });

export type FamilleUnite = "duree" | "pourcent" | "argent" | "clients" | "fois";

const FAMILLES: Record<string, FamilleUnite> = {
  h: "duree", min: "duree", s: "duree", jours: "duree", semaines: "duree", mois: "duree", ans: "duree",
  heures: "duree", minutes: "duree", secondes: "duree", jour: "duree", semaine: "duree", an: "duree",
  "%": "pourcent",
  "€": "argent",
  clients: "clients",
  fois: "fois",
};

/** Famille d'une unité normalisée (`h`, `min`, `%`, `€`…), ou `null` si inconnue. */
export function familleUnite(unite: string): FamilleUnite | null {
  return FAMILLES[unite.trim().toLowerCase()] ?? null;
}
