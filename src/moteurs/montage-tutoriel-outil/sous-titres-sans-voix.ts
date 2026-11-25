/**
 * SOUS-TITRES DU TUTORIEL SANS VOIX COMPOSÉ (lot qualité 25-11, QUAL-5) — PUR, 0 €.
 * Règle : en sans voix, les sous-titres vivent SEULS dans la bande que la grammaire leur réserve (aucune scène n'y
 * entre) : base `minimal`, intensité `sobre` (aucun Impact, Bandeau ni inclinaison), 3 à 6 mots par groupe, texte noir
 * sur une bande de fond gris charte opaque, mot actif terracotta. Tout passe par les paramètres EXISTANTS de
 * `src/briques/sous-titres` (aucun fichier de cette brique n'est modifié).
 */
import { donneesCalque, positionsVerticales, type DonneesCalque } from "../../briques/sous-titres";
import type { BaseSousTitres, IntensiteSousTitres, Ratio, SegmentSousTitres, ValeurStyleSousTitres } from "../../domaine/types";

/** Couleurs de la charte (src/briques/jetons-motion.ts CHARTE_AXION) : noir, terracotta, ivoire, gris. */
export const COULEURS_SANS_VOIX = { texte: "#141413", accent: "#B23F16", contour: "#FAF9F5", bande: "#E8E6DC" } as const;

/** Largeur maximale d'une ligne, en % de la largeur de l'image. */
export const LARGEUR_MAX_SANS_VOIX_PCT = 90;

/** Bande réservée (grammaire B1) : de `basPct − 9` à `basPct + 6` % de la hauteur (≈ 202 px sur 1350, centre 87 %). */
export const BANDE_SANS_VOIX_PCT = { avantPct: 9, apresPct: 6 } as const;

/** La bande de fond va jusqu'au bas de l'image seulement si cela ajoute au plus ce pourcentage de la hauteur. */
export const BANDE_BAS_MAX_PCT = 8;

/** Centre vertical de la bande des sous-titres (« bas » du registre des réseaux) pour un ratio, en % de la hauteur. */
export function basPctSansVoix(ratio: Ratio): number {
  return positionsVerticales(ratio, []).basPct;
}

/** Style fourni à `fabriquerSousTitres` / `donneesCalque` : en bas, au centre de la bande, 90 % de large. */
export function styleSansVoix(ratio: Ratio, basPct = basPctSansVoix(ratio)): ValeurStyleSousTitres {
  return {
    type: "style-sous-titres",
    police: "Manrope",
    tailleRelative: 1,
    motsParLigne: 6,
    motsParLigneMin: 3,
    casse: "normale",
    animation: "aucune",
    couleurAccent: "orange",
    position: "bas",
    positionPct: basPct,
    largeurMaxPct: LARGEUR_MAX_SANS_VOIX_PCT,
  };
}

/** Options du calage des sous-titres en sans voix (à passer à `fabriquerSousTitres`). */
export function optionsSousTitresSansVoix(ratio: Ratio): { style: ValeurStyleSousTitres; base: BaseSousTitres; intensite: IntensiteSousTitres } {
  return { style: styleSansVoix(ratio), base: "minimal", intensite: "sobre" };
}

/** Aucun accent : position « auto » (donc le centre de la bande), pas d'inclinaison, style « base », pas de soulignement ni d'importance. */
export function normaliserSegments(segments: SegmentSousTitres[]): SegmentSousTitres[] {
  return segments.map((s) => {
    const reste: SegmentSousTitres = { ...s };
    delete reste.importance;
    return { ...reste, position: "auto", inclinaison: 0, style: "base", souligne: null };
  });
}

/** Calque de sous-titres du tutoriel sans voix : segments normalisés, couleurs charte, bande de fond gris opaque. */
export function calqueSansVoix(entree: { segments: SegmentSousTitres[]; ratio: Ratio; basPct?: number; dureeMs?: number }): DonneesCalque {
  const basPct = entree.basPct ?? basPctSansVoix(entree.ratio);
  // La bande grise reste jusqu'à la dernière image : le dernier groupe se prolonge jusqu'à la fin du plan (sinon la bande fond après lui).
  const segments = normaliserSegments(entree.segments);
  const dernier = segments.at(-1);
  if (dernier && entree.dureeMs !== undefined && entree.dureeMs / 1000 > dernier.finSec) segments[segments.length - 1] = { ...dernier, finSec: entree.dureeMs / 1000 };
  const calque = donneesCalque({
    segments,
    base: "minimal",
    ratio: entree.ratio,
    style: styleSansVoix(entree.ratio, basPct),
    // Contour (= teinte de l'ombre douce du style « minimal ») : le gris de la bande, donc invisible sur elle.
    couleurs: { texte: COULEURS_SANS_VOIX.texte, accent: COULEURS_SANS_VOIX.accent, contour: COULEURS_SANS_VOIX.bande },
  });
  const { largeur, hauteur } = calque;
  const yPx = Math.round(((basPct - BANDE_SANS_VOIX_PCT.avantPct) / 100) * hauteur);
  // La bande ne descend jusqu'au bas de l'image que si cela ajoute au plus 8 % de la hauteur ; sinon (9:16) elle garde sa hauteur normale.
  const finNormalePx = Math.round(((basPct + BANDE_SANS_VOIX_PCT.apresPct) / 100) * hauteur);
  const jusquAuBas = hauteur - finNormalePx <= (BANDE_BAS_MAX_PCT / 100) * hauteur;
  const hauteurBandePx = jusquAuBas ? hauteur - yPx : Math.min(hauteur, finNormalePx) - yPx;
  return {
    ...calque,
    // Texte et bande lisibles à toute largeur : l'échelle suit le petit côté (60 px sur 1080), jamais la largeur du 16:9.
    echelleTexte: Math.min(largeur, hauteur) / 1080,
    // PAS d'`encre` : ce drapeau fait dessiner en Inter Bold (police de titre) ; sans lui, le rendu charge Manrope (Medium,
    // police du style « minimal »). L'ombre du style est de la teinte de la bande : elle ne se voit pas.
    // La bande de fond va de son haut jusqu au bas (ou à basPct+6 si le bas est trop loin, voir ci-dessus) ; le texte reste centré sur basPct.
    bandeFond: { couleur: COULEURS_SANS_VOIX.bande, opacite: 1, xPx: 0, yPx, largeurPx: largeur, hauteurPx: hauteurBandePx, fonduPx: 0 },
  };
}
