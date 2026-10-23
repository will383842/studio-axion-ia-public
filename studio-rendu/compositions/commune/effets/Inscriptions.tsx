/**
 * Compositions des effets spéciaux (lot F3), inscrites dans `Racine.tsx` par UNE ligne. Rendues par l'opération
 * `composition` EXISTANTE, sans mode : aucune nouvelle opération, aucun changement de contrat. Taille, cadence et
 * durée viennent des propriétés.
 */
import { Composition } from "remotion";
import { COMPOSITION_OBJET_MAIN, COMPOSITION_PLATEAU_DEMO, COMPOSITION_TRANSITION } from "../../../../src/briques/effets-speciaux/demande";
import { lumiereParDefaut } from "../../../../src/briques/effets-speciaux/lumiere";
import type { ProprietesEffetObjetMain, ProprietesEffetTransition } from "../../../../src/briques/effets-speciaux/types";
import { EffetObjetMain } from "./EffetObjetMain";
import { EffetTransition } from "./EffetTransition";
import { PlateauEffets, type ProprietesPlateau } from "./PlateauEffets";
import { COMPOSITION_PLATEAU_PHOTO, PlateauPhoto, type ProprietesPlateauPhoto } from "./PlateauPhoto";

const meta = ({ props }: { props: { largeur: number; hauteur: number; fps: number; images: number } }) => ({ width: props.largeur, height: props.hauteur, fps: props.fps, durationInFrames: Math.max(1, props.images) });

const OBJET_VIDE: ProprietesEffetObjetMain = { largeur: 1080, hauteur: 1920, fps: 25, images: 25, source: "", debutSourceImage: 0, objet: "logo-axion", poses: [], lumiere: lumiereParDefaut() };
const TRANSITION_VIDE: ProprietesEffetTransition = {
  largeur: 1080,
  hauteur: 1920,
  fps: 25,
  images: 30,
  style: "vitre-brisee",
  avant: { source: "", debutImage: 0 },
  apres: { source: "", debutImage: 0 },
  debutEffetImage: 0,
  dureeEffetImages: 30,
  point: { x: 760, y: 1260 },
  graine: 7,
};
const PLATEAU_VIDE: ProprietesPlateau = { largeur: 1080, hauteur: 1920, fps: 25, images: 125, main: [], serre: 1 };
const PLATEAU_PHOTO_VIDE: ProprietesPlateauPhoto = { largeur: 1080, hauteur: 1920, fps: 25, images: 125, personne: "", main: "", cles: [] };

export function CompositionsEffets() {
  return (
    <>
      <Composition id={COMPOSITION_OBJET_MAIN} component={EffetObjetMain} durationInFrames={25} fps={25} width={1080} height={1920} defaultProps={OBJET_VIDE} calculateMetadata={meta} />
      <Composition id={COMPOSITION_TRANSITION} component={EffetTransition} durationInFrames={30} fps={25} width={1080} height={1920} defaultProps={TRANSITION_VIDE} calculateMetadata={meta} />
      <Composition id={COMPOSITION_PLATEAU_DEMO} component={PlateauEffets} durationInFrames={125} fps={25} width={1080} height={1920} defaultProps={PLATEAU_VIDE} calculateMetadata={meta} />
      {/* Lot I2 : plateau photographique de la planche des effets « main ». */}
      <Composition id={COMPOSITION_PLATEAU_PHOTO} component={PlateauPhoto} durationInFrames={125} fps={25} width={1080} height={1920} defaultProps={PLATEAU_PHOTO_VIDE} calculateMetadata={meta} />
    </>
  );
}
