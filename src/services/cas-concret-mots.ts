/**
 * MOTS BRANCHÉS DU CAS CONCRET (X6) : le réglage du studio « par mot et par compte », sa lecture et l'avertissement
 * « une vidéo sur trois ».
 *
 * Le réglage vit dans les paramètres du studio (`PARAM_MOTS_BRANCHES`), vide aujourd'hui : rien n'est branché. Aucun
 * écran ne le pose encore : `poserBranchementMot` est la seule porte, appelée à la main sur signal de la session de
 * l'Usine, après un essai réussi de l'outil d'envoi (marche à suivre : `docs/formats/cas-concret.md`). Seuls Instagram
 * et Facebook peuvent être branchés.
 */
import "server-only";
import type { ReseauCas } from "@/formats/cas-concret";
import {
  avecBranchement,
  branchesDuReglage,
  comptesChargesEnMot,
  lecteurDuReglage,
  lireReglageMotsBranches,
  PARAM_MOTS_BRANCHES,
  type EtatMotsFeuille,
  type LecteurMotsBranches,
  type ReglageMotsBranches,
} from "@/formats/cas-concret/mots-branches";
import { lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { depots, ecrireParametre, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

const FORMAT_CAS_CONCRET_ID = "cas-concret";

export async function lireReglageMots(): Promise<ReglageMotsBranches> {
  return lireReglageMotsBranches(await lireParametre<unknown>(PARAM_MOTS_BRANCHES, null));
}

/** Le lecteur du réglage : `(mot, reseau) => branché ?`. Une liste lue chez l'Usine pourra le remplacer. */
export async function lecteurMotsBranches(): Promise<LecteurMotsBranches> {
  return lecteurDuReglage(await lireReglageMots());
}

/**
 * Pose l'état d'un mot sur un réseau, ou sur un compte précis du réseau (`compte`, identifiant public en minuscules ;
 * absent : tous les comptes). `branche` avec sa date, ou `non_branche`. Refuse TikTok et LinkedIn.
 */
export async function poserBranchementMot(mot: string, reseau: ReseauCas, etat: "branche" | "non_branche", le: string = new Date().toISOString(), compte?: string): Promise<ReglageMotsBranches> {
  await exigerSession();
  const suivant = avecBranchement(await lireReglageMots(), mot, reseau, { etat, le }, compte);
  await ecrireParametre(PARAM_MOTS_BRANCHES, suivant);
  await journaliser("reglages", `Cas concret MD : mot ${mot.trim().toUpperCase()} ${etat === "branche" ? "branché" : "débranché"} sur ${reseau}${compte ? ` (compte ${compte.trim().toLowerCase()})` : ""}`);
  return suivant;
}

/** Ce que la feuille « Votre vidéo » doit savoir des mots : où ils sont branchés, et les comptes trop chargés en mot. */
export async function etatMotsCasConcret(maintenant: number = Date.now()): Promise<EtatMotsFeuille> {
  const [reglage, videos] = await Promise.all([lireReglageMots(), depots().videos.lister((v) => v.formatId === FORMAT_CAS_CONCRET_ID && v.statut !== "archivee" && v.statut !== "brouillon")]);
  const vues = videos.map((v) => {
    const e = lireEntreesCasConcret(v.entrees);
    return { le: v.creeLe, reseaux: e.reseaux, motSur: e.avecMot ? e.motSur : [] };
  });
  return { branches: branchesDuReglage(reglage), charges: comptesChargesEnMot(vues, maintenant) };
}
