/**
 * ZONE SÛRE 9:16 des sous-titres v4 (TikTok + Reels + Shorts) — PUR (aucun import : le conteneur de rendu n'importe rien de `src/`).
 * Copie des chiffres de `src/moteurs/montage-facecam-animee/realisateur/catalogue-v4.ts` (qui les dérive de `zoneProtegeeCombinee` de `src/reseaux`) ;
 * test d'égalité : `tests/facecam-animee/zone-sure-sous-titres-v4.test.ts`. Un seul calcul, côté studio comme côté rendu, image par image.
 */
export const ZONE_SURE_916 = Object.freeze({ haut: 0.14, droite: 0.18, bas: 0.30, gauche: 0.06 });
export const DEMI_HAUTEUR_ST = 0.034;
export const BANDE_YEUX: readonly [number, number] = [0.27, 0.36];
export const Y_ST_MAX = 1 - ZONE_SURE_916.bas - DEMI_HAUTEUR_ST;
export const Y_ST_MIN = ZONE_SURE_916.haut + DEMI_HAUTEUR_ST;
export const X_ST_MIN = ZONE_SURE_916.gauche;
export const X_ST_MAX = 1 - ZONE_SURE_916.droite;
const MARGE_AU_DESSUS_YEUX = 0.005;

const surLesYeux = (y: number, d: number) => y - DEMI_HAUTEUR_ST < BANDE_YEUX[1] + d - 1e-9 && y + DEMI_HAUTEUR_ST > BANDE_YEUX[0] + d + 1e-9;

/** Borne un centre voulu dans la zone sûre ; juste AU-DESSUS de la bande des yeux (descente `d`) si le bornage tombe dessus. */
export function placerDansZoneSure(voulu: number, d: number): number {
  const y = Math.min(Y_ST_MAX, Math.max(Y_ST_MIN, voulu));
  if (!surLesYeux(y, d)) return y;
  return Math.max(Y_ST_MIN, BANDE_YEUX[0] + d - MARGE_AU_DESSUS_YEUX - DEMI_HAUTEUR_ST);
}

/** Bord gauche (px) d'un groupe de `largeur` px sur une image de `W` px : centré, décalé vers la gauche s'il déborde la zone sûre (0,06 L → 0,82 L). */
export function bordGaucheSousTitres(largeur: number, W: number): number {
  const centre = Math.min(W / 2, X_ST_MAX * W - largeur / 2);
  return Math.max(X_ST_MIN * W, centre - largeur / 2);
}

/** Largeur maximale (px) d'un groupe de sous-titres : toute la zone sûre horizontale. */
export const largeurMaxSousTitres = (W: number) => (X_ST_MAX - X_ST_MIN) * W;
