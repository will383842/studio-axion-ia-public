/**
 * Compositions du style « interface claire » (face caméra animé), inscrites dans `Racine.tsx` par UNE ligne.
 * Générateur indépendant : ses éléments vivent dans ce dossier ; il ne réutilise que les polices communes.
 */
import React from "react";
import { Composition } from "remotion";
import { PLANCHE } from "./donnees-planche";
import { PlancheInterfaceClaire } from "./Planche";
import { GALERIE, GalerieInterfaceClaire } from "./Galerie";
import { metaVideoAnimee, VideoAnimee } from "./VideoAnimee";
import { PLAN_GALERIE } from "./plan-galerie";
import { DemoV2 } from "./demo-v2/DemoV2";
import { DUREE_DEMO_SEC, FPS_DEMO, HAUTEUR_DEMO, LARGEUR_DEMO } from "./demo-v2/sequence-demo";
import { metaVideoAnimeeV4, VideoAnimeeV4 } from "./VideoAnimeeV4";
import { DemoV3 } from "./demo-v3/DemoV3";
import { DUREE_DEMO_V3_SEC, FPS_DEMO_V3, HAUTEUR_DEMO_V3, LARGEUR_DEMO_V3 } from "./demo-v3/sequence-demo";

export const COMPOSITIONS_INTERFACE_CLAIRE = Object.freeze({ planche: "InterfaceClairePlanche", galerie: "InterfaceClaireGalerie", video: "InterfaceClaireVideo", demoV2: "InterfaceClaireDemoV2", demoV3: "InterfaceClaireDemoV3", faceCameraV4: "InterfaceClaireFaceCameraV4" });

export function CompositionsInterfaceClaire() {
  return (
    <>
      <Composition
        id={COMPOSITIONS_INTERFACE_CLAIRE.planche}
        component={PlancheInterfaceClaire}
        durationInFrames={Math.round(PLANCHE.duree * PLANCHE.fps)}
        fps={PLANCHE.fps}
        width={PLANCHE.largeur}
        height={PLANCHE.hauteur}
      />
      {/* Galerie du lot B : tous les composants sur une vraie prise, pour validation par Will. */}
      {/* Rendu universel : une vidéo = un plan de mise en scène passé en props (par défaut : la galerie). */}
      <Composition id={COMPOSITIONS_INTERFACE_CLAIRE.video} component={VideoAnimee} durationInFrames={Math.round(PLAN_GALERIE.duree * PLAN_GALERIE.fps)} fps={PLAN_GALERIE.fps} width={PLAN_GALERIE.largeur} height={PLAN_GALERIE.hauteur} defaultProps={PLAN_GALERIE} calculateMetadata={metaVideoAnimee} />
      <Composition id={COMPOSITIONS_INTERFACE_CLAIRE.galerie} component={GalerieInterfaceClaire} durationInFrames={Math.round(GALERIE.duree * PLANCHE.fps)} fps={PLANCHE.fps} width={PLANCHE.largeur} height={PLANCHE.hauteur} />
      {/* Démo 15 s « v2 énergie » (16/10) : 8 éléments actifs de 4 lots sur la prise fixe, 540 × 960 à 30 i/s. */}
      <Composition id={COMPOSITIONS_INTERFACE_CLAIRE.demoV2} component={DemoV2} durationInFrames={DUREE_DEMO_SEC * FPS_DEMO} fps={FPS_DEMO} width={LARGEUR_DEMO} height={HAUTEUR_DEMO} />
      {/* Démo v3 (16/10) : le rendu final sur 8 éléments v3 actifs, 1080 × 1920 à 30 i/s. */}
      <Composition id={COMPOSITIONS_INTERFACE_CLAIRE.demoV3} component={DemoV3} durationInFrames={Math.round(DUREE_DEMO_V3_SEC * FPS_DEMO_V3)} fps={FPS_DEMO_V3} width={LARGEUR_DEMO_V3} height={HAUTEUR_DEMO_V3} />
      {/* Rendu final v4 (17/10) : une vidéo = un plan à `elementsV4` passé en props (26 plaquettes, sous-titres v4 calés sur la voix). */}
      <Composition id={COMPOSITIONS_INTERFACE_CLAIRE.faceCameraV4} component={VideoAnimeeV4} durationInFrames={Math.round(PLAN_GALERIE.duree * PLAN_GALERIE.fps)} fps={30} width={PLAN_GALERIE.largeur} height={PLAN_GALERIE.hauteur} defaultProps={PLAN_GALERIE} calculateMetadata={metaVideoAnimeeV4} />
    </>
  );
}
