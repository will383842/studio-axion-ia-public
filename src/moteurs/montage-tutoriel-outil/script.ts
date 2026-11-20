/**
 * SCRIPT DU TUTORIEL D'OUTIL (lot I) : d'où vient le texte lu.
 *  1. script validé par Williams (après écriture) → tel quel ;
 *  2. script collé, ou texte de la commande sans idée → tel quel (le script de Williams fait foi) ;
 *  3. titre ou idée seuls → l'ÉQUIPE de rôles (T-EXT-55, `equipe/orchestre.ts`) écrit deux versions et la fabrication
 *     s'arrête pour le choix de Williams ; équipe éteinte : l'idée attend un script collé. Plus aucun autre écrivain :
 *     l'ancienne consigne de 3 lignes (`requeteScript`) est retirée.
 * Aucun refus : un script hors des durées conseillées passe, avec une remarque.
 */
import type { EntreesTutoriel } from "./entrees";

export const CODE_SCRIPT_A_VALIDER = "TO_SCRIPT_A_VALIDER";
export const PHRASE_SCRIPT_A_VALIDER = "Relisez le script, modifiez-le si besoin, puis validez : la vidéo se fabrique ensuite.";
export const CODE_SCRIPT_NON_ECRIT = "TO_SCRIPT_NON_ECRIT";
export const PHRASE_SCRIPT_NON_ECRIT = "Le script n'a pas pu être écrit pour l'instant : collez votre script, ou relancez plus tard. Rien n'a échoué.";

/** Mots par seconde de la voix (recette du format). */
export const MOTS_PAR_SECONDE = 2.6;

export type SourceScript = "valide" | "colle";

export type ScriptRetenu = { texte: string; source: SourceScript } | { aEcrire: string } | { vide: true };

/** Le script qui fait foi, ou l'idée à écrire. */
export function scriptRetenu(texteCommande: string | undefined, e: EntreesTutoriel): ScriptRetenu {
  if (e.scriptValide) return { texte: e.scriptValide, source: "valide" };
  const t = (texteCommande ?? "").trim();
  if (t && (e.scriptColle || !e.idee)) return { texte: t, source: "colle" };
  if (e.idee) return { aEcrire: e.idee };
  return { vide: true };
}

/** Remarques sur le script (jamais un refus) : durée estimée hors de la zone du format (30 à 75 s). */
export function remarquesScript(texte: string): string[] {
  const mots = texte.split(/\s+/).filter(Boolean).length;
  const sec = Math.round(mots / MOTS_PAR_SECONDE);
  if (sec < 30) return [`Script court (environ ${sec} s) : la vidéo sera brève.`];
  if (sec > 75) return [`Script long (environ ${sec} s) : au-delà de 75 s, l'attention baisse.`];
  return [];
}
