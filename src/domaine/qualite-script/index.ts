/**
 * SOCLE QUALITÉ COMMUN DES SCRIPTS (plan socle qualité § 5, PR 2 + PR 3, étendues aux règles de Will). PUR.
 *
 * `evaluerQualite(script, recette)` mesure un script normalisé (adaptateur de l'écrivain) selon sa recette qualité.
 * MODE OBSERVATION : rien ne bloque, aucun verdict existant ne change ; les contrôles C, R, Q et la grille du tableau
 * restent seuls juges. Règles lisibles par Will : `docs/ecriture/REGLES-DE-WILL.md`.
 */
import { fonctionsMinimales, notesParTheme, pastillesQualite, voyantDe, type FonctionMinimale, type Voyant } from "./rapport";
import { reglesAccroche } from "./regles/accroche";
import { reglesForme } from "./regles/forme";
import { reglesInterdits } from "./regles/interdits";
import { reglesPositionnement } from "./regles/positionnement";
import { reglesProspects } from "./regles/prospects";
import { reglesRepetitions } from "./regles/repetitions";
import { reglesRetention } from "./regles/retention";
import { reglesValeur } from "./regles/valeur";
import { lire } from "./script";
import { seuilsDe } from "./seuils";
import type { Contexte, RecetteQualite, Regle, ResultatRegle, ScriptNormalise, Theme } from "./types";
import type { PastilleControle } from "@/domaine/relecture-script";

/** Le socle ne fait qu'observer : aucune règle ne bloque dans cette version. */
export const MODE_SOCLE = "observation" as const;

export const REGLES: readonly Regle[] = [reglesAccroche, reglesRetention, reglesValeur, reglesProspects, reglesPositionnement, reglesInterdits, reglesForme, reglesRepetitions];

export interface RapportQualite {
  mode: typeof MODE_SOCLE;
  recette: string;
  dureeSec: number;
  resultats: ResultatRegle[];
  notes: Record<Theme, number | null>;
  fonctions: Record<FonctionMinimale, boolean>;
  voyant: Voyant;
  pastilles: PastilleControle[];
}

export function evaluerQualite(script: ScriptNormalise, recette: RecetteQualite): RapportQualite {
  const lecture = lire(script, recette.debit);
  const c: Contexte = { script, recette, seuils: seuilsDe(recette), lecture };
  const resultats = REGLES.flatMap((r) => r(c));
  return {
    mode: MODE_SOCLE,
    recette: recette.id,
    dureeSec: +lecture.dureeSec.toFixed(1),
    resultats,
    notes: notesParTheme(resultats),
    fonctions: fonctionsMinimales(resultats),
    voyant: voyantDe(resultats),
    pastilles: pastillesQualite(resultats),
  };
}

export * from "./types";
export { FONCTIONS_MINIMALES, noteSur100, notesParTheme, pastillesQualite, resumeNotes, voyantDe } from "./rapport";
export { APPELS_PAR_RESEAU, CLASSES_DUREE, SEUILS_COMMUNS, SEUIL_THEME_AMBRE, SEUIL_THEME_ROUGE, classeDuree, seuilsDe } from "./seuils";
export { alertesRepetitions, garderSansNouvelleRepetition, trouverRepetitions } from "./repetitions";
export { LISTE_INTERDITS, interditsCommuns, interditsDans } from "./regles/interdits";
