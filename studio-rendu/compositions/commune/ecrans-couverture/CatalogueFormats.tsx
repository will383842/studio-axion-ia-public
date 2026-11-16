/**
 * C11-E3 (NEUF, non inscrit, non branché) : catalogue de formats : une case par ratio (9:16, 4:5, 1:1, 16:9) avec son libellé.
 * Reçoit des adresses (`sources`) et n'en choisit aucune. Vidéo toujours MUETTE. Sans source : cadres vides, sans erreur.
 * Charte Axion seulement, Manrope, aucun son, aucun visage dessiné.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { BORNES_ARCHIVE, type Rect } from "../../../../src/briques/motion/ecrans-couverture/grilles";
import { chargerManrope } from "../../plan-scenes/PlanDeScenes";
import { catalogueFormats } from "../../../../src/briques/motion/ecrans-couverture/grilles";
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

export type ProprietesCatalogueFormats = { sources?: SourceArchive[]; fond?: FondAxion; duree?: number };
export function CatalogueFormats({ sources = [], fond = "ivoire", duree }: ProprietesCatalogueFormats) {
  chargerManrope();
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = Math.min(1, frame / Math.max(1, (duree ? duree * fps : durationInFrames) - 1));
  const s = sources.slice(0, BORNES_ARCHIVE.catalogue);
  const c = couleursSur(fond);
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION[fond], fontFamily: FAMILLE_CSS_AXION }}>
      {catalogueFormats(width, height, s.length, t).map((x, i) => (
        <React.Fragment key={x.libelle}>
          <Vignette r={x.rect} src={s[i]?.src} debutImage={s[i]?.debutImage} fond={fond} />
          <div style={{ position: "absolute", left: x.etiquette.x, top: x.etiquette.y, width: x.etiquette.largeur, height: x.etiquette.hauteur, opacity: x.etiquette.opacite, display: "flex", alignItems: "center", justifyContent: "center", color: c.texte, fontWeight: 700, fontSize: Math.round(x.etiquette.hauteur * 0.6) }}>{x.libelle}</div>
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
}
