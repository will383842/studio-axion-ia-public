/**
 * COMPOSITION « TableauDeBordVideo » (G4-10a), du type « TutorielOutil » : le plan de scènes validé (pièces de données,
 * aucun visage), la voix (absente : muette), les sous-titres, puis la carte de fin Axion existante (sans bruitage neuf).
 * Elle porte le rôle de la composition `MontageDonnees` ; ELLE N'EST PAS inscrite dans `Racine.tsx` (G4-09b, chef).
 * Les propriétés sont RECOPIÉES ici (règle R-2) ; un test les compare, champ par champ, à `src/moteurs/montage-donnees/proprietes.ts`.
 * Police : Manrope (chargée par `PlanDeScenes`). Durées : `./duree` (pur).
 */
import { AbsoluteFill, Audio, Sequence } from "remotion";
import type { DonneesCalque } from "../../../src/briques/sous-titres/scene";
import type { PlanValide } from "../../../src/briques/plan-scenes/schema";
import { CalquesCommuns } from "../commune/CalquesCommuns";
import { CarteFinAxion } from "../commune/fin/CarteFinAxion";
import { PlanDeScenes } from "../plan-scenes/PlanDeScenes";
import { DUREE_CARTE_FIN_MS, dureeImagesCarteFin, dureeImagesScenes, dureeImagesTableauDeBord } from "./duree";

/** Nom de la composition de montage (même texte que `COMPOSITION_DONNEES`). */
export const COMPOSITION_DONNEES_RENDU = "MontageDonnees";

export const ADRESSE_CARTE_FIN = "axion-ia.com";

export type ProprietesTableauDeBordVideo = {
  plan: PlanValide;
  /** Adresse signée de la voix ; absente : variante muette (sous-titres seuls). */
  audio?: string;
  /** Calque des sous-titres (brique coupée : absent). */
  sousTitres?: DonneesCalque;
};

export function TableauDeBordVideo(p: ProprietesTableauDeBordVideo) {
  const imagesPlan = dureeImagesScenes(p.plan);
  const { largeur, hauteur, fps } = p.plan.format;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={imagesPlan}>
        <PlanDeScenes plan={p.plan} />
        <CalquesCommuns sousTitres={p.sousTitres ? { donnees: p.sousTitres } : undefined} />
        {p.audio ? <Audio src={p.audio} /> : null}
      </Sequence>
      <Sequence from={imagesPlan} durationInFrames={dureeImagesCarteFin(fps)}>
        <CarteFinAxion largeur={largeur} hauteur={hauteur} dureeSec={DUREE_CARTE_FIN_MS / 1000} adresse={ADRESSE_CARTE_FIN} />
      </Sequence>
    </AbsoluteFill>
  );
}

export const metaTableauDeBordVideo = ({ props }: { props: ProprietesTableauDeBordVideo }) => ({
  durationInFrames: dureeImagesTableauDeBord(props.plan),
  fps: props.plan.format.fps,
  width: props.plan.format.largeur,
  height: props.plan.format.hauteur,
});
