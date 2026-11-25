/** Inscription de la composition « VideoLongue » (UNE ligne dans `Racine.tsx`). */
import type { ComponentType } from "react";
import { Composition } from "remotion";
import { imageDe } from "../../../../src/moteurs/montage-video-longue/rendu-chapitres";
import { FORMAT_LONGUE, ID_COMPOSITION_VIDEO_LONGUE, type ProprietesVideoLongue } from "../../../../src/moteurs/montage-video-longue/storyboard-types";
import { PROPRIETES_EXEMPLE_LONGUE } from "./exemple";
import { VideoLongue } from "./VideoLongue";

export function CompositionsVideoLongue() {
  return (
    <Composition
      id={ID_COMPOSITION_VIDEO_LONGUE}
      component={VideoLongue as unknown as ComponentType<Record<string, unknown>>}
      durationInFrames={imageDe(PROPRIETES_EXEMPLE_LONGUE.storyboard.dureeMs, FORMAT_LONGUE.fps)}
      fps={FORMAT_LONGUE.fps}
      width={FORMAT_LONGUE.largeur}
      height={FORMAT_LONGUE.hauteur}
      defaultProps={PROPRIETES_EXEMPLE_LONGUE as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, imageDe((props as unknown as ProprietesVideoLongue).storyboard.dureeMs, FORMAT_LONGUE.fps)) })}
    />
  );
}
