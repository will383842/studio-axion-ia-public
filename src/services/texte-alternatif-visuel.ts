/**
 * L5-01 : contrôle du texte alternatif d'un visuel (PUR, aucun appel). La longueur maximale est lue dans le profil du
 * réseau (briques/visuels/reseaux) et ne dépasse jamais la valeur de référence du registre (ALT_MAX_REFERENCE).
 * Kit de textes : jamais « Qualiopi » ni « certifié » dans un texte alternatif.
 */
import { PROFILS_RESEAUX, type Reseau } from "@/briques/visuels/reseaux";
import { ALT_MAX_REFERENCE } from "@/reseaux";

export type ErreurTexteAlternatif = "alt-vide" | "alt-trop-long" | "alt-mot-interdit";

export type VerdictTexteAlternatif = { ok: true } | { ok: false; erreurs: ErreurTexteAlternatif[] };

const MOTS_INTERDITS = /qualiopi|certifi/i;

/** Pinterest : 500 signes (ADR-0015), la borne de référence des autres réseaux ne s'y applique pas. */
export const ALT_MAX_PINTEREST = 500;

export function longueurAltMax(reseau: Reseau | "pinterest"): number {
  if (reseau === "pinterest") return ALT_MAX_PINTEREST;
  return Math.min(PROFILS_RESEAUX[reseau].altMax, ALT_MAX_REFERENCE.valeur);
}

export function verifierTexteAlternatif(alt: string, reseau: Reseau | "pinterest"): VerdictTexteAlternatif {
  const erreurs: ErreurTexteAlternatif[] = [];
  const texte = alt.trim();
  if (texte.length === 0) erreurs.push("alt-vide");
  if ([...alt].length > longueurAltMax(reseau)) erreurs.push("alt-trop-long");
  if (MOTS_INTERDITS.test(alt)) erreurs.push("alt-mot-interdit");
  return erreurs.length ? { ok: false, erreurs } : { ok: true };
}
