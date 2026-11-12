/**
 * Polices des sous-titres pour l'aperçu du navigateur : les MÊMES fichiers que le rendu Remotion (aucune dépendance
 * réseau, licence SIL OFL 1.1), chargés par `FontFace` comme dans `studio-rendu` (lot M4 : `next/font/local`
 * faisait échouer la construction Turbopack de ce composant client). Les fichiers sont émis par la construction
 * (`new URL(…, import.meta.url)`), sans copie dans le dépôt.
 */
import type { NomPolice } from "@/briques/sous-titres";

const FICHIERS: Record<NomPolice, { url: string; poids: string }> = {
  "Manrope ExtraBold": { url: new URL("../../briques/sous-titres/polices/Manrope-ExtraBold.ttf", import.meta.url).href, poids: "800" },
  "Manrope Medium": { url: new URL("../../briques/sous-titres/polices/Manrope-Medium.ttf", import.meta.url).href, poids: "500" },
};

/** Nom CSS de chaque police (une famille par fichier : aucune synthèse de graisse). */
export const FAMILLES_SOUS_TITRES: Record<NomPolice, string> = {
  "Manrope ExtraBold": '"Axion Manrope ExtraBold", sans-serif',
  "Manrope Medium": '"Axion Manrope Medium", sans-serif',
};

let chargement: Promise<void> | null = null;

/** Charge les deux graisses de Manrope une fois par page (navigateur seulement). */
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
