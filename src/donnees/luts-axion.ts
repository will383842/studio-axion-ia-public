/**
 * LES 4 LUT « AXION BUFFER » (lot M4 ; décision de Will du 01/10 soir, `luts/A-INTEGRER-DANS-LE-STUDIO.md`).
 * Fichiers `.cube` de 65 points, déjà fabriqués par `outils/lut/generateur-lut-buffer.py` et contrôlés par
 * `outils/lut/qc.py` (test : `tests/luts.test.ts`). Une par usage :
 *   - Clair-obscur : DÉFAUT du format avocat (`lut-avocat-v1`, identifiant gardé, versionné) ;
 *   - Naturel : défaut du selfie (lumière du jour, téléphone) ;
 *   - Doux : images déjà claires, décors clairs (conseillée sur N5 / N6) ;
 *   - Nuit : plus sombre, plus contrastée, au choix.
 * « Sans LUT » reste toujours possible (`LUT_AUCUNE`). Une seule source pour la migration au démarrage (étape 10),
 * la démonstration et les tests. PUR.
 */
import type { ElementBibliotheque, Fichier, Licence } from "@/domaine/types";
import { LUT_AVOCAT } from "./elements-avocat";

/** Choix « Sans LUT » d'une vidéo (`StylesChoisis.lutId`) : aucune couleur ajoutée, même pas celle du visage. */
export const LUT_AUCUNE = "aucune";

export interface DefinitionLutAxion {
  id: string;
  nom: string;
  /** Fichier sous `public/luts/` (servi tel quel, compressé à l'envoi). */
  fichier: string;
  taille: 65;
  intensiteParDefaut: number;
  /** Formats dont c'est le défaut. */
  formats: string[];
  motsCles: string[];
  /** Image « après » de la démonstration (vignette avant / après). */
  apresDemo: string;
}

export const LUTS_AXION: DefinitionLutAxion[] = [
  { id: "lut-avocat-v1", nom: "Axion clair-obscur (v1)", fichier: "axion-buffer-clair-obscur.cube", taille: 65, intensiteParDefaut: 70, formats: ["avocat"], motsCles: LUT_AVOCAT.motsCles, apresDemo: "/demo/lut/axion-chaud.jpg" },
  { id: "lut-axion-naturel", nom: "Axion naturel", fichier: "axion-buffer-naturel.cube", taille: 65, intensiteParDefaut: 60, formats: ["selfie"], motsCles: ["couleurs", "étalonnage", "naturel", "lumière du jour", "selfie"], apresDemo: "/demo/lut/neutre.jpg" },
  { id: "lut-axion-doux", nom: "Axion doux", fichier: "axion-buffer-doux.cube", taille: 65, intensiteParDefaut: 70, formats: [], motsCles: ["couleurs", "étalonnage", "doux", "clair"], apresDemo: "/demo/lut/axion-chaud.jpg" },
  { id: "lut-axion-nuit", nom: "Axion nuit", fichier: "axion-buffer-nuit.cube", taille: 65, intensiteParDefaut: 70, formats: [], motsCles: ["couleurs", "étalonnage", "nuit", "contrasté"], apresDemo: "/demo/lut/cinema.jpg" },
];

const PROPRIETE: Licence = { type: "propriete", usageCommercial: true, reseaux: [] };

/** Identifiant du fichier `.cube` d'une LUT Axion (stable : la migration le retrouve). */
export function idFichierLut(def: Pick<DefinitionLutAxion, "fichier">): string {
  return `f-luts-${def.fichier.replace(/\.cube$/, "")}`;
}

const idImage = (cle: string) => "f-" + cle.replace(/^\/demo\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");

/** Fichiers des 4 LUT (et des images avant / après de démonstration, si elles manquent). */
export function fichiersLutsAxion(maintenant: string): Fichier[] {
  const cubes: Fichier[] = LUTS_AXION.map((l) => ({
    id: idFichierLut(l),
    cleStockage: `/luts/${l.fichier}`,
    nom: l.fichier,
    mime: "application/octet-stream",
    taille: 7_414_981,
    origine: "demo",
    statut: "pret",
    creeLe: maintenant,
    modifieLe: maintenant,
  }));
  const images = [...new Set(["/demo/lut/avant.jpg", ...LUTS_AXION.map((l) => l.apresDemo)])].map(
    (cle): Fichier => ({ id: idImage(cle), cleStockage: cle, nom: cle.split("/").pop() ?? cle, mime: "image/jpeg", taille: 60_000, largeur: 960, hauteur: 540, origine: "demo", statut: "pret", creeLe: maintenant, modifieLe: maintenant }),
  );
  return [...cubes, ...images];
}

/** Les 4 éléments `lut` de la Bibliothèque (versionnés : `version` 1). */
export function elementsLutsAxion(maintenant: string): ElementBibliotheque[] {
  return LUTS_AXION.map((l) => ({
    id: l.id,
    type: "lut",
    nom: l.nom,
    motsCles: l.motsCles,
    version: 1,
    valeur: { type: "lut", formatFichier: "cube", tailleCube: l.taille, intensiteParDefaut: l.intensiteParDefaut, avantFichierId: idImage("/demo/lut/avant.jpg"), apresFichierId: idImage(l.apresDemo) },
    fichierId: idFichierLut(l),
    vignetteFichierId: idImage(l.apresDemo),
    licence: PROPRIETE,
    formatsParDefaut: l.formats,
    marqueId: "marque-axion",
    creeLe: maintenant,
    modifieLe: maintenant,
  }));
}
