/** Point d'entrée Remotion de la planche d'illustrations (utilisé par `planche-illustrations.ts`). */
import { Composition, registerRoot } from "remotion";
import { PlancheIllustrations, LARGEUR_PLANCHE, HAUTEUR_PLANCHE } from "./planche-illustrations-vue";

registerRoot(() => <Composition id="PlancheIllustrations" component={PlancheIllustrations} width={LARGEUR_PLANCHE} height={HAUTEUR_PLANCHE} fps={25} durationInFrames={1} />);
