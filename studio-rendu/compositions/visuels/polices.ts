/**
 * Polices des visuels de carrousels, chargées EN LOCAL dans Remotion (aucune dépendance réseau au rendu) :
 * - Archivo Black (SIL OFL 1.1) : titres ;
 * - JetBrains Mono (SIL OFL 1.1, fichier variable 100–800) : données et légendes.
 * Sources : dépôt google/fonts, commit 47d54ca1ebb14fd864695f1d39dc734f39017c33 (licences : OFL-*.txt, à côté des fichiers).
 * Le rendu attend le chargement (jamais une image avec une police de secours).
 */
import { continueRender, delayRender } from "remotion";
import archivoBlack from "../commune/polices/ArchivoBlack-Regular.ttf";
import jetBrainsMono from "../commune/polices/JetBrainsMono-Variable.ttf";

export const FAMILLE_ARCHIVO_BLACK = "Axion Archivo Black";

let chargementArchivoBlack: Promise<void> | null = null;

export function chargerPoliceArchivoBlack(): void {
  if (chargementArchivoBlack || typeof document === "undefined") return;
  const attente = delayRender("Police Archivo Black");
  const face = new FontFace(FAMILLE_ARCHIVO_BLACK, `url(${archivoBlack})`, { weight: "400" });
  chargementArchivoBlack = face.load().then((f) => {
    document.fonts.add(f);
    continueRender(attente);
  });
}

export const FAMILLE_JETBRAINS_MONO = "Axion JetBrains Mono";

let chargementJetBrainsMono: Promise<void> | null = null;

export function chargerPoliceJetBrainsMono(): void {
  if (chargementJetBrainsMono || typeof document === "undefined") return;
  const attente = delayRender("Police JetBrains Mono");
  const face = new FontFace(FAMILLE_JETBRAINS_MONO, `url(${jetBrainsMono})`, { weight: "100 800" });
  chargementJetBrainsMono = face.load().then((f) => {
    document.fonts.add(f);
    continueRender(attente);
  });
}
