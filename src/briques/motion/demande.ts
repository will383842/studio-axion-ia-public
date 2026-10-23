/**
 * DEMANDE DE RENDU D'UNE CARTE (brique `motion`) : une carte du catalogue ou une carte sur mesure devient une demande
 * pour l'opération `composition` EXISTANTE de `studio-rendu`, SANS mode : `parametres.composition` = l'identifiant de
 * la composition, `parametres.proprietes` = la carte et sa mise en page. Aucun nouveau contrat, aucune nouvelle file.
 * Le MP4 produit (H.264) se pose ensuite comme un plan d'illustration (plein écran) ou comme la moitié haute d'un
 * écran partagé. PUR, sans alias « @/ ».
 */
import { CATALOGUE_MOTION, COMPOSITION_SUR_MESURE, DUREE_CARTE_SEC } from "./catalogue";
import { FPS_MOTION, type RatioMotion } from "./jetons";
import { verifierSurMesure, type CodeSurMesure } from "./sur-mesure";
import type { CarteModele, DispositionCarte, MiseEnPageCarte, ProprietesCarteMotion, ProprietesCarteSurMesure } from "./types";

/** Taille de l'image de la vidéo par ratio. */
const DIMENSIONS: Record<RatioMotion, { largeur: number; hauteur: number }> = {
  "9:16": { largeur: 1080, hauteur: 1920 },
  "4:5": { largeur: 1080, hauteur: 1350 },
  "1:1": { largeur: 1080, hauteur: 1080 },
};

/** Mise en page d'une carte : plein écran (taille de la vidéo) ou moitié haute (texte en haut, Will en bas). */
export function miseEnPage(ratio: RatioMotion, disposition: DispositionCarte, dureeSec: number): MiseEnPageCarte {
  const v = DIMENSIONS[ratio];
  const d = Math.min(DUREE_CARTE_SEC.max, Math.max(DUREE_CARTE_SEC.min, dureeSec));
  // Moitié haute : la moitié de l'image en 9:16 ; 45 % en 4:5 et 1:1 (proportions 45/55 du plan, reportées).
  const hauteur = disposition === "moitie-haute" ? Math.round((v.hauteur * (ratio === "9:16" ? 0.5 : 0.45)) / 2) * 2 : v.hauteur;
  return { ratio, largeur: v.largeur, hauteur, hauteurVideo: v.hauteur, disposition, fps: FPS_MOTION, images: Math.round(d * FPS_MOTION) };
}

export interface ParametresRenduCarte {
  composition: string;
  proprietes: ProprietesCarteMotion | ProprietesCarteSurMesure;
}

/** Paramètres de l'opération `composition` (sans mode) pour une carte du catalogue. */
export function parametresCarteModele(carte: CarteModele, mp: MiseEnPageCarte): ParametresRenduCarte {
  return { composition: CATALOGUE_MOTION[carte.modele].composition, proprietes: { ...mp, ...carte } as ProprietesCarteMotion };
}

/** Paramètres de l'opération `composition` (sans mode) pour une carte sur mesure (code déjà contrôlé). */
export function parametresCarteSurMesure(code: CodeSurMesure, mp: MiseEnPageCarte): ParametresRenduCarte {
  return { composition: COMPOSITION_SUR_MESURE, proprietes: { ...mp, html: code.html, css: code.css, js: code.js, ...(code.troisD ? { troisD: true } : {}) } };
}

/**
 * Carte prête à rendre, garde-fous compris : une carte sur mesure refusée (`verifierSurMesure`) retombe sur le modèle
 * fixe de repli (plan B.10) ; sans repli, aucune carte (la vidéo sort quand même : « 1 élément non fait »).
 */
export function preparerCarte(
  entree: { carte?: CarteModele; code?: CodeSurMesure; repli?: CarteModele },
  mp: MiseEnPageCarte,
): { parametres: ParametresRenduCarte | null; repli: boolean; erreurs: string[] } {
  if (entree.code) {
    const verdict = verifierSurMesure(entree.code, mp.images / mp.fps, mp.hauteurVideo);
    if (verdict.ok) return { parametres: parametresCarteSurMesure(entree.code, mp), repli: false, erreurs: [] };
    const repli = entree.repli ?? entree.carte;
    return { parametres: repli ? parametresCarteModele(repli, mp) : null, repli: true, erreurs: verdict.erreurs };
  }
  if (entree.carte) return { parametres: parametresCarteModele(entree.carte, mp), repli: false, erreurs: [] };
  return { parametres: null, repli: false, erreurs: ["aucune carte"] };
}
