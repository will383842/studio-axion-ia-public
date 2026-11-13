/** Compositions d'infographie, inscrites dans `compositions/Racine.tsx` par UNE ligne. Taille lue dans le ratio demandé. */
import { Composition } from "remotion";
import { Infographie, type ProprietesInfographie } from "./gabarits/Infographie";
import { FORMATS_INFOGRAPHIE, ID_COMPOSITION_INFOGRAPHIE } from "./gabarits/mise-en-page";

/** Spec d'aperçu inventé, valide pour le schéma d'infographie (qui n'est pas importé ici : zod ne se résout pas depuis src/ dans le contrôle de types). */
const SPEC_DEFAUT = {
  version: "infographie/1",
  alt: "Exemple d'infographie",
  titre: "Trois chiffres à retenir",
  blocs: [
    { titre: "Premier", texte: "Un exemple fictif.", valeur: "42\u00a0%" },
    { titre: "Deuxième", texte: "Un autre exemple fictif.", valeur: "3 sur 4" },
  ],
};

/** Propriétés par défaut (aperçu). */
export const INFOGRAPHIE_DEFAUT: ProprietesInfographie = { gabarit: "chiffres-cles", ratio: "1:1", spec: SPEC_DEFAUT };

const meta = ({ props }: { props: ProprietesInfographie }) => ({ width: FORMATS_INFOGRAPHIE[props.ratio].largeur, height: FORMATS_INFOGRAPHIE[props.ratio].hauteur });

export function CompositionsInfographie() {
  return <Composition id={ID_COMPOSITION_INFOGRAPHIE} component={Infographie} durationInFrames={1} fps={25} width={1080} height={1080} defaultProps={INFOGRAPHIE_DEFAUT} calculateMetadata={meta} />;
}
