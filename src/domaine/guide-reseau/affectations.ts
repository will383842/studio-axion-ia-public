// Affectation « mot → guide » par compte : PUR (aucune base). Données absentes ou vides = repli sur le comportement d'aujourd'hui.
import { normaliserMot } from "./mot-normalise";

export interface Affectation {
  mot: string;
  compte: string;
  guide: string;
  titre: string;
  versionGuide?: string;
  plafondJour: number;
}

export const MOT_PAR_DEFAUT = "GUIDE";
export const GUIDE_PAR_DEFAUT = "guide-ia";
/**
 * Plafond du repli : valeur FINIE (jamais Infinity, que JSON.stringify sérialiserait en null). 1 000 000 par jour = « non limité par
 * l'affectation » en pratique : les plafonds existants (par heure et par compte) restent seuls en vigueur.
 */
export const PLAFOND_JOUR_REPLI = 1_000_000;

/** Affectation du mot pour ce compte. `donnees` vide/absent → repli {GUIDE → guide-ia, titre fourni}. Autre mot sans donnée → null. */
export function affectationPour(mot: string, compte: string, donnees: readonly Affectation[] | null | undefined, titreRepli: string): Affectation | null {
  const m = normaliserMot(mot);
  if (m === null) return null;
  if (!donnees || donnees.length === 0) {
    return m === MOT_PAR_DEFAUT ? { mot: MOT_PAR_DEFAUT, compte, guide: GUIDE_PAR_DEFAUT, titre: titreRepli, plafondJour: PLAFOND_JOUR_REPLI } : null;
  }
  return donnees.find((a) => normaliserMot(a.mot) === m && a.compte === compte) ?? null;
}

/** Formes normalisées obtenues à partir d'au moins deux saisies DISTINCTES (une même saisie répétée n'est pas une collision). */
export function detecterCollision(saisies: readonly string[]): string[] {
  const n = new Map<string, number>();
  for (const s of new Set(saisies)) { const f = normaliserMot(s); if (f !== null) n.set(f, (n.get(f) ?? 0) + 1); }
  return [...n].filter(([, c]) => c > 1).map(([f]) => f);
}
