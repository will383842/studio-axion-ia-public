/**
 * Compositions du format « Cas concret MD » : UNE composition, `CasConcretEcran`, pilotée par ses propriétés, rend
 * UN écran (sans son ni sous-titres). Taille, cadence et durée sont lues dans les propriétés (`finMs − debutMs`,
 * 25 i/s). Inscrite dans `Racine.tsx` par une ligne (raccord R1b) ; rien ne se calcule au chargement du module.
 */
import { Composition } from "remotion";
import { imagesEcran, type ProprietesEcran } from "../../../src/briques/ecrans-motion";
import { Ecran } from "./Ecran";
import { exempleEcran } from "./exemples";

/** Identifiants des compositions du format. */
export const COMPOSITIONS_CAS_CONCRET = Object.freeze({ ecran: "CasConcretEcran" });

export const metaEcran = ({ props }: { props: ProprietesEcran }) => ({ width: props.largeur, height: props.hauteur, fps: props.fps, durationInFrames: imagesEcran(props) });

export function CompositionsCasConcret() {
  const defaut = exempleEcran("accroche");
  return (
    <Composition
      id={COMPOSITIONS_CAS_CONCRET.ecran}
      component={Ecran}
      durationInFrames={imagesEcran(defaut)}
      fps={defaut.fps}
      width={defaut.largeur}
      height={defaut.hauteur}
      defaultProps={defaut}
      calculateMetadata={metaEcran}
    />
  );
}
