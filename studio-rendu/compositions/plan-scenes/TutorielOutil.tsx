/**
 * COMPOSITION « TutorielOutil » (lot I) : le plan de scènes validé (outil en plein écran, aucun visage), la voix HeyGen
 * épinglée (entrée « audio »), les sous-titres, puis la carte de fin Axion. Propriétés et durées : PURES, dans
 * `src/moteurs/montage-tutoriel-outil/proprietes.ts`. Le dessin réutilise `PlanDeScenes` et `CalqueSousTitres`.
 */
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { COMPOSITION_TUTORIEL, dureeImagesTutoriel, imagesDe, planCarteFin, type ProprietesTutorielOutil } from "../../../src/moteurs/montage-tutoriel-outil/proprietes";
import { CalqueSousTitres } from "../sous-titres/CalqueSousTitres";
import { CalquePlanScenes } from "./CalquePlanScenes";
import { NavigationFilmee } from "./NavigationFilmee";
import { PlanDeScenes } from "./PlanDeScenes";
import { ScenesSansVoix } from "./tutoriel-sans-voix/ScenesSansVoix";
import { SchemaFlux } from "./tutoriel-flux/SchemaFlux";

export { COMPOSITION_TUTORIEL };

export function TutorielOutil(p: ProprietesTutorielOutil) {
  const imagesPlan = imagesDe(p.plan.dureeMs, p.plan.format.fps);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={imagesPlan}>
        {p.filmNavigation && p.navigation ? (
          <>
            <NavigationFilmee film={p.filmNavigation} navigation={p.navigation} />
            <CalquePlanScenes plan={p.plan} />
          </>
        ) : p.compositionSansVoix ? (
          <ScenesSansVoix plan={p.compositionSansVoix} />
        ) : (
          <PlanDeScenes plan={p.plan} />
        )}
        {p.schemaFlux ? (
          <Sequence from={p.schemaFlux.debutImage} durationInFrames={p.schemaFlux.dureeImages}>
            <SchemaFlux plan={p.schemaFlux.plan} />
          </Sequence>
        ) : null}
        {p.sousTitres ? <CalqueSousTitres donnees={p.sousTitres} /> : null}
        {p.audio ? <Audio src={p.audio} /> : null}
      </Sequence>
      {p.finMs > 0 ? (
        <Sequence from={imagesPlan}>
          <PlanDeScenes plan={planCarteFin(p)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}

export const metaTutorielOutil = ({ props }: { props: ProprietesTutorielOutil }) => ({
  durationInFrames: dureeImagesTutoriel(props),
  fps: props.plan.format.fps,
  width: props.plan.format.largeur,
  height: props.plan.format.hauteur,
});
