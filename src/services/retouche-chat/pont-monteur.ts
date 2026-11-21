/**
 * C7-11-a : pont du chat commun vers « Mon monteur » (face caméra classique). PUR, ports injectés, ÉTEINT, aucun importeur.
 * Transmet la phrase de Williams SEULE, en UN appel ; jamais de second rendu, aucun appel direct à Claude.
 */
import type { LireReglage } from "./generateurs";

export const CLE_REGLAGE_PONT_MONTEUR = "retoucheChat.facecamMonteur";
export const AVIS_COUT_MONTEUR = "Chaque message envoyé au monteur utilise votre crédit Claude.";
const MESSAGE_FIXE = "Le monteur n'a pas pu prendre ce message pour le moment.";

export type ResultatPont =
  | { statut: "eteint" | "hors-format" | "vide" }
  | { statut: "transmise"; reponse: unknown; avis: string }
  | { statut: "refusee"; message: string };

export interface DepsPontMonteur {
  lire: LireReglage;
  discuter: (videoId: string, texte: string) => Promise<unknown>;
  estFacecamClassique: (videoId: string) => Promise<boolean>;
}

const MONTANT = /\d[\d\s.,]*\s*[€$]/;

export async function transmettreAuMonteur(videoId: string, phrase: string, deps: DepsPontMonteur): Promise<ResultatPont> {
  try {
    if ((await deps.lire(CLE_REGLAGE_PONT_MONTEUR, false)) !== true) return { statut: "eteint" };
  } catch {
    return { statut: "eteint" };
  }
  try {
    if (!(await deps.estFacecamClassique(videoId))) return { statut: "hors-format" };
  } catch {
    return { statut: "hors-format" };
  }
  const texte = phrase.trim();
  if (!texte) return { statut: "vide" };
  try {
    const reponse = await deps.discuter(videoId, texte.slice(0, 1000));
    return { statut: "transmise", reponse, avis: AVIS_COUT_MONTEUR };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return { statut: "refusee", message: m && !MONTANT.test(m) ? m : MESSAGE_FIXE };
  }
}
