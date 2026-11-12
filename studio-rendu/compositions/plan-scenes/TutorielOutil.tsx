/**
 * COMPOSITION « TutorielOutil » (lot I) : le plan de scènes validé (outil en plein écran, aucun visage), la voix HeyGen
 * épinglée (entrée « audio »), les sous-titres, puis la carte de fin Axion. Propriétés et durées : PURES, dans
 * `src/moteurs/montage-tutoriel-outil/proprietes.ts`. Le dessin réutilise `PlanDeScenes` et `CalqueSousTitres`.
 */
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { COMPOSITION_TUTORIEL, dureeImagesTutoriel, imagesDe, planCarteFin, type ProprietesTutorielOutil } from "../../../src/moteurs/montage-tutoriel-outil/proprietes";
import { CalqueSousTitres } from "../sous-titres/CalqueSousTitres";
import { PlanDeScenes } from "./PlanDeScenes";

export { COMPOSITION_TUTORIEL };

export function TutorielOutil(p: ProprietesTutorielOutil) {
  const imagesPlan = imagesDe(p.plan.dureeMs, p.plan.format.fps);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={imagesPlan}>
        <PlanDeScenes plan={p.plan} />
        {p.sousTitres ? <CalqueSousTitres donnees={p.sousTitres} /> : null}
        {p.audio ? <Audio src={p.audio} /> : null}
      </Sequence>
      <Sequence from={imagesPlan}>
        <PlanDeScenes plan={planCarteFin(p)} />
      </Sequence>
    </AbsoluteFill>
  );
}

export const metaTutorielOutil = ({ props }: { props: ProprietesTutorielOutil }) => ({
  durationInFrames: dureeImagesTutoriel(props),
  fps: props.plan.format.fps,
  width: props.plan.format.largeur,
  height: props.plan.format.hauteur,
});
