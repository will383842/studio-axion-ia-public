/**
 * YouTube prêt et éteint (UO-12). PUR : aucun appel réseau, aucune base. Importable partout.
 * Le réglage `publication.youtube_actif` est ÉTEINT par défaut ; seul le fondateur le pose à vrai.
 */
import type { IdReseau } from "@/domaine/types";
import { RESEAUX, type DefinitionReseau } from "@/reseaux";

export const CLE_YOUTUBE_ACTIF = "publication.youtube_actif";

/** Réseaux concernés par l'interrupteur. */
export const RESEAUX_YOUTUBE: readonly IdReseau[] = ["youtube", "youtube-shorts"];

/** Ce que l'on sait de l'extérieur, déjà lu par ailleurs (le domaine ne lit rien lui-même). */
export interface EtatYoutube {
  /** Une chaîne YouTube est reliée chez le diffuseur (comptes lus au dernier « Tester »). */
  chaineRelieeChezDiffuseur: boolean;
  /** Le diffuseur sait publier sur YouTube. */
  priseEnChargeParDiffuseur: boolean;
}

export interface VerificationYoutube {
  /** Vrai seulement si `manques` est vide. */
  pret: boolean;
  /** Ce qui manque, en français. */
  manques: string[];
}

/** Le réglage ne vaut vrai que pour le booléen `true` : absent, illisible ou autre chose = éteint. */
export function interrupteurAllume(valeur: unknown): boolean {
  return valeur === true;
}

function limitesValides(r: DefinitionReseau | undefined): boolean {
  return !!r && r.dureeMaxSec > 0 && r.legende.longueurMax > 0 && r.ratios.length > 0;
}

/** Dit, en français, ce qui manque encore avant d'allumer YouTube. Sans appel réseau. */
export function verifierYoutubePret(etat: EtatYoutube, registre: readonly DefinitionReseau[] = RESEAUX): VerificationYoutube {
  const manques: string[] = [];
  if (!etat.chaineRelieeChezDiffuseur) manques.push("Aucune chaîne YouTube n'est reliée chez le diffuseur.");
  if (!etat.priseEnChargeParDiffuseur) manques.push("Le diffuseur ne prend pas encore YouTube en charge.");
  for (const id of RESEAUX_YOUTUBE) {
    if (!limitesValides(registre.find((r) => r.id === id))) manques.push(`Les limites du réseau ${id} manquent ou sont invalides dans le registre des réseaux.`);
  }
  return { pret: manques.length === 0, manques };
}

/** Envoi permis : réglage vrai ET liste vide, et seulement pour YouTube / YouTube Shorts. */
export function youtubeEnvoiPermis(reseau: IdReseau, reglageActif: boolean, verification: VerificationYoutube): boolean {
  if (!RESEAUX_YOUTUBE.includes(reseau)) return false;
  return reglageActif === true && verification.manques.length === 0;
}
