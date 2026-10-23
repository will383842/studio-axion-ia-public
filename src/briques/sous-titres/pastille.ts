/**
 * STYLE NOMMÉ « PASTILLE AXION » (tableau « reference/3 », demande de Will du 15/10/2026 : « des sous-titres
 * exceptionnels »). AJOUT PUR à la brique : il ne change aucun des styles du catalogue (Karaoké, Minimal, Impact,
 * Bandeau) ; un calque sans `pastille` se dessine exactement comme avant.
 *
 * Le groupe (2 à 4 mots d'une même phrase, groupement du gabarit Karaoké) est posé dans une pastille arrondie pleine,
 * texte ivoire ; le MOT DIT passe en orange clair (lisible sur le fond sombre) et monte un peu en grossissant à son
 * arrivée ; le groupe entre en fondu court ; ombre très douce sous la pastille ; ni contour ni ombre sur la lettre.
 * PUR, sans aucun import : lu tel quel par Remotion (`studio-rendu`).
 */
export interface StylePastille {
  /** Nom du style (affiché dans les comptes rendus). */
  nom: string;
  /** Fond de la pastille, texte, mot dit. */
  fond: string;
  texte: string;
  motDit: string;
  /** Taille de la lettre pour une image de 1 080 de large (jamais sous `tailleMinPx`). */
  taillePx: number;
  tailleMinPx: number;
  /** Graisse CSS (le rendu charge le fichier de cette graisse). */
  poids: number;
  /** Marges intérieures de la pastille, en part de la largeur de référence (1 080 px). */
  margeY: number;
  margeX: number;
  /** Mot dit : grossissement (≤ 1,06) et montée (em) à son arrivée, en `arriveeMotMs`. */
  zoomMotDit: number;
  /** Ce que le grossissement ajoute au plus de chaque côté du mot (em) : l'espace avec le voisin reste lisible. */
  debordMotDitEm: number;
  monteeMotDitEm: number;
  arriveeMotMs: number;
  /** Entrée du groupe : fondu court (ms). */
  entreeMs: number;
  /** Ombre très douce sous la pastille (px de référence). */
  ombre: { flouPx: number; decalagePx: number; opacite: number };
  /** Espace entre les mots, en em. */
  espaceMotsEm: number;
  /** Bord fin de la pastille (couleur, px de référence) : absent, aucun bord. */
  bord?: { couleur: string; px: number };
}

/**
 * « Pastille Axion » : pastille pleine encre `#110A05` (coins entièrement arrondis), texte ivoire `#F6F1E8` en Inter Bold,
 * mot dit en orange clair `#E8A27F` (teinte de l'orange brûlé `#B44F29` éclaircie pour être lisible sur l'encre),
 * 62 px en 1080 × 1920 (jamais sous 52), marges 1,5 % × 4 % de la largeur, mot dit +5 % (un mot long un peu moins :
 * il ne déborde jamais de plus de 0,06 em de chaque côté) et 4 % d'em plus haut.
 */
export const PASTILLE_AXION: StylePastille = Object.freeze({
  nom: "Pastille Axion",
  fond: "#110A05",
  texte: "#F6F1E8",
  motDit: "#E8A27F",
  taillePx: 62,
  tailleMinPx: 52,
  poids: 700,
  margeY: 0.015,
  margeX: 0.04,
  zoomMotDit: 1.05,
  debordMotDitEm: 0.06,
  monteeMotDitEm: 0.04,
  arriveeMotMs: 140,
  entreeMs: 140,
  ombre: Object.freeze({ flouPx: 18, decalagePx: 6, opacite: 0.18 }),
  espaceMotsEm: 0.3,
}) as StylePastille;

/**
 * « Pastille Axion » sur l'ARDOISE du tableau (critique #291, D1) : l'encre `#110A05` s'y confond avec l'ardoise
 * `#140E09` ; la pastille y est un peu plus claire (`#241912`) et cernée d'un bord fin sable (`#8A7660`, 4,2:1 sur
 * l'ardoise), comme la maquette B. Texte et mot dit inchangés (≥ 4,5:1).
 */
export const PASTILLE_AXION_ARDOISE: StylePastille = Object.freeze({ ...PASTILLE_AXION, nom: "Pastille Axion (ardoise)", fond: "#241912", bord: Object.freeze({ couleur: "#8A7660", px: 2 }) }) as StylePastille;
