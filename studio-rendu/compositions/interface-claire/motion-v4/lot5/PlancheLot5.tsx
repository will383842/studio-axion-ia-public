import React from "react";
/**
 * HARNAIS DE RENDU DU LOT 5 (rendu local/cloud, NON utilisé en production) : chaque élément posé sur la PRISE COMMUNE (vraie vidéo de Will, voix
 * comprise), avec sous-titres v4, barre de progression et bruitages. Compositions 1080 × 1920 rendues à l'échelle 0,5 (540 × 960) :
 *  - `ExtraitLot5` (propriétés `element`, `palette`, `mode`) : extrait de 3-6 s d'un élément ;
 *  - `EnchainementLot5` (propriétés `palette`, `mode`) : les 7 éléments en 15 s.
 * `mode="visage"` : la prise est remplacée par un magenta sur la zone du visage et les vidéos par du gris, pour MESURER la part du visage couverte.
 */
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from "remotion";
import { Bruitage, BarreProgression, EtiquetteTete, FondTest, grouperMots, Palette, Prise, PositionST, Sons, SousTitresV4, FPS } from "./commun-lot5";
import { Bloc, planEnchainement, planExtrait, Plan } from "./plan-lot5";
import { dReel, groupeDouble, positionSousTitres } from "./position-st";
import { bruitagesDalleClaquee, DalleClaquee } from "./DalleClaquee";
import { bruitagesRafale, RafaleTroisMots } from "./RafaleTroisMots";
import { bruitagesDuelVideo, DuelVideo } from "./DuelVideo";
import { bruitagesMotDerriere, MotDerriere } from "./MotDerriere";
import { bruitagesElementBarre, ElementBarre } from "./ElementBarre";
import { AppelFinalPile, bruitagesAppelFinal } from "./AppelFinalPile";
import { bruitagesPanneauFin, decalagePrise, PanneauFin } from "./PanneauFin";

export const ELEMENTS_LOT5 = ["dalle-claquee", "rafale-trois-mots", "duel-video", "mot-derriere", "element-barre", "element-barre-pictos", "appel-final-pile", "panneau-fin"] as const;
type Mode = "normal" | "visage";

export function sonsDuPlan(plan: Plan): Bruitage[] {
  const t = (b: Bloc) => b.debut;
  return plan.blocs.flatMap((b): Bruitage[] => {
    switch (b.t) {
      case "dalle": return bruitagesDalleClaquee(t(b));
      case "rafale": return bruitagesRafale(t(b), b.ecarts);
      case "duel": return bruitagesDuelVideo(t(b)).concat(b.verdict ? [[(t(b) + b.verdict.i) / FPS, "select_002", 0.35]] : []);
      case "mot": return bruitagesMotDerriere(t(b));
      case "barre": return b.variante === "pictos" ? [[t(b) / FPS, "select_001", 0.3], [(t(b) + b.iBarre) / FPS, "feutre", 0.7]] : bruitagesElementBarre(t(b), b.iApp, b.iBarre, b.resultat?.i);
      case "appel": return bruitagesAppelFinal(t(b), b.iLignes);
      case "fin": return bruitagesPanneauFin(t(b));
      case "etq": return [[t(b) / FPS, "select_001", 0.22]];
    }
  });
}

function Scene({ plan, palette, mode, fond }: { plan: Plan; palette: Palette; mode: Mode; fond: FondTest }) {
  const frame = useCurrentFrame();
  const D = dReel(frame, plan); // descente RÉELLE de l'image (les sous-titres en dépendent)
  const groupes = React.useMemo(() => grouperMots(plan.mots, plan.duree / FPS), [plan]);
  const sansVideo = mode === "visage";
  const position: PositionST = (f) => positionSousTitres(plan, f);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Prise D={D} depuisSec={plan.s0} mode={mode} fond={fond} />
      {plan.blocs.map((b, k) => {
        switch (b.t) {
          case "etq": return <EtiquetteTete key={k} frame={frame} debut={b.debut} fin={b.fin} texte={b.texte} palette={palette} alterne={b.alterne} surEtiquette={b.sur} />;
          case "barre": return <ElementBarre key={k} frame={frame} debut={b.debut} palette={palette} variante={b.variante} textes={b.textes} iApparitions={b.iApp} iBarre={b.iBarre} resultat={b.resultat} duree={b.duree} />;
          case "mot": return <MotDerriere key={k} frame={frame} debut={b.debut} palette={palette} mot={b.mot} duree={b.duree} />;
          case "appel": return <AppelFinalPile key={k} frame={frame} debut={b.debut} palette={palette} motCle={b.motCle} lignes={b.lignes} iLignes={b.iLignes} iMotCle={b.iMotCle} duree={b.duree} />;
          case "dalle": return <DalleClaquee key={k} frame={frame} debut={b.debut} palette={palette} mot={b.mot} suite={b.suite} />;
          case "rafale": return <RafaleTroisMots key={k} frame={frame} debut={b.debut} palette={palette} mots={b.mots} ecarts={b.ecarts} duree={b.duree} />;
          case "duel": return <DuelVideo key={k} frame={frame} debut={b.debut} palette={palette} motA={b.motA} motB={b.motB} iMotB={b.iMotB} verdict={b.verdict} duree={b.duree} videoA="broll-clavier-frappe-1080.mp4" videoB="chantier-perceuse-vertical.mp4" sansVideo={sansVideo} />;
          case "fin": return <PanneauFin key={k} frame={frame} debut={b.debut} palette={palette} motCle={b.motCle} />;
        }
      })}
      {mode === "normal" ? <SousTitresV4 frame={frame} groupes={groupes} palette={palette} position={position} masquer={(g) => groupeDouble(plan, Math.max(frame, Math.round(g.mots[g.mots.length - 1].debut * FPS)), g.mots.map((m) => m.mot))} /> : null}
      {mode === "normal" ? <BarreProgression frame={frame} duree={plan.duree} palette={palette} /> : null}
      {mode === "normal" ? <Sons liste={sonsDuPlan(plan)} /> : null}
    </AbsoluteFill>
  );
}

type PropsExtrait = { element: string; palette: Palette; mode?: Mode; fond?: FondTest };
function ExtraitLot5({ element, palette, mode = "normal", fond = "prise" }: PropsExtrait) {
  const plan = React.useMemo(() => planExtrait(element), [element]);
  return <Scene plan={plan} palette={palette} mode={mode} fond={fond} />;
}
function EnchainementLot5({ palette, mode = "normal", fond = "prise" }: { palette: Palette; mode?: Mode; fond?: FondTest }) {
  const plan = React.useMemo(() => planEnchainement(), []);
  return <Scene plan={plan} palette={palette} mode={mode} fond={fond} />;
}

export function RacineLot5() {
  return (
    <>
      <Composition id="ExtraitLot5" component={ExtraitLot5} durationInFrames={90} fps={30} width={1080} height={1920} defaultProps={{ element: "dalle-claquee", palette: "B", mode: "normal" } as PropsExtrait} calculateMetadata={({ props }) => ({ durationInFrames: planExtrait((props as PropsExtrait).element).duree })} />
      <Composition id="EnchainementLot5" component={EnchainementLot5} durationInFrames={450} fps={30} width={1080} height={1920} defaultProps={{ palette: "B", mode: "normal" } as { palette: Palette; mode?: Mode; fond?: FondTest }} />
    </>
  );
}
registerRoot(RacineLot5);
