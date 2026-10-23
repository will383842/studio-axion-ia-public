import React from "react";
/**
 * TRA-C · balayage orange (maquette `d3-camera-schema-transitions/transitions.tsx`, TraC1) : une bande orange inclinée
 * descend sur l'écran qui part et le couvre (sortie, de plus en plus vite) ; sur l'écran qui arrive, elle poursuit sa
 * course et le révèle (entrée, en ralentissant). À la jointure, l'écran est orange des deux côtés (sous la marque).
 * `avance` 0 → 1. Pixels de l'écran (largeur 1080). Aucun JSX au niveau module.
 */
import { AbsoluteFill } from "remotion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";

/** Pente de la bande : son bord descend de 80 px de droite à gauche (comme la maquette). */
const PENTE = 80;

export function Balayage({ sens, avance, haut, hauteur, largeur }: { sens: "sortie" | "entree"; avance: number; haut: number; hauteur: number; largeur: number }) {
  const u = sens === "sortie" ? avance * avance : 1 - (1 - avance) * (1 - avance);
  const bord = -PENTE + (hauteur + 2 * PENTE) * u;
  const g = bord + PENTE / 2;
  const d = bord - PENTE / 2;
  const forme = sens === "sortie" ? `polygon(0 0, ${largeur}px 0, ${largeur}px ${d}px, 0 ${g}px)` : `polygon(0 ${g}px, ${largeur}px ${d}px, ${largeur}px ${hauteur}px, 0 ${hauteur}px)`;
  return (
    <AbsoluteFill style={{ clipPath: `inset(${haut}px 0 0 0)` }}>
      <AbsoluteFill style={{ background: COULEURS_DUO.orangeVif, clipPath: forme }} />
    </AbsoluteFill>
  );
}
