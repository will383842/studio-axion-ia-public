/**
 * Compositions de l'habillage commun (C6-H7a), inscrites dans `Racine.tsx` par UNE ligne. Planches lancées à la main :
 * aucun générateur ne demande ces compositions, aucune opération neuve, rien ne s'exécute au chargement.
 */
import { Composition } from "remotion";
import { IMAGES_PLANCHE_FONDS, PlancheFonds, type ProprietesPlancheFonds } from "./PlancheFonds";
import { IMAGES_PLANCHE_LUMIERES, PlancheLumieres, type ProprietesPlancheLumieres } from "./PlancheLumieres";
import { HabillageMesure, IMAGES_PLANCHE, PlancheTransitions, type ProprietesMesure, type ProprietesPlancheTransitions } from "./PlancheTransitions";

const TRANSITIONS_VIDE: ProprietesPlancheTransitions = { largeur: 1080, hauteur: 1920, fps: 25 };
const FONDS_VIDE: ProprietesPlancheFonds = { largeur: 1080, hauteur: 1920, fps: 25 };
const LUMIERES_VIDE: ProprietesPlancheLumieres = { largeur: 1080, hauteur: 1920, fps: 25 };
const MESURE_VIDE: ProprietesMesure = { largeur: 1080, hauteur: 1920, fps: 25, images: 60, cas: "flou-0-plein" };

export function CompositionsHabillage() {
  return (
    <>
      <Composition id="HabillageTransitions" component={PlancheTransitions} durationInFrames={IMAGES_PLANCHE} fps={25} width={1080} height={1920} defaultProps={TRANSITIONS_VIDE} />
      <Composition id="HabillageMesure" component={HabillageMesure} durationInFrames={60} fps={25} width={1080} height={1920} defaultProps={MESURE_VIDE} calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.images) })} />
      <Composition id="HabillageFonds" component={PlancheFonds} durationInFrames={IMAGES_PLANCHE_FONDS} fps={25} width={1080} height={1920} defaultProps={FONDS_VIDE} />
      <Composition id="HabillageLumieres" component={PlancheLumieres} durationInFrames={IMAGES_PLANCHE_LUMIERES} fps={25} width={1080} height={1920} defaultProps={LUMIERES_VIDE} />
    </>
  );
}
