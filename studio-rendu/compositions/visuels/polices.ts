/**
 * Polices des visuels de carrousels, chargées EN LOCAL dans Remotion (aucune dépendance réseau au rendu) :
 * - Archivo Black (SIL OFL 1.1) : titres ;
 * - JetBrains Mono (SIL OFL 1.1, fichier variable 100–800) : données et légendes.
 * Sources : dépôt google/fonts, commit 47d54ca1ebb14fd864695f1d39dc734f39017c33 (licences : OFL-*.txt, à côté des fichiers).
 * Le rendu attend le chargement (jamais une image avec une police de secours).
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import { DELAI_DELAYRENDER_MS } from "./commun/attente-police";
import archivoBlack from "../commune/polices/ArchivoBlack-Regular.ttf";
import jetBrainsMono from "../commune/polices/JetBrainsMono-Variable.ttf";

export const FAMILLE_ARCHIVO_BLACK = "Axion Archivo Black";

let chargementArchivoBlack: Promise<void> | null = null;

export function chargerPoliceArchivoBlack(): void {
  if (chargementArchivoBlack || typeof document === "undefined") return;
  const attente = delayRender("Police Archivo Black", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
  const face = new FontFace(FAMILLE_ARCHIVO_BLACK, `url(${archivoBlack})`, { weight: "400" });
  chargementArchivoBlack = face.load().then(
    (f) => {
      document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police Archivo Black illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargementArchivoBlack.catch(() => undefined);
}

/** Promesse du chargement de la police (lance le chargement si besoin) : sert à l'attendre, sans sonder `document.fonts`. */
export function policeArchivoBlackPrete(): Promise<void> {
  chargerPoliceArchivoBlack();
  return chargementArchivoBlack ?? Promise.resolve();
}

export const FAMILLE_JETBRAINS_MONO = "Axion JetBrains Mono";

let chargementJetBrainsMono: Promise<void> | null = null;

export function chargerPoliceJetBrainsMono(): void {
  if (chargementJetBrainsMono || typeof document === "undefined") return;
  const attente = delayRender("Police JetBrains Mono", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
  const face = new FontFace(FAMILLE_JETBRAINS_MONO, `url(${jetBrainsMono})`, { weight: "100 800" });
  chargementJetBrainsMono = face.load().then(
    (f) => {
      document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police JetBrains Mono illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargementJetBrainsMono.catch(() => undefined);
}

/** Promesse du chargement de la police (lance le chargement si besoin) : sert à l'attendre, sans sonder `document.fonts`. */
export function policeJetBrainsMonoPrete(): Promise<void> {
  chargerPoliceJetBrainsMono();
  return chargementJetBrainsMono ?? Promise.resolve();
}
