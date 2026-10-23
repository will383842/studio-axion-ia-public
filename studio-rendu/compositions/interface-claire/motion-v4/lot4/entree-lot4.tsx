import React from "react";
/** Point d'entrée Remotion de la planche du lot 4 (contrôle seulement, jamais branché en production). */
import { Composition, registerRoot } from "remotion";
import { EnchainementLot4, TOTAL_ENCHAINEMENT } from "./EnchainementLot4";
import { EXTRAITS, ExtraitLot4 } from "./PlancheLot4";
import type { Fond, IdElementLot4 } from "./PlancheLot4";
import { FPS } from "./commun-lot4";
import type { Palette } from "./commun-lot4";

function Racine() {
  return (
    <>
      <Composition id="ExtraitLot4" component={ExtraitLot4} durationInFrames={90} fps={FPS} width={1080} height={1920} defaultProps={{ element: "fenetre-plein-cadre" as IdElementLot4, palette: "B" as Palette, fond: "prise" as Fond }} calculateMetadata={({ props }) => ({ durationInFrames: EXTRAITS[props.element].total })} />
      <Composition id="EnchainementLot4" component={EnchainementLot4} durationInFrames={TOTAL_ENCHAINEMENT} fps={FPS} width={1080} height={1920} defaultProps={{ palette: "B" as Palette }} />
    </>
  );
}

registerRoot(Racine);
