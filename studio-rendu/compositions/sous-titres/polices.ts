/**
 * Polices des sous-titres, chargées EN LOCAL dans Remotion (aucune dépendance réseau au rendu, B.5) : les mêmes
 * fichiers que l'aperçu du navigateur (`src/briques/sous-titres/polices/`, licence SIL OFL 1.1).
 * Le rendu attend leur chargement (`delayRender`) : jamais une image avec une police de secours.
 */
import { continueRender, delayRender } from "remotion";
import type { NomPolice } from "../../../src/briques/sous-titres/mesure";
import montserratBlack from "../../../src/briques/sous-titres/polices/Montserrat-Black.ttf";
import poppinsExtraBold from "../../../src/briques/sous-titres/polices/Poppins-ExtraBold.ttf";
import poppinsMedium from "../../../src/briques/sous-titres/polices/Poppins-Medium.ttf";

/** Nom CSS de chaque police dans le rendu (une famille par fichier : aucune synthèse de graisse). */
export const FAMILLES: Record<NomPolice, string> = {
  "Poppins ExtraBold": "Axion Poppins ExtraBold",
  "Poppins Medium": "Axion Poppins Medium",
  "Montserrat Black": "Axion Montserrat Black",
};

const FICHIERS: Record<NomPolice, string> = {
  "Poppins ExtraBold": poppinsExtraBold,
  "Poppins Medium": poppinsMedium,
  "Montserrat Black": montserratBlack,
};

let chargement: Promise<void> | null = null;

/** Charge les trois polices une fois par page de rendu. */
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
