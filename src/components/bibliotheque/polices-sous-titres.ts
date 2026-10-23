/**
 * Polices des sous-titres pour l'aperçu du navigateur : les MÊMES fichiers que le rendu Remotion (aucune dépendance
 * réseau, licence SIL OFL 1.1), chargés par `FontFace` comme dans `studio-rendu` (lot M4 : `next/font/local`
 * faisait échouer la construction Turbopack de ce composant client). Les fichiers sont émis par la construction
 * (`new URL(…, import.meta.url)`), sans copie dans le dépôt.
 */
import type { NomPolice } from "@/briques/sous-titres";

const FICHIERS: Record<NomPolice, { url: string; poids: string }> = {
  "Poppins ExtraBold": { url: new URL("../../briques/sous-titres/polices/Poppins-ExtraBold.ttf", import.meta.url).href, poids: "800" },
  "Poppins Medium": { url: new URL("../../briques/sous-titres/polices/Poppins-Medium.ttf", import.meta.url).href, poids: "500" },
  "Montserrat Black": { url: new URL("../../briques/sous-titres/polices/Montserrat-Black.ttf", import.meta.url).href, poids: "900" },
};

/** Nom CSS de chaque police (une famille par fichier : aucune synthèse de graisse). */
export const FAMILLES_SOUS_TITRES: Record<NomPolice, string> = {
  "Poppins ExtraBold": '"Axion Poppins ExtraBold", sans-serif',
  "Poppins Medium": '"Axion Poppins Medium", sans-serif',
  "Montserrat Black": '"Axion Montserrat Black", sans-serif',
};

let chargement: Promise<void> | null = null;

/** Charge les trois polices une fois par page (navigateur seulement). */
export function chargerPolicesSousTitres(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  chargement ??= Promise.all(
    (Object.keys(FICHIERS) as NomPolice[]).map(async (nom) => {
      const face = new FontFace(`Axion ${nom}`, `url(${FICHIERS[nom].url})`, { weight: FICHIERS[nom].poids, display: "swap" });
      document.fonts.add(await face.load());
    }),
  ).then(
    () => undefined,
    () => undefined,
  );
  return chargement;
}
