/**
 * C11-E1 (NEUF, non branché, non inscrit) : carte vidéo arrondie sous un titre fixe ; les sous-titres du montage restent sous la carte
 * (la pièce n'y dessine rien). Vidéo toujours MUETTE. Sans `src` : carte vide, sans erreur. Rien sur le visage : aucune personne dessinée.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { entreeCarte, geometrieCarteVideo, type RatioVideoCarte } from "../../../../src/briques/motion/ecrans-couverture/carte-video";
import { chargerPoliceMarque } from "../police-marque";

/** Éteint : aucun branchement. */
export const CARTE_VIDEO_ACTIVE = false;

const chargerManropeCarte = chargerPoliceMarque;

export type ProprietesCarteVideoArrondie = {
  src?: string;
  debutImage?: number;
  titre?: string;
  fond?: "ivoire" | "noir";
};

function ratioDe(l: number, h: number): RatioVideoCarte {
  return l >= h ? "16:9" : "4:5";
}

export function CarteVideoArrondie({ src, debutImage = 0, titre, fond = "ivoire" }: ProprietesCarteVideoArrondie) {
  chargerManropeCarte();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const f: FondAxion = fond === "noir" ? "noir" : "ivoire";
  const couleurs = couleursSur(f);
  const g = geometrieCarteVideo({ largeur: width, hauteur: height, ratioVideo: ratioDe(width, height), titre });
  const e = entreeCarte(frame / fps, 0);
  const aVideo = typeof src === "string" && src.trim() !== "";
  return (
    <AbsoluteFill style={{ background: couleurs.fond, fontFamily: FAMILLE_CSS_AXION }}>
      {g.titre ? (
        <div style={{ position: "absolute", left: g.titre.x, top: g.titre.y, width: g.titre.w, height: g.titre.h, display: "flex", alignItems: "center", fontWeight: 800, fontSize: Math.round(height * 0.04), lineHeight: 1.1, color: couleurs.texte }}>
          {titre}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: g.carte.x, top: g.carte.y, width: g.carte.w, height: g.carte.h, borderRadius: g.carte.rayon, overflow: "hidden", background: CHARTE_AXION.gris, opacity: e.opacite, transform: `scale(${e.echelle})` }}>
        {aVideo ? <OffthreadVideo src={src as string} trimBefore={debutImage} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
    </AbsoluteFill>
  );
}
