import React from "react";
/**
 * Calque « transitions » de la variété (lot CAM-TRA) : la transition principale de la vidéo aux jointures choisies par le
 * moteur (`variete.donnees.transitions`). Sortie dans les `duree` dernières secondes du bloc, entrée dans ses `duree`
 * premières ; la dernière image d'une sortie et la première d'une entrée sont identiques (écran plein, marque visible),
 * donc les blocs rendus séparément puis mis bout à bout se raccordent. Sans données : le contenu tel quel. Aucun JSX au
 * niveau module.
 */
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useVariete } from "../ContexteVariete";
import { Balayage } from "./balayage";
import { donneesTransitions, HAUT_TRANSITION, type SortieTransition } from "./donnees";
import { Plongee } from "./plongee";
import { Raccord } from "./raccord";

function Dessin({ code, sens, avance, sortie, haut, hauteur, largeur }: { code: "TRA-B" | "TRA-C" | "TRA-D"; sens: "sortie" | "entree"; avance: number; sortie?: SortieTransition; haut: number; hauteur: number; largeur: number }) {
  const commun = { sens, avance, haut, hauteur, largeur };
  if (code === "TRA-C") return <Balayage {...commun} />;
  if (code === "TRA-B") {
    const s = sortie?.code === "TRA-B" ? sortie : null;
    return <Raccord {...commun} {...(s ? { x: s.x * (largeur / 1080), y: s.y * (largeur / 1080), r: s.r, posee: !!s.posee } : {})} />;
  }
  return <Plongee {...commun} carte={sortie?.code === "TRA-D" ? sortie.carte : undefined} />;
}

export function CalqueTransitions({ children }: { children: ReactNode }) {
  const variete = useVariete();
  const d = donneesTransitions(variete?.donnees.transitions);
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  if (!d) return <>{children}</>;
  const n = Math.max(1, Math.round(d.duree * fps));
  // Avance comptée en images : 1 sur la DERNIÈRE image de la sortie, 0 sur la PREMIÈRE de l'entrée (jointure identique).
  const sortie = d.sortie && frame >= durationInFrames - n ? (frame - (durationInFrames - n) + 1) / n : null;
  const entree = d.entree && frame < n ? frame / n : null;
  const haut = HAUT_TRANSITION * height;
  return (
    <AbsoluteFill>
      {children}
      {entree !== null && d.entree ? <Dessin code={d.entree.code} sens="entree" avance={entree} haut={haut} hauteur={height} largeur={width} /> : null}
      {sortie !== null && d.sortie ? <Dessin code={d.sortie.code} sens="sortie" avance={sortie} sortie={d.sortie} haut={haut} hauteur={height} largeur={width} /> : null}
    </AbsoluteFill>
  );
}
