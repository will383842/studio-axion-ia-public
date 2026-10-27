/**
 * MODE « SCRIPT COMPLET » · bornes du script collé : fichier PUR et sans import (utilisable côté client, sans cycle avec
 * la fabrication). Même borne de caractères que le mode texte ; en plus, 300 mots au plus.
 */
export const SCRIPT_CARACTERES_MAX = 4000;
export const SCRIPT_MOTS_MAX = 300;
/** Six écrans au moins (les six parties du corps), donc six mots au moins. */
export const SCRIPT_MOTS_MIN = 6;

const mots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));

/** Nombre de mots d'un script (un signe isolé ne compte pas). */
export const nombreDeMotsDuScript = (t: string) => mots(t).length;

/** Refus du script avant tout prix et tout appel : une phrase simple, ou `null` si le script peut partir. */
export function refusScriptColle(script: unknown): { motif: "script-vide" | "script-trop-court" | "script-trop-long"; message: string } | null {
  const t = typeof script === "string" ? script.normalize("NFC").trim() : "";
  if (!t) return { motif: "script-vide", message: "Collez d'abord votre script complet." };
  if (t.length > SCRIPT_CARACTERES_MAX) return { motif: "script-trop-long", message: `Le script est trop long (plus de ${SCRIPT_CARACTERES_MAX} caractères) : gardez l'essentiel.` };
  const n = mots(t).length;
  if (n > SCRIPT_MOTS_MAX) return { motif: "script-trop-long", message: `Le script est trop long (${n} mots, ${SCRIPT_MOTS_MAX} au plus) : gardez l'essentiel.` };
  if (n < SCRIPT_MOTS_MIN) return { motif: "script-trop-court", message: `Le script est trop court (${SCRIPT_MOTS_MIN} mots au moins) : collez le texte complet que la voix doit dire.` };
  return null;
}
