/**
 * Polices des sous-titres, chargées EN LOCAL dans Remotion (aucune dépendance réseau au rendu, B.5) : les mêmes
 * fichiers que l'aperçu du navigateur (`src/briques/sous-titres/polices/`, licence SIL OFL 1.1).
 * Le rendu attend leur chargement (`delayRender`) : jamais une image avec une police de secours.
 */
import { continueRender, delayRender } from "remotion";
import type { NomPolice } from "../../../src/briques/sous-titres/mesure";
import manropeExtraBold from "../../../src/briques/sous-titres/polices/Manrope-ExtraBold.ttf";
import manropeMedium from "../../../src/briques/sous-titres/polices/Manrope-Medium.ttf";

/** Nom CSS de chaque police dans le rendu (une famille par fichier : aucune synthèse de graisse). */
export const FAMILLES: Record<NomPolice, string> = {
  "Manrope ExtraBold": "Axion Manrope ExtraBold",
  "Manrope Medium": "Axion Manrope Medium",
};

const FICHIERS: Record<NomPolice, string> = {
  "Manrope ExtraBold": manropeExtraBold,
  "Manrope Medium": manropeMedium,
};

let chargement: Promise<void> | null = null;

/** Charge les deux graisses de Manrope une fois par page de rendu. */
export function chargerPolices(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Polices des sous-titres");
  chargement = Promise.all(
    (Object.keys(FICHIERS) as NomPolice[]).map(async (nom) => {
      const face = new FontFace(FAMILLES[nom], `url(${FICHIERS[nom]})`);
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => continueRender(attente));
}
