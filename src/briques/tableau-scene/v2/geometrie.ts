/**
 * GÉOMÉTRIE DU STYLE « blocs/2 » pour un format de sortie : en-tête, fil, barre des étapes, contenu, bande des
 * sous-titres et place du crayon au repos, tous DANS la zone sûre du format (union des réseaux servis, table
 * `src/moteurs/montage-tableau/formats-sortie.ts`). PUR, sans alias « @/ ».
 *
 *  - La bande des sous-titres est prise en bas de la zone sûre ; juste au-dessus, une bande libre où le crayon se
 *    couche (pointe à gauche, corps à droite) : il ne cache jamais un mot.
 *  - Sous la zone sûre (vertical : 20 % du bas, `ZONE_VERTICAL_BLOCS_2`) : seulement le fond et des formes (grand chiffre en contour, carte qui
 *    déborde), jamais un texte.
 *  - Un contenu plus large que haut (carré, horizontal) se dispose côte à côte : titres à gauche, corps à droite.
 *  - Vertical : les titres du haut (au-dessus de 45 % de la hauteur) peuvent prendre plus de largeur à droite
 *    (`hautLarge`) ; la marge des boutons des réseaux (18 %) reste pour tout ce qui est plus bas.
 */
import type { GeometrieV2, RectV2 } from "./types";

/** Marges de la zone sûre en pourcentages (comme `src/reseaux`). */
export interface ZoneSurePct {
  haut: number;
  droite: number;
  bas: number;
  gauche: number;
}

export const REGLAGES_GEOMETRIE_V2 = Object.freeze({
  /** Retrait du contenu dans la zone sûre (px de référence). */
  garde: 16,
  teteHaut: 6,
  teteHauteur: 50,
  filEcart: 10,
  filHauteur: 6,
  barreEcart: 16,
  barreHauteur: 58,
  contenuEcart: 26,
  /** Bande des sous-titres : hauteur visée (px de référence), au plus cette part de la zone sûre. */
  bandeHauteur: 150,
  bandePartMax: 0.2,
  /** Bande libre du crayon couché, au-dessus des sous-titres. */
  repos: 78,
  /** Image du crayon (hauteur, px de référence) : 330 px, couché il fait 330 × 66. */
  crayon: 330,
  /** Rapport largeur ÷ hauteur au-delà duquel le contenu passe côte à côte. */
  coteAuDela: 1.8,
  /**
   * Vertical : marge droite (% de la largeur) des titres du HAUT, tant qu'ils finissent au-dessus de `jusqua` (part de la
   * hauteur). VALEUR PRUDENTE (relecture du 12/10/2026, pas de guide publié) : la colonne de boutons de TikTok (photo de
   * profil, j'aime, commentaires, favoris, partage, disque) commence vers la moitié de la hauteur, celles des Reels et
   * des Shorts plus bas encore ; au-dessus, à droite, il n'y a que les icônes de la barre du haut, déjà dans la marge du
   * haut. 45 % garde environ 5 % de la hauteur (≈ 95 px) avant le début de la colonne ; 6 % est la marge des côtés du guide Meta des Reels. La
   * colonne ne se limite donc PAS au tiers inférieur : sous 45 %, les 18 % restent.
   */
  hautLarge: Object.freeze({ droite: 6, jusqua: 0.45 }),
});

const r = Math.round;

/** Géométrie d'une image `largeur` × `hauteur` dont la zone sûre est `zone`. */
export function geometrieV2(largeur: number, hauteur: number, zone: ZoneSurePct): GeometrieV2 {
  const R = REGLAGES_GEOMETRIE_V2;
  const k = Math.min(largeur, hauteur) / 1080;
  const zx = r((zone.gauche / 100) * largeur);
  const zy = r((zone.haut / 100) * hauteur);
  const zoneSure: RectV2 = { x: zx, y: zy, largeur: largeur - zx - r((zone.droite / 100) * largeur), hauteur: hauteur - zy - r((zone.bas / 100) * hauteur) };
  const garde = r(R.garde * k);
  const x = zoneSure.x + garde;
  const l = zoneSure.largeur - 2 * garde;
  const tete: RectV2 = { x, y: zoneSure.y + r(R.teteHaut * k), largeur: l, hauteur: r(R.teteHauteur * k) };
  const fil: RectV2 = { x, y: tete.y + tete.hauteur + r(R.filEcart * k), largeur: l, hauteur: Math.max(2, r(R.filHauteur * k)) };
  const barre: RectV2 = { x, y: fil.y + fil.hauteur + r(R.barreEcart * k), largeur: l, hauteur: r(R.barreHauteur * k) };
  const bandeH = Math.min(r(R.bandeHauteur * k), r(zoneSure.hauteur * R.bandePartMax));
  const bande: RectV2 = { x: zoneSure.x, y: zoneSure.y + zoneSure.hauteur - bandeH, largeur: zoneSure.largeur, hauteur: bandeH };
  const bas = bande.y - r(R.repos * k);
  const haut = fil.y + fil.hauteur + r(R.contenuEcart * k);
  const hautEtape = barre.y + barre.hauteur + r(R.contenuEcart * k * 0.9);
  const contenu: RectV2 = { x, y: haut, largeur: l, hauteur: bas - haut };
  const contenuEtape: RectV2 = { x, y: hautEtape, largeur: l, hauteur: bas - hautEtape };
  const hauteurCrayon = r(R.crayon * k);
  // Couché, corps à droite (90°) : la pointe à gauche, au milieu de la bande libre ; le corps finit au bord du contenu.
  const repos = { x: r(x + l - hauteurCrayon * 0.98), y: r(bas + (bande.y - bas) / 2), angle: 90 };
  const mode = contenu.largeur / contenu.hauteur > R.coteAuDela ? "cote" : "colonne";
  const droiteLarge = largeur - r((R.hautLarge.droite / 100) * largeur) - garde;
  const titresLarges = hauteur > largeur * 1.5 && droiteLarge > x + l ? { droite: droiteLarge, basMax: r(R.hautLarge.jusqua * hauteur) } : undefined;
  return { largeur, hauteur, k, zoneSure, tete, fil, barre, contenu, contenuEtape, bande, repos, hauteurCrayon, mode, ...(titresLarges ? { titresLarges } : {}) };
}

/** Rectangle dans un autre (bords compris, tolérance d'un demi-pixel). */
export const dansRect = (a: RectV2, b: RectV2) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.largeur <= b.x + b.largeur + 0.5 && a.y + a.hauteur <= b.y + b.hauteur + 0.5;

/** Deux rectangles se recouvrent (au-delà d'une tolérance). */
export const recouvre = (a: RectV2, b: RectV2, tol = 0.5) => a.x + a.largeur > b.x + tol && b.x + b.largeur > a.x + tol && a.y + a.hauteur > b.y + tol && b.y + b.hauteur > a.y + tol;
