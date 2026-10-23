/**
 * Compositions du tableau animé (TB-05), inscrites dans `Racine.tsx` par UNE ligne ; les compositions suivantes du
 * format (fins par réseau, TB-15…) s'inscrivent ICI, jamais dans `Racine.tsx`. Rendues par l'opération `composition`
 * existante, sans mode (`parametres.composition` = l'identifiant, `parametres.proprietes` = les propriétés) : aucune
 * nouvelle opération. Taille, cadence et durée viennent des propriétés (1080 × 1920, 25 i/s, `finMs − debutMs`).
 */
import { Composition } from "remotion";
import { FIN_EXEMPLE } from "../commune/fin/exemple";
import { Fin } from "../commune/fin/Fin";
import { imagesFin, type ProprietesFin } from "../commune/fin/plan";
import { COUVERTURE_EXEMPLE } from "../commune/miniature-serie/exemple";
import { MiniatureSerie } from "../commune/miniature-serie/MiniatureSerie";
import { dimensionsCouverture, type ProprietesCouverture } from "../commune/miniature-serie/plan";
import { BULLE_EXEMPLE, LIGNE_EXEMPLE, SCENE_EXEMPLE } from "./exemples";
import { imagesScene } from "./proprietes";
import { TableauScene } from "./TableauScene";
import type { ProprietesTableauScene } from "./types";

/** Identifiants des compositions du format. */
export const COMPOSITIONS_TABLEAU = Object.freeze({
  scene: "TableauScene",
  ligne: "TableauLigneEcrite",
  bulle: "TableauBullePreuve",
  fin: "TableauFin",
  couverture: "TableauCouvertureSerie",
});

export const meta = ({ props }: { props: ProprietesTableauScene }) => ({ width: props.largeur, height: props.hauteur, fps: props.fps, durationInFrames: imagesScene(props) });

export const metaFin = ({ props }: { props: ProprietesFin }) => ({ width: props.largeur, height: props.hauteur, fps: props.fps, durationInFrames: imagesFin(props) });

export const metaCouverture = ({ props }: { props: ProprietesCouverture }) => ({ width: dimensionsCouverture(props.ratio).largeur, height: dimensionsCouverture(props.ratio).hauteur, fps: 25, durationInFrames: 1 });

const INSCRITES: [string, ProprietesTableauScene][] = [
  [COMPOSITIONS_TABLEAU.scene, SCENE_EXEMPLE],
  // Pièces seules, sur une page d'une seule pièce (même composant : contrôle visuel et planches).
  [COMPOSITIONS_TABLEAU.ligne, LIGNE_EXEMPLE],
  [COMPOSITIONS_TABLEAU.bulle, BULLE_EXEMPLE],
];

export function CompositionsTableau() {
  return (
    <>
      {INSCRITES.map(([id, defaut]) => (
        <Composition key={id} id={id} component={TableauScene} durationInFrames={imagesScene(defaut)} fps={defaut.fps} width={defaut.largeur} height={defaut.hauteur} defaultProps={defaut} calculateMetadata={meta} />
      ))}
      {/* Fin par réseau (TB-15) : la phrase s'écrit, le crayon coche. */}
      <Composition id={COMPOSITIONS_TABLEAU.fin} component={Fin} durationInFrames={imagesFin(FIN_EXEMPLE)} fps={FIN_EXEMPLE.fps} width={FIN_EXEMPLE.largeur} height={FIN_EXEMPLE.hauteur} defaultProps={FIN_EXEMPLE} calculateMetadata={metaFin} />
      {/* Couverture de série (TB-16) : image fixe, 9:16 ou 1:1 selon la propriété `ratio`. */}
      <Composition id={COMPOSITIONS_TABLEAU.couverture} component={MiniatureSerie} durationInFrames={1} fps={25} width={dimensionsCouverture(COUVERTURE_EXEMPLE.ratio).largeur} height={dimensionsCouverture(COUVERTURE_EXEMPLE.ratio).hauteur} defaultProps={COUVERTURE_EXEMPLE} calculateMetadata={metaCouverture} />
    </>
  );
}
