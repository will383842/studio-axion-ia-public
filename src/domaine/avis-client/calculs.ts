import { avisAffichables } from "./garde";
import type { AvisClient } from "./types";

/** Seuil du site (PR #1416) : en dessous, ni note globale ni compteur. */
export const SEUIL_AVIS = 5;

/** Nombre d'avis affichables (tous), ou `null` sous le seuil (jamais 0). */
export function compteurAvis(publies: AvisClient[]): number | null {
  const { gardes } = avisAffichables(publies);
  return gardes.length >= SEUIL_AVIS ? gardes.length : null;
}

/**
 * Moyenne sur TOUS les avis affichables, 1 décimale, tronquée (jamais arrondie
 * vers le haut par faveur). `null` sous le seuil (jamais 0).
 */
export function noteMoyenne(publies: AvisClient[]): number | null {
  const { gardes } = avisAffichables(publies);
  if (gardes.length < SEUIL_AVIS) return null;
  const somme = gardes.reduce((s, a) => s + a.note, 0);
  return Math.floor((somme * 10) / gardes.length) / 10;
}

/**
 * Avis désigné s'il est affichable, sinon le plus récent (à date égale, le
 * premier de la liste). Jamais choisi selon la note. Aucun avis → `null`.
 */
export function choisirAvisClient(publies: AvisClient[], options: { designe?: string } = {}): AvisClient | null {
  const { gardes } = avisAffichables(publies);
  if (gardes.length === 0) return null;
  if (options.designe !== undefined) {
    const d = gardes.find((a) => a.id === options.designe);
    if (d) return d;
  }
  let meilleur = gardes[0];
  for (const a of gardes) if (Date.parse(a.date) > Date.parse(meilleur.date)) meilleur = a;
  return meilleur;
}

const MOTIFS_CHIFFRES: Array<[RegExp, string]> = [
  [/\+\s*\d/, "chiffre « +N » non issu du calcul"],
  [/\d(?:[.,]\d+)?\s*\/\s*\d/, "note « N/5 » non issue du calcul"],
  [/\bnotes?\s+(?:moyenne\s+)?(?:de\s+)?\d/i, "« note de N » non issue du calcul"],
  [/\d(?:[.,]\d+)?\s*%/, "pourcentage non issu du calcul"],
];

/** Refuse les chiffres de réussite qui ne viennent pas du calcul (S7-03). */
export function texteChiffresHonnete(texte: string): { ok: boolean; motifs: string[] } {
  const motifs = MOTIFS_CHIFFRES.filter(([re]) => re.test(texte)).map(([, m]) => m);
  return { ok: motifs.length === 0, motifs };
}
