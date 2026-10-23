import { Composition } from "remotion";
import { FORMAT } from "../commun/constantes";
import { VISUEL_PAGE_DEFAUT } from "../Compositions";
import { ID_COMPOSITION_MESURE } from "./protocole";
import { MesureVisuelPage, type ProprietesMesure } from "./MesureVisuelPage";

/** Racine du paquet de MESURE (séparé de `compositions/index.ts`, qui reste inchangé). */
export function RacineMesure() {
  return <Composition id={ID_COMPOSITION_MESURE} component={MesureVisuelPage} durationInFrames={1} fps={FORMAT.fps} width={FORMAT.largeur} height={FORMAT.hauteur} defaultProps={{ ...VISUEL_PAGE_DEFAUT, nonce: "apercu" } satisfies ProprietesMesure} />;
}
