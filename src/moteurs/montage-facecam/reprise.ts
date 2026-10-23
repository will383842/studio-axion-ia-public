/**
 * VÉRIF V5 (serveur) — un redémarrage de `studio-aligneur` n'est pas l'échec d'un travail. Règle écrite une seule fois,
 * pour la chaîne (`chaine.ts`) et les déclinaisons (`declinaisons.ts`) :
 *  - conteneur INJOIGNABLE (redémarrage, chargement des modèles, mise à jour) : le travail reste suivi tel quel, la
 *    soumission est retentée sous le même identifiant ; AUCUN essai n'est consommé pendant 30 min au plus. Au-delà,
 *    l'échec ordinaire (réessayable, 2 essais) reprend la main : jamais d'attente sans fin ;
 *  - travail INCONNU (404 : conteneur recréé sans ses travaux) : resoumis sous le MÊME identifiant, 3 fois au plus,
 *    sans consommer d'essai. Le conteneur reprend alors depuis ses tranches s'il les a gardées.
 * Avant (master 85655d2) : chaque tour sans réponse consommait un essai ; 3 tours (≈ 15 s) suffisaient à rater le son.
 */
import type { EtatTravailFacecam } from "@/fournisseurs/facecam/client";
import type { SuiviTravail } from "./chaine";

export const ATTENTE_INJOIGNABLE_MS = 30 * 60_000;
export const RELANCES_MEME_ID_MAX = 3;

/** Le suivi sans ses marques de reprise (le conteneur a répondu). */
export function sansReprise(t: SuiviTravail): SuiviTravail {
  const reste = { ...t };
  delete reste.injoignableDepuis;
  delete reste.memeId;
  return reste;
}

/**
 * Réponse d'un suivi qui ne doit consommer aucun essai : rend le nouveau suivi, ou `null` (traitement ordinaire).
 */
export function suiviSansEssai(t: SuiviTravail, r: EtatTravailFacecam, maintenant: number): SuiviTravail | null {
  if (r.statut !== "echec") return null;
  if (r.erreur.injoignable) {
    const depuis = t.injoignableDepuis ?? maintenant;
    return maintenant - depuis < ATTENTE_INJOIGNABLE_MS ? { ...t, injoignableDepuis: depuis } : null;
  }
  if (r.erreur.travailInconnu && (t.relances ?? 0) < RELANCES_MEME_ID_MAX) {
    return { ...sansReprise(t), statut: "echec", erreur: { code: r.erreur.code, message: r.erreur.message, reessayable: true }, memeId: true, relances: (t.relances ?? 0) + 1 };
  }
  return null;
}

/** Identifiant et essais de la prochaine soumission : le même travail quand la précédente n'a pas eu lieu. */
export function prochaineSoumission(precedent: SuiviTravail | undefined, nouvelId: (essais: number) => string): Pick<SuiviTravail, "id" | "essais" | "relances"> {
  if (precedent?.memeId) return { id: precedent.id, essais: precedent.essais, ...(precedent.relances ? { relances: precedent.relances } : {}) };
  const essais = (precedent?.essais ?? 0) + (precedent ? 1 : 0);
  return { id: nouvelId(precedent ? essais : 0), essais };
}

/** Suivi après une soumission : refusée faute de réponse → retentée plus tard sous le même identifiant (30 min au plus). */
export function apresSoumission(s: Pick<SuiviTravail, "id" | "essais" | "relances">, precedent: SuiviTravail | undefined, r: EtatTravailFacecam, maintenant: number): SuiviTravail {
  if (r.statut !== "echec") return { ...s, statut: "soumis", progression: 0 };
  if (r.erreur.injoignable) {
    const depuis = (precedent?.memeId ? precedent.injoignableDepuis : undefined) ?? maintenant;
    if (maintenant - depuis < ATTENTE_INJOIGNABLE_MS) return { ...s, statut: "echec", erreur: { code: r.erreur.code, message: r.erreur.message, reessayable: true }, memeId: true, injoignableDepuis: depuis };
  }
  return { ...s, statut: "echec", erreur: { code: r.erreur.code, message: r.erreur.message, reessayable: r.erreur.reessayable } };
}

/** Un travail à soumettre (à nouveau) : jamais soumis, échec réessayable avec un essai restant, ou soumission à refaire. */
export function aSoumettre(t: SuiviTravail | undefined, essaisMax: number): boolean {
  return !t || (t.statut === "echec" && !!t.erreur?.reessayable && (!!t.memeId || t.essais < essaisMax));
}
