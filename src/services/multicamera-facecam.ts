/**
 * SERVICE « MULTICAMÉRA » DU FACE CAMÉRA (mission H) — même brique et même service que l'avocat.
 *
 * Réglage caché `facecam.multicamera` (coupé par défaut, `reel` faux par défaut). L'angle de face est la vraie vidéo
 * de Will (piste montée) ; les angles 2 et 3 sont fabriqués par son double HeyGen sur le même son. Option coupée (ni
 * réglage, ni consigne « Monteur, fais-le en 3 caméras ») : `null`, aucun appel, montage inchangé.
 */
import "server-only";
import { multicameraDemandee, pisteMulticameraFacecam, type PisteMulticamera } from "@/briques/multicamera";
import type { ReglageMulticameraAvocat } from "@/briques/multicamera/reglage";
import { fabriquerSourcesMulticamera, lireReglageMulticameraFormat, type DemandeSourcesMulticamera } from "./multicamera";
import { optionDemandeePourTravail } from "./options-payantes";

export interface DemandePasseMulticameraFacecam extends DemandeSourcesMulticamera {
  /** Mots de la vidéo montée (temps du montage). */
  mots: { mot: string; debutSec: number; finSec: number }[];
  /** Bornes des passages posés (cartes, écrans partagés). */
  coupesPrefereesSec?: number[];
  consignes?: string[];
  reglage?: ReglageMulticameraAvocat;
}

export async function passeMulticameraFacecam(d: DemandePasseMulticameraFacecam): Promise<PisteMulticamera | null> {
  const reglage = d.reglage ?? (await lireReglageMulticameraFormat("facecam"));
  // Lot J : ou demandée pour CETTE version seulement (« Confirmer » sur la carte de l'option payante).
  if (!multicameraDemandee(reglage, d.consignes) && !(await optionDemandeePourTravail("multicamera-facecam", d.travailId))) return null;
  const fab = await fabriquerSourcesMulticamera(d, reglage, "facecam");
  return pisteMulticameraFacecam({ actif: true, mots: d.mots, sources: fab.sources, replis: fab.replis, dureeSec: d.dureePriseSec, coupesPrefereesSec: d.coupesPrefereesSec, simulation: fab.simulation });
}
