/** Écran YouTube Shorts : état de la chaîne lu dans les comptes déjà enregistrés (pur, aucun réseau). */
import type { ReglagesYoutube } from "@/fournisseurs/publication/zernio-youtube";

export type EtatChaineYoutube = { etat: "relie"; nom: string } | { etat: "absent" } | { etat: "inconnu" };

/** Ce que la carte affiche : lu en base, jamais calculé par un appel au service. */
export interface VueYoutube {
  actif: boolean;
  reglages: ReglagesYoutube | null;
  chaine: EtatChaineYoutube;
}

/** `brut` : le réglage `zernio.comptes` tel qu'enregistré. Jamais d'identifiant du fournisseur dans le résultat. */
export function etatChaineYoutube(brut: unknown): EtatChaineYoutube {
  if (!brut || typeof brut !== "object") return { etat: "inconnu" };
  const comptes = (brut as { comptes?: unknown }).comptes;
  if (!Array.isArray(comptes)) return { etat: "inconnu" };
  const yt = comptes.find((c): c is { reseau: string; nom?: unknown } => !!c && typeof c === "object" && (c as { reseau?: unknown }).reseau === "youtube");
  if (!yt) return { etat: "absent" };
  return { etat: "relie", nom: typeof yt.nom === "string" && yt.nom.trim() ? yt.nom : "YouTube" };
}
