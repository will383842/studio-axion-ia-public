import React from "react";
/**
 * K02 · Caméra : panoramique et zoom sur la toile, d'après la trajectoire calculée par `trajectoireCamera` (pure :
 * avance 0,2-0,3 s sur le mot, courbe douce, zoom 0,8-1,6, vitesse ≤ 1,2 écran/s, aucun dézoom d'ensemble).
 * Pose les enfants (en pixels de toile) dans l'écran de référence 1080 × 1920, ramené à la taille de la composition.
 */
import type { ReactNode } from "react";
import { cameraA, ECRAN_IV, type TrajectoireCamera } from "../../../src/briques/schema-motion";

export function Camera({ trajectoire, t, largeur, children }: { trajectoire: Pick<TrajectoireCamera, "images">; t: number; largeur: number; children: ReactNode }) {
  const pose = cameraA(trajectoire, t);
  const echelleEcran = largeur / ECRAN_IV.largeur;
  const dx = ECRAN_IV.largeur / 2 - pose.cx * pose.zoom;
  const dy = ECRAN_IV.hauteur / 2 - pose.cy * pose.zoom;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: ECRAN_IV.largeur, height: ECRAN_IV.hauteur, transform: `scale(${echelleEcran})`, transformOrigin: "0 0", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${dx}px, ${dy}px) scale(${pose.zoom})`, transformOrigin: "0 0" }}>{children}</div>
    </div>
  );
}
