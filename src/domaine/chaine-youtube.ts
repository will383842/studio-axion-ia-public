/** Écran YouTube Shorts : état de la chaîne lu dans les comptes déjà enregistrés (pur, aucun réseau). */
import type { ReglagesYoutube } from "@/fournisseurs/publication/zernio-youtube";

export type EtatChaineYoutube = { etat: "relie"; nom: string } | { etat: "deconnecte"; nom: string } | { etat: "absent" } | { etat: "inconnu" };

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
  // La publication choisit le compte par cible (une cible par chaîne) : plusieurs chaînes possibles, aucune « chaîne unique ».
  // On retient donc « au moins une chaîne active » : une chaîne déconnectée ne masque pas une chaîne reliée.
  const yts = comptes.filter((c): c is { reseau: string; nom?: unknown; actif?: unknown } => !!c && typeof c === "object" && (c as { reseau?: unknown }).reseau === "youtube");
  if (yts.length === 0) return { etat: "absent" };
  const nomDe = (c: { nom?: unknown }) => (typeof c.nom === "string" && c.nom.trim() ? c.nom : "YouTube");
  // `actif` absent (anciens enregistrements) = inconnu : on garde « relié » ; seul `false` dit « déconnecté ».
  const active = yts.find((c) => c.actif !== false);
  return active ? { etat: "relie", nom: nomDe(active) } : { etat: "deconnecte", nom: nomDe(yts[0]) };
}
