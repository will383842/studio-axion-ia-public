import type { Metadata } from "next";
import { FormulaireVideoLongue } from "@/components/formats/video-longue/FormulaireVideoLongue";
import { PARAM_OPTIONS_COUPEES } from "@/services/options-payantes";
import { lireParametre } from "@/services/_commun";
import { MONTAGE_VIDEO_LONGUE_RELIE } from "@/services/video-longue-branchements";
import { PHRASE_MONTAGE_NON_RELIE, PHRASE_VOIX_NON_RELIEE, VOIX_VIDEO_LONGUE_RELIEE } from "@/services/video-longue-creation";
import { lancerVideoLongueAction } from "./actions";

export const metadata: Metadata = { title: "Vidéo longue" };
export const dynamic = "force-dynamic";

/**
 * Écrans 1 à 4 du générateur « Vidéo longue » (vitrine). Joignable par son adresse seulement : le format est masqué,
 * aucune carte n'est ajoutée à la main. Réglages en lecture seule ; seul `true` exact allume.
 */
export default async function PageVideoLongue() {
  const [actif, coupees] = await Promise.all([lireParametre<unknown>("videoLongue.actif", false), lireParametre<unknown>(PARAM_OPTIONS_COUPEES, false)]);
  return <FormulaireVideoLongue actif={actif === true} depensesCoupees={coupees === true} lancer={lancerVideoLongueAction} phraseMontageNonRelie={MONTAGE_VIDEO_LONGUE_RELIE ? undefined : PHRASE_MONTAGE_NON_RELIE} phraseVoixNonReliee={VOIX_VIDEO_LONGUE_RELIEE ? undefined : PHRASE_VOIX_NON_RELIEE} />;
}
