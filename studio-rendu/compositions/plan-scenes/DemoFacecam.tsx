/**
 * COMPOSITION « DemoFacecam » (lot J) : moitié / moitié sur fond ivoire — l'ÉCRAN RÉEL de Williams (en haut, ou à gauche
 * en 16:9) et sa FACECAM (en bas, ou à droite), sa voix réelle (le son de la facecam), les sous-titres calés, puis la
 * carte de fin Axion. Le motion design (plan de scènes du lot C, fond transparent) est dessiné DANS la moitié de l'écran :
 * il ne passe jamais devant le visage ; les zooms doux agrandissent l'écran seul. Une seule vidéo déjà en écran partagé :
 * elle remplit l'image, sans zoom. Propriétés et durées : PURES, dans `src/moteurs/montage-demo-facecam/proprietes.ts`.
 */
import type { CSSProperties } from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import { COMPOSITION_DEMO_FACECAM, dureeImagesDemo, imagesDemo, IVOIRE_CHARTE, zoomA, type Cadre, type ProprietesDemoFacecam } from "../../../src/moteurs/montage-demo-facecam/proprietes";
import { planCarteFin } from "../../../src/moteurs/montage-tutoriel-outil/proprietes";
import { CalqueSousTitres } from "../sous-titres/CalqueSousTitres";
import { PlanDeScenes } from "./PlanDeScenes";

export { COMPOSITION_DEMO_FACECAM };

/** Marge de l'écran dans sa moitié (px) : le fond ivoire l'encadre. */
const MARGE_ECRAN = 24;

const cadre = (c: Cadre): CSSProperties => ({ position: "absolute", left: c.x, top: c.y, width: c.largeur, height: c.hauteur, overflow: "hidden" });
const plein: CSSProperties = { width: "100%", height: "100%" };

function EcranReel({ p }: { p: ProprietesDemoFacecam }) {
  const image = useCurrentFrame();
  const z = zoomA(p.zooms, (image * 1000) / p.format.fps);
  const decalage = Math.round((p.decalageEcranMs * p.format.fps) / 1000);
  return (
    <div style={cadre(p.ecran)}>
      <div style={{ position: "absolute", inset: MARGE_ECRAN, borderRadius: 18, overflow: "hidden", background: IVOIRE_CHARTE, boxShadow: "0 6px 24px rgba(22,18,15,0.12)" }}>
        <div style={{ ...plein, transform: `scale(${z.facteur})`, transformOrigin: `${z.x}% ${z.y}%` }}>
          {p.videoEcran ? (
            <Sequence from={decalage}>
              <OffthreadVideo src={p.videoEcran} muted style={{ ...plein, objectFit: "contain" }} />
            </Sequence>
          ) : null}
        </div>
      </div>
      <PlanDeScenes plan={p.plan} />
    </div>
  );
}

export function DemoFacecam(p: ProprietesDemoFacecam) {
  const imagesPrise = imagesDemo(p.dureeMs, p.format.fps);
  return (
    <AbsoluteFill style={{ background: IVOIRE_CHARTE }}>
      <Sequence durationInFrames={imagesPrise}>
        {p.mode === "deux" ? (
          <>
            <EcranReel p={p} />
            <div style={cadre(p.facecam)}>{p.videoFacecam ? <OffthreadVideo src={p.videoFacecam} style={{ ...plein, objectFit: "cover", objectPosition: "50% 35%" }} /> : null}</div>
          </>
        ) : (
          <>
            {p.videoUnique ? <OffthreadVideo src={p.videoUnique} style={{ ...plein, objectFit: "cover" }} /> : null}
            <PlanDeScenes plan={p.plan} />
          </>
        )}
        {p.sousTitres ? <CalqueSousTitres donnees={p.sousTitres} /> : null}
      </Sequence>
      <Sequence from={imagesPrise}>
        <PlanDeScenes plan={planCarteFin({ plan: { ...p.plan, format: p.format, facecam: false }, fin: p.fin, finMs: p.finMs })} />
      </Sequence>
    </AbsoluteFill>
  );
}

export const metaDemoFacecam = ({ props }: { props: ProprietesDemoFacecam }) => ({
  durationInFrames: dureeImagesDemo(props),
  fps: props.format.fps,
  width: props.format.largeur,
  height: props.format.hauteur,
});
