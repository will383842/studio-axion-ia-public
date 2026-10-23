/** Fond d'un écran : dégradé radial de la charte (`sombre` : lueur orangée en bas ; `ivoire` : clair au centre). */
import React from "react";
import { AbsoluteFill } from "remotion";
import type { Fond as NomFond } from "../../../../src/briques/ecrans-motion";
import { couleursDuFond } from "../plans/commun";
import { indiceLueur, styleDuFond } from "../plans/fond-fort";

/**
 * L3c (ajouts seulement, props facultatives) : `lueur` choisit une autre position de la lueur (0 = v4 ; indice pris
 * modulo 5 en sombre, 3 en ivoire) ; `fort` pose le 3ᵉ fond terracotta plein (`plans/fond-fort.ts`). Sans elles (ou
 * lueur 0) : le chemin v4 ci-dessous, inchangé.
 */
export function Fond({ fond, largeur, hauteur, lueur, fort }: { fond: NomFond; largeur: number; hauteur: number; lueur?: number; fort?: boolean }) {
  if (fort || indiceLueur(fond, lueur) !== 0) return <AbsoluteFill style={styleDuFond(fond, largeur, hauteur, { lueur, fort })} />;
  const c = couleursDuFond(fond).degrade;
  const image =
    fond === "sombre"
      ? `radial-gradient(${largeur * 0.83}px ${hauteur * 0.36}px at 50% 78%, ${c.centre} 0%, ${c.milieu} 45%, ${c.bord} 80%)`
      : `radial-gradient(${largeur * 0.93}px ${hauteur * 0.47}px at 50% 45%, ${c.centre} 0%, ${c.milieu} 75%)`;
  return <AbsoluteFill style={{ backgroundColor: c.bord, backgroundImage: image }} />;
}
