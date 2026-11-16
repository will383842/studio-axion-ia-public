/**
 * Interrupteur YouTube (UO-12) : lit le réglage et l'état déjà enregistré. Aucun appel au diffuseur, aucune écriture.
 * Éteint par défaut ; non branché dans l'envoi (zone Zernio, fiche à part).
 */
import "server-only";
import { CLE_YOUTUBE_ACTIF, interrupteurAllume, verifierYoutubePret, youtubeEnvoiPermis, type VerificationYoutube } from "@/domaine/youtube-pret";
import type { IdReseau } from "@/domaine/types";
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import { lireParametre } from "./_commun";
import { canauxZernioEnregistres } from "./comptes-envoi-zernio";

/** Panne ou valeur autre que `true` = éteint. */
export async function lireYoutubeActif(): Promise<boolean> {
  try {
    return interrupteurAllume(await lireParametre<unknown>(CLE_YOUTUBE_ACTIF, false));
  } catch {
    return false;
  }
}

function priseEnCharge(): boolean {
  try {
    plateformeZernio("youtube");
    return true;
  } catch {
    return false;
  }
}

/** Comptes déjà gardés en base (dernier « Tester ») : aucun appel réseau. */
export async function verifierYoutubePretDepuisBase(): Promise<VerificationYoutube> {
  let chaine = false;
  try {
    const enregistres = await canauxZernioEnregistres();
    chaine = !!enregistres?.canaux?.some((c) => c.service === "youtube");
  } catch {
    chaine = false;
  }
  return verifierYoutubePret({ chaineRelieeChezDiffuseur: chaine, priseEnChargeParDiffuseur: priseEnCharge() });
}

export async function youtubeEnvoiPermisDepuisBase(reseau: IdReseau): Promise<boolean> {
  try {
    return youtubeEnvoiPermis(reseau, await lireYoutubeActif(), await verifierYoutubePretDepuisBase());
  } catch {
    return false;
  }
}
