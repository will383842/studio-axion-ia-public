/**
 * C11-E3 (NEUF, non inscrit, non branché) : grille 2×2 ou 3×3 dont une vignette élue grandit jusqu'à la carte centrale.
 * Reçoit des adresses (`sources`) et n'en choisit aucune. Vidéo toujours MUETTE. Sans source : cadres vides, sans erreur.
 * Charte Axion seulement, Manrope, aucun son, aucun visage dessiné.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { BORNES_ARCHIVE, type Rect } from "../../../../src/briques/motion/ecrans-couverture/grilles";
import { chargerManrope } from "../../plan-scenes/PlanDeScenes";
export type SourceArchive = { src?: string; debutImage?: number };

function Vignette({ r, src, debutImage, fond }: { r: Rect; src?: string; debutImage?: number; fond: FondAxion }) {
  const c = couleursSur(fond);
  const aVideo = typeof src === "string" && src.trim() !== "";
  return (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.largeur, height: r.hauteur, opacity: r.opacite, borderRadius: Math.round(r.largeur * 0.06), overflow: "hidden", background: CHARTE_AXION.gris, border: `2px solid ${c.filet}` }}>
      {aVideo ? <OffthreadVideo src={src as string} trimBefore={debutImage ?? 0} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
    </div>
  );
}

import { grilleElue } from "../../../../src/briques/motion/ecrans-couverture/grilles";
export type ProprietesGrilleElue = { sources?: SourceArchive[]; elue?: number; fond?: FondAxion; duree?: number };
export function GrilleElue({ sources = [], elue = 0, fond = "ivoire", duree }: ProprietesGrilleElue) {
  chargerManrope();
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = frame / Math.max(1, (duree ? duree * fps : durationInFrames) - 1);
  const s = sources.slice(0, BORNES_ARCHIVE.grille);
  const rects = grilleElue(width, height, s.length, Math.min(1, t), elue);
  const ordre = rects.map((r, i) => i).sort((a, b) => Number(a === Math.min(Math.max(Math.floor(elue) || 0, 0), rects.length - 1)) - Number(b === Math.min(Math.max(Math.floor(elue) || 0, 0), rects.length - 1)));
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION[fond], fontFamily: FAMILLE_CSS_AXION }}>
      {ordre.map((i) => <Vignette key={i} r={rects[i]} src={s[i]?.src} debutImage={s[i]?.debutImage} fond={fond} />)}
    </AbsoluteFill>
  );
}
