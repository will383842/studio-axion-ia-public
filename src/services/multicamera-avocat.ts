/**
 * SERVICE « MULTICAMÉRA » DU FORMAT AVOCAT (lot F4) — réglage caché et POINT D'INSERTION dans le montage.
 *
 * Réglage `avocat.multicamera` : absent de l'écran, COUPÉ par défaut. `passeMulticameraAvocat` est l'étape facultative
 * que le moteur avocat peut appeler après le découpage en plans, pour une vidéo faite d'une prise filmée de face :
 *  - option coupée (ni réglage, ni consigne « Monteur, fais-le en 3 caméras ») → `null`, aucun appel, montage inchangé ;
 *  - sinon les deux angles sont fabriqués et contrôlés (double de SIMULATION tant que `reel` est faux), puis la couche
 *    multicaméra est réalisée ; un angle en échec repart sur la face.
 * Aucun prix n'est affiché ici : un rendu réel passerait par le mécanisme existant de confirmation et de crédits.
 */
import "server-only";
import { pisteMulticameraAvocat, type EntreeMulticameraAvocat, type PisteMulticamera } from "@/briques/multicamera";
import { lireReglageMulticamera, multicameraDemandee, PARAM_MULTICAMERA_AVOCAT, type ReglageMulticameraAvocat } from "@/briques/multicamera/reglage";
import type { Ratio } from "@/domaine/types";
import type { AnalyseurAngle, OptionsSimulation } from "@/fournisseurs/multicamera";
import type { FournisseurVisage } from "@/fournisseurs/types";
import { ecrireParametre, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { fabriquerSourcesMulticamera } from "./multicamera";
import { optionDemandeePourTravail } from "./options-payantes";

export { PARAM_MULTICAMERA_AVOCAT };

export async function lireReglageMulticameraAvocat(): Promise<ReglageMulticameraAvocat> {
  return lireReglageMulticamera(await lireParametre<unknown>(PARAM_MULTICAMERA_AVOCAT, null));
}

export async function definirReglageMulticameraAvocat(changement: Partial<ReglageMulticameraAvocat>): Promise<ReglageMulticameraAvocat> {
  await exigerSession();
  const suivant = lireReglageMulticamera({ ...(await lireReglageMulticameraAvocat()), ...changement });
  await ecrireParametre(PARAM_MULTICAMERA_AVOCAT, suivant);
  await journaliser("reglages", suivant.actif ? "Avocat en 3 caméras activé" : "Avocat en 3 caméras désactivé");
  return suivant;
}

export interface DemandePasseMulticamera {
  travailId: string;
  /** Double HeyGen de la personne (ses looks par angle sont lus dans le réglage). */
  visageId: string;
  referenceLookId?: string;
  priseCle: string;
  audioCle: string;
  audioUrl?: string;
  dureePriseSec: number;
  ratio: Ratio;
  /** Consignes dites au Monteur pour cette vidéo (« Monteur, fais-le en 3 caméras »). */
  consignes?: string[];
  plans: EntreeMulticameraAvocat["plans"];
  mots: EntreeMulticameraAvocat["mots"];
  segments: EntreeMulticameraAvocat["segments"];
  /* --- Dépendances (tests, branchement réel) --- */
  reglage?: ReglageMulticameraAvocat;
  visage?: FournisseurVisage;
  analyseur?: AnalyseurAngle;
  simulation?: OptionsSimulation;
  attendre?: (ms: number) => Promise<void>;
}

export async function passeMulticameraAvocat(d: DemandePasseMulticamera): Promise<PisteMulticamera | null> {
  const reglage = d.reglage ?? (await lireReglageMulticameraAvocat());
  // Lot J : ou demandée pour CETTE version seulement (« Confirmer » sur la carte de l'option payante).
  if (!multicameraDemandee(reglage, d.consignes) && !(await optionDemandeePourTravail("multicamera-avocat", d.travailId))) return null;
  // Mission H : la fabrication des angles est commune à tous les formats (`services/multicamera.ts`).
  const fab = await fabriquerSourcesMulticamera(d, reglage);
  const piste = pisteMulticameraAvocat({ actif: true, plans: d.plans, mots: d.mots, segments: d.segments, sources: fab.sources, replis: fab.replis, dureeSec: d.dureePriseSec });
  return piste && fab.simulation ? { ...piste, simulation: true } : piste;
}
