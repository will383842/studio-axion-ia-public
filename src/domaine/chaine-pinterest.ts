/** Écran Pinterest (Réglages) : état des tableaux lu dans les canaux déjà enregistrés (pur, aucun réseau). */
import type { CanalPublication } from "@/fournisseurs/types";

export type EtatComptePinterest = { etat: "relie"; tableaux: number } | { etat: "deconnecte" } | { etat: "absent" } | { etat: "inconnu" };

/** Ce que la carte affiche : tout est lu en base, jamais calculé par un appel au service. */
export interface VuePinterest {
  actif: boolean;
  compte: EtatComptePinterest;
  /** Domaine exigé dans le lien des épingles (réglage `site.domaine`), en lecture seule ; vide = tout lien est refusé. */
  domaine: string;
  /** Le tour général du calendrier est-il ouvert à Pinterest ? Constante de code, ouverte : l'interrupteur reste la protection. */
  tourGeneral: boolean;
}

/** `brut` : le réglage `zernio.canaux` tel qu'enregistré. Aucun identifiant du fournisseur dans le résultat. Un canal Pinterest = un tableau public. */
export function etatComptePinterest(brut: unknown): EtatComptePinterest {
  if (!brut || typeof brut !== "object") return { etat: "inconnu" };
  const canaux = (brut as { canaux?: unknown }).canaux;
  if (!Array.isArray(canaux)) return { etat: "inconnu" };
  const pins = canaux.filter((c): c is CanalPublication => !!c && typeof c === "object" && (c as { service?: unknown }).service === "pinterest");
  if (pins.length === 0) return { etat: "absent" };
  const actifs = pins.filter((c) => c.deconnecte !== true);
  return actifs.length ? { etat: "relie", tableaux: actifs.length } : { etat: "deconnecte" };
}
