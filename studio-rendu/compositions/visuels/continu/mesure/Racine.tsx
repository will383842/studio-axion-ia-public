import { Composition } from "remotion";
import { GABARITS } from "../../../../../src/briques/visuels/continu/registre-gabarits";
import type { ToileSpecType } from "../../../../../src/domaine/visuels/continu/schema-toile";
import { VERSION_TOILE_SOCLE } from "../../../../../src/domaine/visuels/continu/version";
import { FPS_TOILE, HAUTEURS, LARGEUR_PAGE } from "../constantes-continu";
import { MesureToile, type ProprietesMesureToile } from "./MesureToile";
import { ID_COMPOSITION_TOILE } from "./protocole-toile";

/** Toile d'aperçu (studio Remotion) : les exemples des gabarits d'essai X00, X01, X02. */
function toileApercu(): ProprietesMesureToile {
  const types = ["X00", "X01", "X02"];
  const pages = types.map((t) => GABARITS.find((g) => g.type === t)!.exemple) as ToileSpecType["pages"];
  return {
    toile: { version: "toile/1", format: "4:5", pages, raccords: [] },
    versions: { socle: VERSION_TOILE_SOCLE, gabarits: Object.fromEntries(types.map((t) => [t, 1])), parcours: {}, raccords: {} },
    nonce: "apercu",
  };
}

/** Racine du paquet de MESURE de la toile : la largeur suit le nombre de pages (`calculateMetadata`), la hauteur le format. */
export function RacineToile() {
  return (
    <Composition
      id={ID_COMPOSITION_TOILE}
      component={MesureToile}
      durationInFrames={1}
      fps={FPS_TOILE}
      defaultProps={toileApercu()}
      calculateMetadata={({ props }) => ({ width: props.toile.pages.length * LARGEUR_PAGE, height: HAUTEURS[props.toile.format] })}
    />
  );
}
