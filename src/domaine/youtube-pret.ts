/**
 * YouTube prêt (UO-12). PUR : aucun appel réseau, aucune base. Importable partout.
 * Pas d'interrupteur ici : l'unique interrupteur est `zernio.youtube_actif` (zernio-youtube.ts), ÉTEINT par défaut.
 */
import type { IdReseau } from "@/domaine/types";
import { RESEAUX, type DefinitionReseau } from "@/reseaux";

/** Réseaux concernés par l'interrupteur. */
export const RESEAUX_YOUTUBE: readonly IdReseau[] = ["youtube", "youtube-shorts"];

/** Ce que l'on sait de l'extérieur, déjà lu par ailleurs (le domaine ne lit rien lui-même). */
export interface EtatYoutube {
  /** Une chaîne YouTube est reliée chez le diffuseur (comptes lus au dernier « Tester »). */
  chaineRelieeChezDiffuseur: boolean;
  /** Réseaux YouTube que le diffuseur sait publier (YouTube Shorts oui, YouTube long non). */
  reseauxPrisEnCharge: readonly IdReseau[];
}

export interface VerificationYoutube {
  /** Vrai seulement si `manques` est vide. */
  pret: boolean;
  /** Ce qui manque, en français. */
  manques: string[];
}

function limitesValides(r: DefinitionReseau | undefined): boolean {
  return !!r && r.dureeMaxSec > 0 && r.legende.longueurMax > 0 && r.ratios.length > 0;
}

/** Dit, en français, ce qui manque encore pour CE réseau avant d'allumer YouTube. Sans appel réseau. */
export function verifierYoutubePret(etat: EtatYoutube, reseau: IdReseau, registre: readonly DefinitionReseau[] = RESEAUX): VerificationYoutube {
  const manques: string[] = [];
  if (!etat.chaineRelieeChezDiffuseur) manques.push("Aucune chaîne YouTube n'est reliée chez le diffuseur.");
  if (!etat.reseauxPrisEnCharge.includes(reseau)) manques.push(`Le diffuseur ne prend pas encore en charge le réseau ${reseau}.`);
  if (!limitesValides(registre.find((r) => r.id === reseau))) manques.push(`Les limites du réseau ${reseau} manquent ou sont invalides dans le registre des réseaux.`);
  return { pret: manques.length === 0, manques };
}

/** Envoi permis : interrupteur `zernio.youtube_actif` vrai ET liste vide, et seulement pour YouTube / YouTube Shorts. */
export function youtubeEnvoiPermis(reseau: IdReseau, reglageActif: boolean, verification: VerificationYoutube): boolean {
  if (!RESEAUX_YOUTUBE.includes(reseau)) return false;
  return reglageActif === true && verification.manques.length === 0;
}
