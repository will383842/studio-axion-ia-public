/**
 * Polices des sous-titres pour l'aperçu du navigateur : les MÊMES fichiers que le rendu Remotion (aucune dépendance
 * réseau, licence SIL OFL 1.1), chargés par `FontFace` comme dans `studio-rendu` (lot M4 : `next/font/local`
 * faisait échouer la construction Turbopack de ce composant client). Les fichiers sont émis par la construction
 * (`new URL(…, import.meta.url)`), sans copie dans le dépôt.
 */
import type { NomPolice } from "@/briques/sous-titres";

const FICHIERS: Record<NomPolice, { url: string; poids: string }> = {
  "Manrope Bold": { url: new URL("../../briques/sous-titres/polices/Manrope-Bold.ttf", import.meta.url).href, poids: "700" },
  "Manrope ExtraBold": { url: new URL("../../briques/sous-titres/polices/Manrope-ExtraBold.ttf", import.meta.url).href, poids: "800" },
  "Manrope Medium": { url: new URL("../../briques/sous-titres/polices/Manrope-Medium.ttf", import.meta.url).href, poids: "500" },
  "Manrope SemiBold": { url: new URL("../../briques/sous-titres/polices/Manrope-SemiBold.ttf", import.meta.url).href, poids: "600" },
};

/** Nom CSS de chaque police (une famille par fichier : aucune synthèse de graisse). */
export const FAMILLES_SOUS_TITRES: Record<NomPolice, string> = {
  "Manrope Bold": '"Axion Manrope Bold", sans-serif',
  "Manrope ExtraBold": '"Axion Manrope ExtraBold", sans-serif',
  "Manrope Medium": '"Axion Manrope Medium", sans-serif',
  "Manrope SemiBold": '"Axion Manrope SemiBold", sans-serif',
};

/** Une promesse par police : l'union des demandes est chargée, chaque police une seule fois. */
const chargements = new Map<NomPolice, Promise<void>>();

/** Charge à la demande les graisses voulues (par défaut Medium et ExtraBold) ; ne rejette jamais. */
export function chargerPolicesSousTitres(noms: readonly NomPolice[] = ["Manrope Medium", "Manrope ExtraBold"]): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  for (const nom of noms) {
    if (chargements.has(nom)) continue;
    chargements.set(
      nom,
      (async () => {
        const face = new FontFace(`Axion ${nom}`, `url(${FICHIERS[nom].url})`, { weight: FICHIERS[nom].poids, display: "swap" });
        document.fonts.add(await face.load());
      })().then(
        () => undefined,
        () => undefined,
      ),
    );
  }
  return Promise.all(noms.map((n) => chargements.get(n))).then(() => undefined);
}
