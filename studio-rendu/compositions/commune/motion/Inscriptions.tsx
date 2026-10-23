/**
 * Compositions du motion design (brique commune `motion`), inscrites dans `Racine.tsx` par UNE ligne. Rendues par
 * l'opération `composition` EXISTANTE, sans mode (`parametres.composition` = l'identifiant, `parametres.proprietes`
 * = la carte) : aucune nouvelle opération, aucun changement de contrat. Taille, cadence et durée viennent des
 * propriétés (plein écran 1080 × 1920, moitié haute 1080 × 960, 4:5, 1:1).
 */
import { Composition } from "remotion";
import { carteExemple, CATALOGUE_MOTION, COMPOSITION_SUR_MESURE } from "../../../../src/briques/motion/catalogue";
import type { IdModeleMotion, MiseEnPageCarte, ProprietesCarteMotion, ProprietesCarteSurMesure } from "../../../../src/briques/motion/types";
import { CarteSurMesure } from "./CarteSurMesure";
import { CompositionsMotionEtendues } from "./InscriptionsEtendues";
import { MotionAvantApres } from "./MotionAvantApres";
import { MotionChiffre } from "./MotionChiffre";
import { MotionDeuxColonnes } from "./MotionDeuxColonnes";
import { MotionLigneDeTemps } from "./MotionLigneDeTemps";
import { MotionListe } from "./MotionListe";
import { MotionTitre } from "./MotionTitre";

/** Mise en page par défaut : plein écran 9:16, 5 s. Les vraies valeurs arrivent par la demande de rendu. */
export const MISE_EN_PAGE_DEFAUT: MiseEnPageCarte = { ratio: "9:16", largeur: 1080, hauteur: 1920, hauteurVideo: 1920, disposition: "plein-ecran", fps: 25, images: 125 };

const meta = ({ props }: { props: MiseEnPageCarte }) => ({ width: props.largeur, height: props.hauteur, fps: props.fps, durationInFrames: Math.max(1, props.images) });

const COMPOSANTS: Record<IdModeleMotion, React.FC<ProprietesCarteMotion>> = {
  liste: MotionListe as React.FC<ProprietesCarteMotion>,
  chiffre: MotionChiffre as React.FC<ProprietesCarteMotion>,
  "avant-apres": MotionAvantApres as React.FC<ProprietesCarteMotion>,
  "ligne-de-temps": MotionLigneDeTemps as React.FC<ProprietesCarteMotion>,
  "deux-colonnes": MotionDeuxColonnes as React.FC<ProprietesCarteMotion>,
  titre: MotionTitre as React.FC<ProprietesCarteMotion>,
};

const SUR_MESURE_VIDE: ProprietesCarteSurMesure = { ...MISE_EN_PAGE_DEFAUT, html: "", css: "", js: "" };

export function CompositionsMotion() {
  return (
    <>
      {(Object.keys(COMPOSANTS) as IdModeleMotion[]).map((id) => (
        <Composition
          key={id}
          id={CATALOGUE_MOTION[id].composition}
          component={COMPOSANTS[id]}
          durationInFrames={125}
          fps={25}
          width={1080}
          height={1920}
          defaultProps={{ ...MISE_EN_PAGE_DEFAUT, ...carteExemple(id) } as ProprietesCarteMotion}
          calculateMetadata={meta}
        />
      ))}
      <Composition id={COMPOSITION_SUR_MESURE} component={CarteSurMesure} durationInFrames={125} fps={25} width={1080} height={1920} defaultProps={SUR_MESURE_VIDE} calculateMetadata={meta} />
      {/* Lot F2 : modèles 7 à 13 (ajout, les 6 modèles validés ci-dessus sont inchangés). */}
      <CompositionsMotionEtendues />
    </>
  );
}
