/**
 * C11-E3 (NEUF, non inscrit, non branché) : mur de 3 colonnes qui défilent à vitesses différentes, en boucle sans saut.
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

import { murDefilant } from "../../../../src/briques/motion/ecrans-couverture/grilles";
export type ProprietesMurDefilant = { sources?: SourceArchive[]; fond?: FondAxion };
export function MurDefilant({ sources = [], fond = "noir" }: ProprietesMurDefilant) {
  chargerManrope();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const s = sources.slice(0, BORNES_ARCHIVE.mur);
  const { cartes } = murDefilant(width, height, s.length, frame / fps);
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION[fond], fontFamily: FAMILLE_CSS_AXION, overflow: "hidden" }}>
      {cartes.map((r, i) => <Vignette key={i} r={r} src={s[r.source]?.src} debutImage={s[r.source]?.debutImage} fond={fond} />)}
    </AbsoluteFill>
  );
}
