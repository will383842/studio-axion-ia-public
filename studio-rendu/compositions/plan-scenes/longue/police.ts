/**
 * Police de la vidéo longue : Manrope variable (poids 200 à 800), fichier local du dépôt, aucune dépendance réseau.
 * Le rendu attend son chargement (`delayRender`) : jamais une image avec une police de secours.
 */
import { continueRender, delayRender } from "remotion";
import manrope from "../../../../src/app/polices/manrope-latin.woff2";

export const FAMILLE_LONGUE = "Axion Manrope Longue";

let chargement: Promise<void> | null = null;

export function chargerPoliceLongue(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Police Manrope (vidéo longue)");
  const face = new FontFace(FAMILLE_LONGUE, `url(${manrope})`, { weight: "200 800" });
  chargement = face
    .load()
    .then(() => {
      document.fonts.add(face);
    })
    .finally(() => continueRender(attente));
}
