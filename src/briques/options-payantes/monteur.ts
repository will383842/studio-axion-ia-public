/**
 * OPÉRATIONS PAYANTES DEMANDÉES AU MONTEUR (lot J). PUR.
 *
 * « Monteur, fais-le en 3 caméras », « change le décor : un bureau clair », « l'effet de main en ultra réaliste » :
 * une opération payante détectée n'est PAS exécutée ; le monteur répond dans le fil avec la carte de confirmation.
 * Une négation (« garde mon décor », « sans 3 caméras ») ne déclenche jamais rien.
 */
import { estDemandeEffetRealiste } from "@/briques/effet-realiste/demande";
import { estConsigneTroisCameras } from "@/briques/multicamera/consigne";
import type { IdOptionPayante } from "./types";

const normaliser = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-'’]/g, " ");

const NEGATION = /\b(pas|sans|garde|gardez|enleve|enlever|retire|retirer|arrete|plus de|aucun|aucune|jamais)\b/;

function demandeDecor(t: string): boolean {
  if (!/\b(decor|arriere plan)\b/.test(t)) return false;
  if (NEGATION.test(t)) return false;
  return /\b(change|changer|changez|remplace|remplacer|remplacez|mets|mettre|met|autre|nouveau|ia)\b/.test(t);
}

function demandeUltraRealiste(t: string): boolean {
  if (!/\bultra ?realist/.test(t) && !/\bhyper ?realist/.test(t)) return false;
  return !/\b(pas|sans)\b[^.]*\b(ultra|hyper)/.test(t);
}

/** Options payantes demandées dans ce message (face caméra : la multicaméra est celle du face caméra). */
export function optionsPayantesDemandees(message: string, format: "facecam" | "avocat" = "facecam"): IdOptionPayante[] {
  const t = normaliser(message);
  const ids: IdOptionPayante[] = [];
  if (demandeDecor(t)) ids.push("decor-ia");
  if (demandeUltraRealiste(t)) ids.push("effets-main-ultra");
  // Lot K : action libre et réaliste (« mets un téléphone dans ma main et jette-le sur l'écran ») ; « en 3D » reste gratuit.
  else if (estDemandeEffetRealiste(message)) ids.push("effet-realiste-ia");
  if (estConsigneTroisCameras(message)) ids.push(format === "avocat" ? "multicamera-avocat" : "multicamera-facecam");
  return ids;
}

export const REPONSE_MONTEUR_A_CONFIRMER = "C'est une option payante : je la fais seulement si vous confirmez. Sinon, la vidéo reste dans sa version gratuite.";
export const REPONSE_MONTEUR_PLAFOND = "Le plafond du mois est atteint : je ne peux pas faire cette option payante. La vidéo reste dans sa version gratuite.";
export const REPONSE_MONTEUR_CONFIRMEE = "Merci, c'est confirmé : une nouvelle version part avec l'option.";
export const REPONSE_MONTEUR_COUPEES = "Les options payantes sont coupées dans Réglages : je garde la version gratuite, rien n'est dépensé.";
export const REPONSE_MONTEUR_ANNULEE = "D'accord, pas d'option payante : la vidéo reste dans sa version gratuite.";
