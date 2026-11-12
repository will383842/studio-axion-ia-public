/** Compositions d'infographie, inscrites dans `compositions/Racine.tsx` par UNE ligne. Taille lue dans le ratio demandé. */
import { Composition } from "remotion";
import { InfographieSpec } from "../../../../src/domaine/visuels/schema-infographie";
import { Infographie, type ProprietesInfographie } from "./gabarits/Infographie";
import { FORMATS_INFOGRAPHIE, ID_COMPOSITION_INFOGRAPHIE } from "./gabarits/mise-en-page";

/** Propriétés par défaut (aperçu) : un spec inventé. */
export const INFOGRAPHIE_DEFAUT: ProprietesInfographie = {
  gabarit: "chiffres-cles",
  ratio: "1:1",
  spec: InfographieSpec.parse({
    version: "infographie/1",
    alt: "Exemple d'infographie",
    titre: "Trois chiffres à retenir",
    blocs: [
      { titre: "Premier", texte: "Un exemple fictif.", valeur: "42\u00a0%" },
      { titre: "Deuxième", texte: "Un autre exemple fictif.", valeur: "3 sur 4" },
    ],
  }),
};

const meta = ({ props }: { props: ProprietesInfographie }) => ({ width: FORMATS_INFOGRAPHIE[props.ratio].largeur, height: FORMATS_INFOGRAPHIE[props.ratio].hauteur });

export function CompositionsInfographie() {
  return <Composition id={ID_COMPOSITION_INFOGRAPHIE} component={Infographie} durationInFrames={1} fps={25} width={1080} height={1080} defaultProps={INFOGRAPHIE_DEFAUT} calculateMetadata={meta} />;
}
