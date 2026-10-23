import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile } from "remotion";
import { useCurrentFrame } from "remotion";
import prise from "./prise-commune-1080x1920.png";
import { BulleCri } from "../motion-v2/lot5/BulleCri";
import { BadgeRoulant } from "../motion-v2/lot5/BadgeRoulant";
import { DemiLuneBas, bruitagesDemiLuneBas } from "../motion-v2/lot2/DemiLuneBas";
import { LosangeCrans, bruitagesLosangeCrans } from "../motion-v2/lot2/LosangeCrans";
import { PastilleChiffre, bruitagesPastilleChiffre } from "../motion-v2/lot2/PastilleChiffre";
import { MotVerticalBord } from "../motion-v2/lot3/MotVerticalBord";
import { PileLettres } from "../motion-v2/lot3/PileLettres";
import { TamponDechirure } from "../motion-v2/lot1/TamponDechirure";
import { ETAPES_LOSANGE_DEMO, FPS_DEMO, HAUTEUR_TRAVAIL, LARGEUR_TRAVAIL, SEQUENCE_DEMO, type ElementDemo } from "./sequence-demo";

/**
 * DÉMO 15 s « v2 énergie » (540 × 960, 30 i/s) : 8 éléments actifs de 4 lots différents s'enchaînent sur la prise fixe
 * `prise-commune-1080x1920.png` (la même image du début à la fin : AUCUN zoom, AUCUN mouvement de la prise). Les éléments sont
 * dessinés pour 1080 × 1920 : la scène de travail est réduite de moitié (`scale(0.5)`), rien n'est recadré.
 * La séquence (`sequence-demo.ts`) est contrôlée par les règles D0 à D13 du réalisateur (test `demo-v2.test.ts`).
 * AUCUNE musique : seulement les bruitages des fiches. Les sons « à sourcer » (papier, tampon, déchirure) n'existent pas encore :
 * le tampon joue PROVISOIREMENT `drop_004` à l'impact et `whoosh-out` à la déchirure. Pas de sous-titres dans cette démo.
 */

const W = LARGEUR_TRAVAIL;
const H = HAUTEUR_TRAVAIL;

function Element({ e, t }: { e: ElementDemo; t: number }) {
  const base = { t, debut: e.debut, fin: e.fin, largeurImage: W, hauteurImage: H };
  const mot = e.mots?.[0] ?? "";
  switch (e.id) {
    case "pastille-chiffre":
      return <PastilleChiffre {...base} nombre={mot} />;
    case "bulle-cri":
      return <BulleCri t={t} largeurImage={W} hauteurImage={H} donnees={{ a: e.debut, fin: e.fin, texte: mot }} />;
    case "mot-vertical-bord":
      return <MotVerticalBord {...base} mot={mot} />;
    case "losange-crans":
      return <LosangeCrans {...base} etapes={[...ETAPES_LOSANGE_DEMO]} />;
    case "demi-lune-bas":
      return <DemiLuneBas {...base} mot={mot} />;
    case "pile-de-lettres":
      return <PileLettres {...base} mot={mot} />;
    case "tampon-dechirure":
      return <TamponDechirure t={t} debut={e.debut} largeurImage={W} hauteurImage={H} mot={mot} />;
    case "badge-roulant":
      return <BadgeRoulant t={t} largeurImage={W} hauteurImage={H} donnees={{ a: e.debut, fin: e.fin, mots: e.mots ?? [], icone: "globe" }} />;
    default:
      return null;
  }
}

/** Bruitages [instant (s), fichier de `sons/`, volume] ; seuls les fichiers qui existent (les « à sourcer » sont écartés ou remplacés). */
export function bruitagesDemo(): [number, string, number][] {
  const sons: [number, string, number][] = [];
  for (const e of SEQUENCE_DEMO) {
    switch (e.id) {
      case "pastille-chiffre":
        sons.push(...bruitagesPastilleChiffre({ debut: e.debut }));
        break;
      case "bulle-cri":
        sons.push([e.debut, "click_003", 0.07], [e.debut + 0.1, "minimize_004", 0.05]);
        break;
      case "mot-vertical-bord":
        sons.push([e.debut, "whoosh-in", 0.07]);
        break;
      case "losange-crans":
        sons.push(...bruitagesLosangeCrans({ debut: e.debut, etapes: [...ETAPES_LOSANGE_DEMO] }));
        break;
      case "demi-lune-bas":
        sons.push(...bruitagesDemiLuneBas({ debut: e.debut }));
        break;
      case "pile-de-lettres":
        sons.push([e.debut, "drop_001", 0.08], [e.debut + 2 / FPS_DEMO, "drop_001", 0.06], [e.debut + 4 / FPS_DEMO, "drop_001", 0.05]);
        break;
      case "tampon-dechirure":
        // PROVISOIRE : « tampon » et « déchirure » restent à sourcer en CC0.
        sons.push([e.debut, "drop_004", 0.09], [e.debut + 25 / FPS_DEMO, "whoosh-out", 0.06]);
        break;
      case "badge-roulant":
        sons.push([e.debut, "select_002", 0.07]);
        break;
    }
  }
  return sons;
}

export function DemoV2() {
  const t = useCurrentFrame() / FPS_DEMO;
  return (
    <AbsoluteFill style={{ background: "#110A05" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>
        <Img src={prise} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
        {SEQUENCE_DEMO.map((e) => (
          <Element key={e.id} e={e} t={t} />
        ))}
      </div>
      {bruitagesDemo().map(([a, son, volume], i) => (
        <Sequence key={`s${i}`} from={Math.max(0, Math.round(a * FPS_DEMO))} durationInFrames={Math.round(1.5 * FPS_DEMO)} layout="none">
          <Audio src={staticFile(`sons/${son}.wav`)} volume={Math.min(1, volume * 6)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
