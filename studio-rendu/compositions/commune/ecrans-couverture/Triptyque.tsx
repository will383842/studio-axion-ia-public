/**
 * C11-E3 (NEUF, non inscrit, non branché) : triptyque concave : 3 cartes, celles des bords tournées de ±18°, centre de face.
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

import { triptyque } from "../../../../src/briques/motion/ecrans-couverture/grilles";
export type ProprietesTriptyque = { sources?: SourceArchive[]; fond?: FondAxion; duree?: number };
export function Triptyque({ sources = [], fond = "noir", duree }: ProprietesTriptyque) {
  chargerManrope();
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = Math.min(1, frame / Math.max(1, (duree ? duree * fps : durationInFrames) - 1));
  const s = sources.slice(0, BORNES_ARCHIVE.triptyque);
  const { cartes, perspective } = triptyque(width, height, s.length, t);
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION[fond], fontFamily: FAMILLE_CSS_AXION, perspective }}>
      {cartes.map((r, i) => (
        <div key={i} style={{ position: "absolute", inset: 0, transform: `rotateY(${r.rotation}deg)`, transformOrigin: `${r.x + r.largeur / 2}px 50%`, transformStyle: "preserve-3d" }}>
          <Vignette r={{ ...r, rotation: 0 }} src={s[i]?.src} debutImage={s[i]?.debutImage} fond={fond} />
        </div>
      ))}
    </AbsoluteFill>
  );
}
