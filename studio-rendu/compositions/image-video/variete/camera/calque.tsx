import React from "react";
/**
 * Calque « caméra » de la variété (lot CAM-TRA). Sur une séquence de toile filmée par CAM-B ou CAM-C, la composition
 * recalcule sa caméra de RÉFÉRENCE ; ce calque la remplace par la trajectoire réécrite par le moteur
 * (`variete.donnees.camera.trajectoire`) : la scène entière est recadrée d'une pose à l'autre (zoom et décalage), le
 * fond est reposé dessous, la marque et l'en-tête dessus (fixes à l'écran, hors caméra). Puis :
 * - CAM-B : le schéma entier en silhouette sur la nuit (début), d'où la caméra plonge ;
 * - CAM-C : le point lumineux qui court sur le fil.
 * Sans ces données (toute autre scène, ou rendu de référence), le contenu est rendu tel quel. Aucun JSX au niveau module.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { cameraA, ECRAN_IV, FONDU_CADRE, type PoseCamera } from "../../../../../src/briques/schema-motion";
import { miseEnPageDeHauteurIV } from "../../mise-en-page";
import { FondIV } from "../fond/FondVarie";
import { EnteteVarie } from "../entete/EnteteVarie";
import { enteteA, fondSceneA, hautCadreDe, RAIL_45, type SceneCalculee } from "../../plan";
import { useVariete } from "../ContexteVariete";
import { donneesToile } from "./donnees";
import { CartesEnAttente, PointSurLeFil } from "./point";
import { VueSilhouette } from "./silhouette";

/** Transformation d'écran qui fait passer l'image filmée par `ref` à celle filmée par `pose` (pixels de 1080 × 1920). */
export function recadrage(ref: PoseCamera, pose: PoseCamera): { s: number; tx: number; ty: number } {
  const s = pose.zoom / ref.zoom;
  return { s, tx: (ECRAN_IV.largeur / 2) * (1 - s) + (ref.cx - pose.cx) * pose.zoom, ty: (ECRAN_IV.hauteur / 2) * (1 - s) + (ref.cy - pose.cy) * pose.zoom };
}

export function CalqueCamera({ children }: { children: ReactNode }) {
  const variete = useVariete();
  const d = donneesToile(variete?.donnees.camera);
  const scene = variete?.scene as SceneCalculee | undefined;
  const { fps, width, height } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  if (!d || !scene) return <>{children}</>;
  const pose = cameraA({ images: d.trajectoire }, t);
  const r = recadrage(cameraA(scene.trajectoire, t), pose);
  const identique = Math.abs(r.s - 1) < 1e-6 && Math.abs(r.tx) < 0.05 && Math.abs(r.ty) < 0.05;
  const vue = d.code === "CAM-B" && d.vue && t < d.vue.fin ? d.vue : null;
  const opaciteVue = vue ? 1 - Math.max(0, Math.min(1, (t - (vue.fin - 0.15)) / 0.15)) : 0;
  const entete = enteteA({ entetes: d.entetes }, t);
  // La marque et l'en-tête sont reposés, fixes, au-dessus de la scène recadrée ; dessous, la scène s'efface comme sous
  // un en-tête (`masqueToile`), ou seulement autour de la marque.
  // Ligne du cadre du FORMAT (4:5 : sous l'en-tête remonté) ; la scène ne pose plus son propre en-tête (Compositions).
  const haut = entete ? hautCadreDe(height) * height : 0.1 * height;
  // 4:5 : en plus, le fondu bas du format (comme `masqueToile`) : la scène recadrée s'efface avant la bande des sous-titres.
  const m4x5 = miseEnPageDeHauteurIV(height);
  const bas = m4x5.format === "4:5" ? `, #000 ${Math.max(m4x5.zoneUtile.bas * height, ((RAIL_45.haut + RAIL_45.hauteur) * width) / ECRAN_IV.largeur)}px, transparent ${m4x5.bandeSousTitres.haut * height}px` : "";
  const masque = `linear-gradient(to bottom, transparent 0, transparent ${haut - FONDU_CADRE * height}px, #000 ${haut}px${bas})`;
  const echelle = width / ECRAN_IV.largeur;
  // Pendant une vue d'ensemble, le plan est ivoire dans la ligne de temps (sous-titres à l'encre sombre) : fond ivoire aussi.
  const fondCam = fondSceneA({ fond: d.fond, ensembles: [...(variete?.ensembles ?? d.ensembles ?? [])] }, t);
  return (
    <AbsoluteFill>
      {identique ? (
        children
      ) : (
        <>
          <FondIV fond={fondCam} largeur={width} hauteur={height} />
          <AbsoluteFill style={{ maskImage: masque, WebkitMaskImage: masque }}>
            <AbsoluteFill style={{ transform: `translate(${r.tx * echelle}px, ${r.ty * echelle}px) scale(${r.s})`, transformOrigin: "0 0" }}>{children}</AbsoluteFill>
          </AbsoluteFill>
        </>
      )}
      {d.code === "CAM-C" ? <CartesEnAttente scene={scene} icones={d.icones ?? {}} ensembles={d.ensembles ?? []} t={t} largeur={width} /> : null}
      {d.code === "CAM-C" ? <PointSurLeFil scene={scene} courses={d.courses ?? []} pose={pose} t={t} largeur={width} /> : null}
      {vue ? <VueSilhouette scene={scene} noeud={vue.noeud} icone={vue.icone} fin={vue.fin} t={t} haut={entete ? hautCadreDe(ECRAN_IV.hauteur) * ECRAN_IV.hauteur : 260} largeur={width} hauteur={height} /> : null}
      {/* Toujours posé ici : la scène filmée par CAM-B ou CAM-C n'a pas d'en-tête à elle (un seul titre à l'écran). */}
      <EnteteVarie entete={entete?.entete ?? null} ecoule={entete?.ecoule ?? 0} sortie={entete?.sortie ?? 0} fond={opaciteVue > 0.5 ? "sombre" : fondCam} marque="axion-ia.com" largeur={width} hauteur={height} />
    </AbsoluteFill>
  );
}
