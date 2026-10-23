/**
 * MISE EN PAGE DES MINIATURES (lot R4, 03/10) — PURE, testée par le studio (`tests/r4-miniatures.test.ts`).
 * Ce qu'un graphiste ferait à la main, en règles :
 *   - taille de l'image selon le format (1080 × 1920 en vertical, 1280 × 720 en 16:9) ;
 *   - ZONE SÛRE : en vertical, le titre reste dans le 1080 × 1350 du milieu (grille d'un profil Instagram en 4:5,
 *     TikTok et Shorts en 3:4) et loin des boutons et de la légende du bas ; en 16:9, à gauche (le coin bas droit
 *     porte la durée sur YouTube) ;
 *   - titre en capitales, coupé en 1 à 4 lignes de façon à être le PLUS GRAND possible, sans mot seul en bout de
 *     ligne quand on peut l'éviter, sans jamais déborder (largeur mesurée avec la vraie police).
 * La mesure de la largeur est injectée (le navigateur de Remotion mesure avec la police chargée ; les tests, une
 * approximation).
 */

export type RatioMiniature = "9:16" | "4:5" | "1:1" | "16:9";

export interface Cadre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/**
 * Trois mises en page, toutes dans la MOITIÉ BASSE de la zone sûre : le visage (haut du cadre) reste visible.
 *   « bas » : titre blanc sur un dégradé sombre, mot mis en valeur en orange, trait orange SOUS le titre ;
 *   « étiquettes » : chaque ligne sur un bloc blanc (comme l'encadré des vidéos), mot mis en valeur en orange ;
 *   « bandeau » : une bande orange d'Axion d'un bord à l'autre, titre clair, mot mis en valeur en foncé sur une
 *   pastille crème (lisible sans dépendre de la seule couleur).
 */
export const VARIANTES_MINIATURE = ["bas", "etiquettes", "bandeau"] as const;
export type VarianteMiniature = (typeof VARIANTES_MINIATURE)[number];

export function varianteMiniature(n: unknown): VarianteMiniature {
  const i = Math.abs(Math.floor(Number(n) || 0)) % VARIANTES_MINIATURE.length;
  return VARIANTES_MINIATURE[i];
}

/** Couleurs d'Axion (jetons du studio, `src/app/globals.css`). */
export const COULEURS_MINIATURE = {
  fond: "#16120F",
  texte: "#FFFFFF",
  creme: "#F3EDE4",
  orangeVif: "#E07040",
  orange: "#B4512A",
  surOrange: "#FFF6EC",
} as const;

export interface FormatMiniature {
  ratio: RatioMiniature;
  largeur: number;
  hauteur: number;
  /** Ce qui reste visible partout (grilles, recadrages) : le titre n'en sort jamais. */
  zoneSure: Cadre;
  /** Où le titre peut se poser (zone sûre moins les marges et les zones d'interface). */
  zoneTitre: Cadre;
}

export function ratioMiniature(r: unknown): RatioMiniature {
  return r === "16:9" || r === "4:5" || r === "1:1" ? r : "9:16";
}

/** Dimensions, zone sûre et zone du titre d'un format. PUR. */
export function formatMiniature(ratio: RatioMiniature): FormatMiniature {
  if (ratio === "16:9") {
    // YouTube : la durée occupe le coin bas droit ; le titre vit dans les 60 % de gauche.
    const zoneSure = { x: 0, y: 0, largeur: 1280, hauteur: 720 };
    return { ratio, largeur: 1280, hauteur: 720, zoneSure, zoneTitre: { x: 64, y: 72, largeur: 700, hauteur: 520 } };
  }
  if (ratio === "4:5" || ratio === "1:1") {
    const hauteur = ratio === "4:5" ? 1350 : 1080;
    return { ratio, largeur: 1080, hauteur, zoneSure: { x: 0, y: 0, largeur: 1080, hauteur }, zoneTitre: { x: 80, y: 80, largeur: 920, hauteur: hauteur - 160 } };
  }
  // 9:16 : zone sûre 1080 × 1350 au milieu (y 285 → 1635) ; marges de 80 px à gauche et à droite.
  const zoneSure = { x: 0, y: 285, largeur: 1080, hauteur: 1350 };
  return { ratio, largeur: 1080, hauteur: 1920, zoneSure, zoneTitre: { x: 80, y: 285 + 70, largeur: 920, hauteur: 1350 - 140 } };
}

/** Une « unité » ne se coupe jamais : un mot, avec sa ponctuation ou son symbole collés (« 135 € », « PV ? »). */
export function unitesCouverture(texte: string): string[] {
  // Apostrophe typographique (’) : c'est elle qu'un graphiste pose sur une couverture.
  const jetons = texte.replace(/\s+/g, " ").trim().replace(/'/g, "’").toLocaleUpperCase("fr-FR").split(" ").filter(Boolean);
  const unites: string[] = [];
  for (const j of jetons) {
    if (unites.length && /^[^\p{L}\p{N}]+$/u.test(j)) unites[unites.length - 1] += ` ${j}`;
    else unites.push(j);
  }
  return unites;
}

const sansAccents = (m: string) =>
  m
    .replace(/’/g, "'")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}€%']/gu, "");

/** L'unité fait-elle partie du mot mis en valeur ? (« L'ERREUR » et motCle « erreur » : oui). */
export function estMotCle(unite: string, motCle: string | undefined): boolean {
  if (!motCle?.trim()) return false;
  const cibles = new Set(motCle.split(/\s+/).map(sansAccents).filter(Boolean));
  return unite.split(/\s| /).some((m) => {
    const n = sansAccents(m);
    return !!n && (cibles.has(n) || cibles.has(n.replace(/^[a-z]{1,2}'/, "")));
  });
}

export interface MiseEnPageTitre {
  lignes: string[][];
  taillePx: number;
}

export interface ContraintesTitre {
  largeurMax: number;
  hauteurMax: number;
  tailleMax: number;
  tailleMin: number;
  /** Hauteur d'une ligne en multiple de la taille. */
  interligne: number;
  /** Espace horizontal ajouté à chaque ligne (étiquettes : marges intérieures). */
  margeLigne?: number;
  /** Marge au-dessus et au-dessous du bloc, en multiple de la taille (bandeau). */
  margeVerticale?: number;
  lignesMax?: number;
}

/** Hauteur du bloc de titre (lignes et marges). PUR. */
export function hauteurBlocTitre(nbLignes: number, taillePx: number, c: ContraintesTitre): number {
  return nbLignes ? (nbLignes * c.interligne + 2 * (c.margeVerticale ?? 0)) * taillePx : 0;
}

/** Toutes les façons de répartir `n` unités sur `k` lignes, dans l'ordre. */
function repartitions(n: number, k: number): number[][] {
  if (k === 1) return [[n]];
  const sortie: number[][] = [];
  for (let premier = 1; premier <= n - k + 1; premier++) for (const reste of repartitions(n - premier, k - 1)) sortie.push([premier, ...reste]);
  return sortie;
}

/**
 * Coupe le titre en lignes pour qu'il soit le PLUS GRAND possible dans la zone, sans déborder. `mesurer(texte, taille)`
 * renvoie la largeur en pixels. À taille égale : moins de lignes ; un mot très court seul sur sa ligne est évité ;
 * des lignes de longueurs proches sont préférées. PUR.
 */
export function mettreEnPageTitre(unites: string[], mesurer: (texte: string, taillePx: number) => number, c: ContraintesTitre): MiseEnPageTitre {
  if (!unites.length) return { lignes: [], taillePx: c.tailleMax };
  const marge = c.margeLigne ?? 0;
  const lignesMax = Math.min(c.lignesMax ?? 4, unites.length);
  const candidats: { mise: MiseEnPageTitre; score: number }[] = [];
  for (let k = 1; k <= lignesMax; k++) {
    for (const parts of repartitions(unites.length, k)) {
      const lignes: string[][] = [];
      let i = 0;
      for (const n of parts) {
        lignes.push(unites.slice(i, i + n));
        i += n;
      }
      // Largeur à 100 px, puis taille qui tient en largeur ET en hauteur.
      const largeurs = lignes.map((l) => mesurer(l.join(" "), 100) / 100);
      const plusLarge = Math.max(...largeurs);
      const taille = Math.max(1, Math.floor(Math.min(c.tailleMax, (c.largeurMax - marge) / Math.max(plusLarge, 0.01), c.hauteurMax / (k * c.interligne + 2 * (c.margeVerticale ?? 0)))));
      const equilibre = Math.min(...largeurs) / Math.max(plusLarge, 0.01);
      const veuve = k > 1 && lignes.some((l) => l.length === 1 && l[0].replace(/[^\p{L}\p{N}]/gu, "").length <= 3);
      // Une seule ligne très étirée lit mal en vertical : léger avantage aux blocs compacts dès 3 mots.
      const etire = k === 1 && unites.length >= 3 ? 0.93 : 1;
      const score = taille * Math.pow(Math.max(equilibre, 0.05), 0.18) * (veuve ? 0.82 : 1) * etire - k * 0.01;
      candidats.push({ mise: { lignes, taillePx: taille }, score });
    }
  }
  // Jamais sous la taille minimale si une autre coupe l'évite ; sinon (titre trop long) la plus grande qui tient.
  const lisibles = candidats.filter((x) => x.mise.taillePx >= c.tailleMin);
  const parmi = lisibles.length ? lisibles : candidats;
  return parmi.reduce((a, b) => (b.score > a.score ? b : a)).mise;
}

/** Place réservée SOUS le titre « bas » pour son trait orange (jamais posé sur l'image ni sur le titre). */
export const TRAIT_BAS_PX = 44;

/** Centre visé du bloc, en part de la hauteur de la zone du titre (vertical : sous le visage). */
const CENTRE_VISE: Record<VarianteMiniature, number> = { bas: 1, etiquettes: 0.68, bandeau: 0.72 };
/** Le bloc ne remonte jamais au-dessus de cette part de la zone (le visage). */
const HAUT_MIN = 0.4;

/** Position du bloc de titre dans la zone du titre selon la mise en page. PUR. */
export function placementTitre(f: FormatMiniature, variante: VarianteMiniature, hauteurBloc: number): { haut: number } {
  const z = f.zoneTitre;
  // « bas » : la place du trait (sous le titre) est réservée dans la zone, en vertical comme en 16:9.
  const reserve = variante === "bas" ? TRAIT_BAS_PX * (f.largeur / 1080) : 0;
  if (f.ratio === "16:9") return { haut: Math.round(z.y + (z.hauteur - hauteurBloc - reserve) / 2) };
  const bas = z.y + z.hauteur - hauteurBloc - reserve;
  const vise = variante === "bas" ? bas : z.y + z.hauteur * CENTRE_VISE[variante] - hauteurBloc / 2;
  return { haut: Math.round(Math.max(z.y, Math.min(bas, Math.max(z.y + z.hauteur * HAUT_MIN, vise)))) };
}

/** Contraintes de taille du titre selon le format et la mise en page. PUR. */
export function contraintesTitre(f: FormatMiniature, variante: VarianteMiniature): ContraintesTitre {
  const etiquettes = variante === "etiquettes";
  const bandeau = variante === "bandeau";
  const commun = { interligne: etiquettes ? 1.32 : 1.02, margeLigne: etiquettes ? 64 : 0, margeVerticale: bandeau ? 0.3 : 0, lignesMax: 4 };
  if (f.ratio === "16:9") return { largeurMax: f.zoneTitre.largeur, hauteurMax: f.zoneTitre.hauteur, tailleMax: 132, tailleMin: 64, ...commun, margeLigne: etiquettes ? 56 : 0 };
  const hauteurMax = Math.round(f.zoneTitre.hauteur * (f.ratio === "9:16" ? 0.46 : 0.5));
  return { largeurMax: f.zoneTitre.largeur, hauteurMax, tailleMax: 168, tailleMin: 84, ...commun };
}

/** Propriétés de la composition `Miniature` (une image fixe). */
export type ProprietesMiniature = {
  ratio: RatioMiniature;
  /** Adresse de l'image de fond (la plus nette des 5, déjà à la bonne taille). */
  image: string;
  couverture: string;
  motCle?: string;
  variante: VarianteMiniature;
};
