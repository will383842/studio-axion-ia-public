import React from "react";
/**
 * Harnais de contrôle du lot E (rendu local, NON utilisé en production) : chaque élément posé sur la PRISE COMMUNE
 * (`planche-v3/prise-commune-1080x1920.png`, sans recadrage ni décalage ni zoom). Compositions 1080 × 1920 rendues à l'échelle 0,5
 * (540 × 960) :
 *  - `ExtraitE` (propriété `element`) : extrait de 2-3 s d'un élément ;
 *  - `EnchainementE` : les 5 éléments en 15 s, avec au moins 1 s de Will seul entre deux coups de poing (V10).
 * Propriété `mode` = "visage" : prise remplacée par du magenta et vidéos par du gris uni, pour MESURER la part du visage couverte.
 */
import { AbsoluteFill, Audio, Composition, Img, registerRoot, Sequence, staticFile, useCurrentFrame } from "remotion";
import { chargerPoliceMontserrat } from "./commun-lotE";
import { bruitagesDuelVideo, DuelVideo, EXEMPLE_DUEL_VIDEO } from "./DuelVideo";
import { groupesPhrase, SousTitresE } from "./SousTitresLotE";
import { bruitagesDalleClaqueeV3, DalleClaqueeV3, dureeDalleV3, EXEMPLE_DALLE_CLAQUEE_V3 } from "./DalleClaqueeV3";
import { bruitagesEclatChiffreV3, EclatChiffreV3, EXEMPLE_ECLAT_CHIFFRE_V3 } from "./EclatChiffreV3";
import { bruitagesMotFenetre, MotFenetre, EXEMPLE_MOT_FENETRE } from "./MotFenetre";
import { bruitagesMosaique, MosaiqueVideos, EXEMPLE_MOSAIQUE_VIDEOS } from "./MosaiqueVideos";
import type { BruitageMotion } from "./commun-lotE";

const W = 1080;
const H = 1920;
export const ELEMENTS_E = ["duel-video", "dalle-claquee", "eclat-chiffre", "mot-fenetre", "mosaique-videos"] as const;
/** Durée de chaque extrait (images à 30 i/s). */
export const DUREES_EXTRAIT: Record<string, number> = { "duel-video": 90, "dalle-claquee": 60, "eclat-chiffre": 60, "mot-fenetre": 78, "mosaique-videos": 84 };

/** Fenêtre de temps [début, fin] (s) et bruitages de chaque élément, décalés de `dec`. */
function infos(id: string, dec: number): { a: number; b: number; sons: BruitageMotion[] } {
  if (id === "duel-video") { const d = EXEMPLE_DUEL_VIDEO.debut + dec; return { a: d, b: EXEMPLE_DUEL_VIDEO.fin + dec, sons: bruitagesDuelVideo({ debut: d }) }; }
  if (id === "dalle-claquee") { const d = EXEMPLE_DALLE_CLAQUEE_V3.debut + dec; const f = d + dureeDalleV3(EXEMPLE_DALLE_CLAQUEE_V3) / 30; return { a: d, b: f, sons: bruitagesDalleClaqueeV3({ debut: d, fin: d + 1.0 }) }; }
  if (id === "eclat-chiffre") { const d = EXEMPLE_ECLAT_CHIFFRE_V3.debut + dec; return { a: d, b: EXEMPLE_ECLAT_CHIFFRE_V3.fin + dec, sons: bruitagesEclatChiffreV3({ debut: d }) }; }
  if (id === "mot-fenetre") { const d = EXEMPLE_MOT_FENETRE.debut + dec; return { a: d, b: EXEMPLE_MOT_FENETRE.fin + dec, sons: bruitagesMotFenetre({ debut: d }) }; }
  const d = EXEMPLE_MOSAIQUE_VIDEOS.debut + dec;
  return { a: d, b: EXEMPLE_MOSAIQUE_VIDEOS.fin + dec, sons: bruitagesMosaique({ debut: d }) };
}

/** Bruitages mixés (fichiers de `sons/`, jamais de musique) : volume du standard ×3 pour l'écoute. */
function Sons({ liste }: { liste: BruitageMotion[] }) {
  return (
    <>
      {liste.map(([t, son, vol], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(t * 30))} durationInFrames={60} layout="none">
          <Audio src={staticFile(`sons/${son}.wav`)} volume={Math.min(1, vol * 3.5)} />
        </Sequence>
      ))}
    </>
  );
}

function Calques({ t, ids, dec, mode, fin }: { t: number; ids: readonly string[]; dec: Record<string, number>; mode: Mode; fin: number }) {
  const liste = ids.map((id) => ({ id, ...infos(id, dec[id] ?? 0) }));
  const plein = liste.some((e) => t >= e.a - 1 / 30 && t < e.b);
  const groupes = React.useMemo(() => groupesPhrase(0.15, fin), [fin]);
  return (
    <>
      <Elements t={t} ids={ids} dec={dec} sansVideo={mode === "visage"} />
      {mode === "normal" ? <SousTitresE t={t} W={W} H={H} pleinEcran={plein} groupes={groupes} /> : null}
      {mode === "normal" ? <Sons liste={liste.flatMap((e) => e.sons)} /> : null}
    </>
  );
}

type Mode = "normal" | "visage";
type Props = { element: string; mode?: Mode };

function Fond({ mode }: { mode: Mode }) {
  if (mode === "visage") return <AbsoluteFill style={{ background: "#FF00FF" }} />;
  return <Img src={staticFile("prise.png")} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />;
}

/** Les éléments, avec leur décalage dans l'enchaînement (`dec` = secondes ajoutées au début de l'exemple). */
function Elements({ t, ids, dec, sansVideo }: { t: number; ids: readonly string[]; dec: Record<string, number>; sansVideo: boolean }) {
  const g = { t, largeurImage: W, hauteurImage: H, sansVideo };
  const d = (id: string) => dec[id] ?? 0;
  return (
    <>
      {ids.includes("duel-video") && <DuelVideo {...g} {...EXEMPLE_DUEL_VIDEO} debut={EXEMPLE_DUEL_VIDEO.debut + d("duel-video")} fin={EXEMPLE_DUEL_VIDEO.fin + d("duel-video")} verdict={{ gagnant: "B", a: EXEMPLE_DUEL_VIDEO.verdict.a + d("duel-video") }} />}
      {ids.includes("dalle-claquee") && <DalleClaqueeV3 {...g} mot={EXEMPLE_DALLE_CLAQUEE_V3.mot} debut={EXEMPLE_DALLE_CLAQUEE_V3.debut + d("dalle-claquee")} fin={EXEMPLE_DALLE_CLAQUEE_V3.fin + d("dalle-claquee")} />}
      {ids.includes("eclat-chiffre") && <EclatChiffreV3 {...g} valeur={EXEMPLE_ECLAT_CHIFFRE_V3.valeur} unite={EXEMPLE_ECLAT_CHIFFRE_V3.unite} debut={EXEMPLE_ECLAT_CHIFFRE_V3.debut + d("eclat-chiffre")} fin={EXEMPLE_ECLAT_CHIFFRE_V3.fin + d("eclat-chiffre")} />}
      {ids.includes("mot-fenetre") && <MotFenetre {...g} mot={EXEMPLE_MOT_FENETRE.mot} video={EXEMPLE_MOT_FENETRE.video} debut={EXEMPLE_MOT_FENETRE.debut + d("mot-fenetre")} fin={EXEMPLE_MOT_FENETRE.fin + d("mot-fenetre")} />}
      {ids.includes("mosaique-videos") && <MosaiqueVideos {...g} videos={EXEMPLE_MOSAIQUE_VIDEOS.videos} motFort={EXEMPLE_MOSAIQUE_VIDEOS.motFort} debut={EXEMPLE_MOSAIQUE_VIDEOS.debut + d("mosaique-videos")} fin={EXEMPLE_MOSAIQUE_VIDEOS.fin + d("mosaique-videos")} />}
    </>
  );
}

function ExtraitE({ element, mode = "normal" }: Props) {
  chargerPoliceMontserrat();
  const t = useCurrentFrame() / 30;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Fond mode={mode} />
      <Calques t={t} ids={[element]} dec={{}} mode={mode} fin={DUREES_EXTRAIT[element] / 30} />
    </AbsoluteFill>
  );
}

/** Décalages de l'enchaînement de 15 s (début de chaque exemple = 0,3 s, d'où le retrait). */
const DEC_ENCHAINEMENT: Record<string, number> = { "duel-video": 1.0 - 0.3, "dalle-claquee": 4.5 - 0.4, "eclat-chiffre": 6.5 - 0.3, "mot-fenetre": 9.0 - 0.3, "mosaique-videos": 11.8 - 0.3 };

function EnchainementE({ mode = "normal" }: { mode?: Mode }) {
  chargerPoliceMontserrat();
  const t = useCurrentFrame() / 30;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Fond mode={mode} />
      <Calques t={t} ids={ELEMENTS_E} dec={DEC_ENCHAINEMENT} mode={mode} fin={15} />
    </AbsoluteFill>
  );
}

export function RacineLotE() {
  return (
    <>
      <Composition id="ExtraitE" component={ExtraitE} durationInFrames={90} fps={30} width={W} height={H} defaultProps={{ element: "duel-video", mode: "normal" } as Props} />
      <Composition id="EnchainementE" component={EnchainementE} durationInFrames={450} fps={30} width={W} height={H} defaultProps={{ mode: "normal" } as { mode?: Mode }} />
    </>
  );
}
registerRoot(RacineLotE);
