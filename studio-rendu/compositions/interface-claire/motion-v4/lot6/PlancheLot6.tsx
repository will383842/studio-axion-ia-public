import React from "react";
/**
 * PLANCHE DU LOT 6 (harnais de validation, NON utilisé en production, non inscrit) : le téléphone générique, 3 images fixes
 * (début, milieu, fin) pour validation de Williams. Composition `PlancheLot6` : propriété `src` (adresse de la vidéo, facultative) ; les 3 images se tirent par `remotion still … --frame=0|45|89`. Sans `src` : cadre vide, aucune erreur.
 */
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { COULEURS_LOT6, TelephoneVideo } from "./TelephoneVideo";

export const DUREE_PLANCHE_LOT6 = 90;
export const IMAGES_PLANCHE_LOT6 = { debut: 0, milieu: 45, fin: DUREE_PLANCHE_LOT6 - 1 } as const;
export type MomentLot6 = keyof typeof IMAGES_PLANCHE_LOT6;
type Props = { src?: string };

function ScenePlanche({ src }: Props) {
  return (
    <AbsoluteFill style={{ background: COULEURS_LOT6.IVOIRE, alignItems: "center", justifyContent: "center" }}>
      <TelephoneVideo src={src} />
    </AbsoluteFill>
  );
}

export function RacineLot6() {
  return <Composition id="PlancheLot6" component={ScenePlanche} durationInFrames={DUREE_PLANCHE_LOT6} fps={30} width={1080} height={1920} defaultProps={{} as Props} />;
}
registerRoot(RacineLot6);
