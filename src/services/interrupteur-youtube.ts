/**
 * Prêt-à-allumer YouTube (UO-12) : lit l'interrupteur existant `zernio.youtube_actif` et l'état déjà enregistré.
 * Aucun appel au diffuseur, aucune écriture, aucun second interrupteur. Éteint par défaut ; non branché dans l'envoi.
 */
import "server-only";
import { RESEAUX_YOUTUBE, verifierYoutubePret, youtubeEnvoiPermis, type VerificationYoutube } from "@/domaine/youtube-pret";
import type { IdReseau } from "@/domaine/types";
import { CLE_YOUTUBE_ACTIF, youtubeActifBrut } from "@/fournisseurs/publication/zernio-youtube";
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import { lireParametre } from "./_commun";
import { canauxZernioEnregistres } from "./comptes-envoi-zernio";

/** Panne ou valeur autre que `true` = éteint (même clé et même règle que `youtubeZernioActif`). */
export async function lireYoutubeActif(): Promise<boolean> {
  try {
    return youtubeActifBrut(await lireParametre<unknown>(CLE_YOUTUBE_ACTIF, false));
  } catch {
    return false;
  }
}

/** Réseaux YouTube que le diffuseur accepte, testés un par un. */
function reseauxPrisEnCharge(): IdReseau[] {
  return RESEAUX_YOUTUBE.filter((r) => {
    try {
      plateformeZernio(r);
      return true;
    } catch {
      return false;
    }
  });
}

/** Comptes déjà gardés en base (dernier « Tester ») : aucun appel réseau. */
export async function verifierYoutubePretDepuisBase(reseau: IdReseau): Promise<VerificationYoutube> {
  let chaine = false;
  try {
    const enregistres = await canauxZernioEnregistres();
    chaine = !!enregistres?.canaux?.some((c) => c.service === "youtube");
  } catch {
    chaine = false;
  }
  return verifierYoutubePret({ chaineRelieeChezDiffuseur: chaine, reseauxPrisEnCharge: reseauxPrisEnCharge() }, reseau);
}

export async function youtubeEnvoiPermisDepuisBase(reseau: IdReseau): Promise<boolean> {
  try {
    return youtubeEnvoiPermis(reseau, await lireYoutubeActif(), await verifierYoutubePretDepuisBase(reseau));
  } catch {
    return false;
  }
}
