/**
 * Compositions des modèles 7 à 13 (lot F2), inscrites à côté des 6 modèles validés (`CompositionsMotion`). Rendues par
 * l'opération `composition` EXISTANTE, sans mode : `parametres.composition` = l'identifiant (`MotionGraphique`…),
 * `parametres.proprietes` = la carte, sa mise en page, son style (sobre par défaut, ou spectaculaire).
 */
import { Composition } from "remotion";
import { carteExempleEtendue, CATALOGUE_MOTION_ETENDU } from "../../../../src/briques/motion/catalogue-etendu";
import type { IdModeleMotionEtendu, ProprietesCarteMotionEtendue } from "../../../../src/briques/motion/types-etendus";
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { MotionCaptureAnnotee } from "./MotionCaptureAnnotee";
import { MotionCheckList } from "./MotionCheckList";
import { MotionDocumentaire } from "./MotionDocumentaire";
import { MotionGraphique } from "./MotionGraphique";
import { MotionIconeMot } from "./MotionIconeMot";
import { MotionProblemeSolution } from "./MotionProblemeSolution";
import { MotionTitrePleinEcran } from "./MotionTitrePleinEcran";

const MISE_EN_PAGE: MiseEnPageCarte = { ratio: "9:16", largeur: 1080, hauteur: 1920, hauteurVideo: 1920, disposition: "plein-ecran", fps: 25, images: 125 };

const meta = ({ props }: { props: MiseEnPageCarte }) => ({ width: props.largeur, height: props.hauteur, fps: props.fps, durationInFrames: Math.max(1, props.images) });

const COMPOSANTS: Record<IdModeleMotionEtendu, React.FC<ProprietesCarteMotionEtendue>> = {
  graphique: MotionGraphique as React.FC<ProprietesCarteMotionEtendue>,
  "icone-mot": MotionIconeMot as React.FC<ProprietesCarteMotionEtendue>,
  "probleme-solution": MotionProblemeSolution as React.FC<ProprietesCarteMotionEtendue>,
  "check-list": MotionCheckList as React.FC<ProprietesCarteMotionEtendue>,
  "capture-annotee": MotionCaptureAnnotee as React.FC<ProprietesCarteMotionEtendue>,
  "titre-plein-ecran": MotionTitrePleinEcran as React.FC<ProprietesCarteMotionEtendue>,
  documentaire: MotionDocumentaire as React.FC<ProprietesCarteMotionEtendue>,
};

export function CompositionsMotionEtendues() {
  return (
    <>
      {(Object.keys(COMPOSANTS) as IdModeleMotionEtendu[]).map((id) => (
        <Composition
          key={id}
          id={CATALOGUE_MOTION_ETENDU[id].composition}
          component={COMPOSANTS[id]}
          durationInFrames={125}
          fps={25}
          width={1080}
          height={1920}
          defaultProps={{ ...MISE_EN_PAGE, ...carteExempleEtendue(id) } as ProprietesCarteMotionEtendue}
          calculateMetadata={meta}
        />
      ))}
    </>
  );
}
