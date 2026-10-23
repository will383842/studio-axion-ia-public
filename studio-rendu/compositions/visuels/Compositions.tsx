/**
 * Compositions des visuels de carrousels, inscrites dans `Racine.tsx` par UNE ligne ; les suivantes s'inscrivent ICI.
 * Taille, cadence et durée sont fixes : une image 1080 × 1350 par page.
 */
import { Composition } from "remotion";
import { AbsoluteFill } from "remotion";
import { COULEURS, FORMAT, ID_COMPOSITION_DECORS, ID_COMPOSITION_PAGE, MARGE } from "./commun/constantes";
import { TYPES_DECOR } from "../../../src/briques/visuels/registre-decor";
import { COMPOSANTS_DECOR } from "./decor/formes";
import type { ProprietesVisuelPage } from "./commun/types";
import { VisuelPage } from "./VisuelPage";

export const COMPOSITIONS_VISUELS = Object.freeze({ page: ID_COMPOSITION_PAGE, decors: ID_COMPOSITION_DECORS });

/** Propriétés par défaut (aperçu du Studio Remotion) : un spec minimal inventé. */
export const VISUEL_PAGE_DEFAUT: ProprietesVisuelPage = {
  spec: {
    version: "carrousel/1",
    alt: "Exemple de couverture",
    pages: [{ type: "T01", titre: "Un titre d'exemple", sousTitre: "Un sous-titre d'exemple" }],
  },
  index: 0,
};

/** Planche de contrôle des éléments décoratifs : 15 formes sur 3 colonnes, les trois premières lignes sur crème, les deux dernières sur orange. Aucun texte. */
export function PlancheDecors() {
  return (
    <AbsoluteFill style={{ background: COULEURS.creme, padding: MARGE, boxSizing: "border-box", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(5, 1fr)", gap: 20 }}>
      {TYPES_DECOR.map((id, i) => {
        const Forme = COMPOSANTS_DECOR[id];
        const sur = i >= 9 ? "orange" : "creme";
        return (
          <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 28, background: sur === "orange" ? COULEURS.orange : COULEURS.pale }}>
            <Forme taille={200} sur={sur} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

export function CompositionsVisuels() {
  return (
    <>
      <Composition id={COMPOSITIONS_VISUELS.page} component={VisuelPage} durationInFrames={1} fps={FORMAT.fps} width={FORMAT.largeur} height={FORMAT.hauteur} defaultProps={VISUEL_PAGE_DEFAUT} />
      <Composition id={COMPOSITIONS_VISUELS.decors} component={PlancheDecors} durationInFrames={1} fps={FORMAT.fps} width={FORMAT.largeur} height={FORMAT.hauteur} />
    </>
  );
}
