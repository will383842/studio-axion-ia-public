/**
 * C11-E3 (NEUF, non inscrit, non branché) : frise de montage : bande de vignettes en bas de cadre et tête de lecture terracotta qui avance.
 * Reçoit des adresses (`sources`) et n'en choisit aucune. Vidéo toujours MUETTE. Sans source : cadres vides, sans erreur.
 * Charte Axion seulement, Manrope, aucun son, aucun visage dessiné.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { BORNES_ARCHIVE, type Rect } from "../../../../src/briques/motion/ecrans-couverture/grilles";
import { chargerManrope } from "../../plan-scenes/PlanDeScenes";
import { friseMontage } from "../../../../src/briques/motion/ecrans-couverture/grilles";
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

import { accentSur } from "../../../../src/briques/jetons-motion";
export type ProprietesFriseMontage = { sources?: SourceArchive[]; fond?: FondAxion; duree?: number };
export function FriseMontage({ sources = [], fond = "ivoire", duree }: ProprietesFriseMontage) {
  chargerManrope();
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = Math.min(1, frame / Math.max(1, (duree ? duree * fps : durationInFrames) - 1));
  const s = sources.slice(0, BORNES_ARCHIVE.frise);
  const { vignettes, tete } = friseMontage(width, height, s.length, t);
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION[fond], fontFamily: FAMILLE_CSS_AXION }}>
      {vignettes.map((r, i) => <Vignette key={i} r={r} src={s[i]?.src} debutImage={s[i]?.debutImage} fond={fond} />)}
      <div style={{ position: "absolute", left: tete.rect.x, top: tete.rect.y, width: tete.rect.largeur, height: tete.rect.hauteur, background: accentSur(fond, "terracotta"), borderRadius: tete.rect.largeur }} />
    </AbsoluteFill>
  );
}
