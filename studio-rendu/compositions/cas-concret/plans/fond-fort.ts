/**
 * VARIÉTÉ DU FOND (lot L3c) : variantes de la lueur des deux fonds et 3ᵉ fond terracotta PLEIN (« fond fort », maquette
 * validée `FondMaquette` terracotta de `variantes/pieces.tsx`), avec les couleurs de texte qui vont dessus. Lu depuis le
 * `jeu` de l'écran (`fondFort`, `groupeParticules`) ; sans jeu, tout est la v4 exacte (mêmes chaînes de style au
 * caractère près). PUR : ni `remotion` ni React. `commun.ts` n'est pas touché : la surcharge des couleurs vit ici.
 */
import type { Fond, JeuEcran } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, teinte } from "./commun";

/** Vrai si l'écran porte le 3ᵉ fond terracotta plein. */
export const estFort = (jeu: JeuEcran | undefined) => jeu?.fondFort === true;

/** Groupe de particules du jeu (1..5) ; 0 (v4) s'il est absent ou illisible. */
export function groupeDuJeu(jeu: JeuEcran | undefined): number {
  const g = jeu?.groupeParticules;
  return typeof g === "number" && Number.isInteger(g) && g > 0 ? g : 0;
}

/**
 * Géométrie de la lueur (taille de l'ellipse en part de la largeur et de la hauteur, centre en %) : n° 0 = v4 exacte.
 * Sombre : 5 variantes (bas, haut, bas gauche, haut droite, large au centre) ; ivoire : 3 (centre, haut gauche, bas droite).
 */
export const LUEURS = Object.freeze({
  sombre: Object.freeze([
    { l: 0.83, h: 0.36, x: 50, y: 78 },
    { l: 0.9, h: 0.34, x: 50, y: 22 },
    { l: 0.78, h: 0.4, x: 20, y: 70 },
    { l: 0.78, h: 0.4, x: 80, y: 32 },
    { l: 1.1, h: 0.5, x: 50, y: 56 },
  ]),
  ivoire: Object.freeze([
    { l: 0.93, h: 0.47, x: 50, y: 45 },
    { l: 0.9, h: 0.42, x: 30, y: 30 },
    { l: 0.9, h: 0.42, x: 70, y: 66 },
  ]),
});

/** Indice de lueur (pris modulo le nombre de variantes du fond ; négatif ou illisible : 0). */
export function indiceLueur(fond: Fond, lueur: number | undefined): number {
  const n = LUEURS[fond].length;
  if (typeof lueur !== "number" || !Number.isFinite(lueur)) return 0;
  return ((Math.trunc(lueur) % n) + n) % n;
}

/**
 * Style CSS du fond d'un écran. Sans `lueur` ni `fort` (ou lueur 0) : EXACTEMENT celui de la v4 (`socle/Fond.tsx`
 * d'avant L3c). `fort` : dégradé terracotta plein de la maquette validée (la lueur est alors ignorée).
 */
export function styleDuFond(fond: Fond, largeur: number, hauteur: number, options: { lueur?: number; fort?: boolean } = {}): { backgroundColor: string; backgroundImage: string } {
  if (options.fort) {
    const image = `radial-gradient(${(largeur * 1000) / 1080}px ${(hauteur * 1100) / 1920}px at 50% 42%, ${COULEURS_DUO.orangeVif} 0%, ${COULEURS_DUO.orange} 62%, ${teinte(COULEURS_DUO.nuitLueur, 1)} 120%)`;
    return { backgroundColor: COULEURS_DUO.orange, backgroundImage: image };
  }
  const c = couleursDuFond(fond).degrade;
  const i = indiceLueur(fond, options.lueur);
  if (i === 0) {
    // Formules v4, recopiées telles quelles (mêmes opérations : mêmes nombres écrits).
    const image =
      fond === "sombre"
        ? `radial-gradient(${largeur * 0.83}px ${hauteur * 0.36}px at 50% 78%, ${c.centre} 0%, ${c.milieu} 45%, ${c.bord} 80%)`
        : `radial-gradient(${largeur * 0.93}px ${hauteur * 0.47}px at 50% 45%, ${c.centre} 0%, ${c.milieu} 75%)`;
    return { backgroundColor: c.bord, backgroundImage: image };
  }
  const g = LUEURS[fond][i]!;
  const image =
    fond === "sombre"
      ? `radial-gradient(${largeur * g.l}px ${hauteur * g.h}px at ${g.x}% ${g.y}%, ${c.centre} 0%, ${c.milieu} 45%, ${c.bord} 80%)`
      : `radial-gradient(${largeur * g.l}px ${hauteur * g.h}px at ${g.x}% ${g.y}%, ${c.centre} 0%, ${c.milieu} 75%)`;
  return { backgroundColor: c.bord, backgroundImage: image };
}

/** Variante de lueur à passer au composant `Fond` (le groupe de particules tiré) : `{}` sans jeu. */
export function lueurDuJeu(jeu: JeuEcran | undefined): { lueur?: number } {
  const g = groupeDuJeu(jeu);
  return g ? { lueur: g } : {};
}

/** Propriétés facultatives à passer au composant `Fond` (types qui savent porter le fond fort) : `{}` sans jeu (rendu v4 identique). */
export function proprietesFond(jeu: JeuEcran | undefined): { lueur?: number; fort?: true } {
  return { ...lueurDuJeu(jeu), ...(estFort(jeu) ? { fort: true as const } : {}) };
}

/** Couleurs d'un écran (forme de `couleursDuFond`, valeurs élargies en texte). */
export type CouleursEcran = {
  fond: string;
  texte: string;
  accent: string;
  secondaire: string;
  degrade: { centre: string; milieu: string; bord: string };
  marque: string;
  ombre: string;
  lueur: string;
  lueurLarge: string;
};

/** Couleurs du fond fort (maquette validée) : texte ivoire haut, accent nuit, secondaire ivoire, marque blanche, aucune lueur orange. */
export function couleursFortes(): CouleursEcran {
  const transparent = teinte(COULEURS_DUO.nuit, 0);
  return {
    fond: COULEURS_DUO.orange,
    texte: COULEURS_DUO.ivoireHaut,
    accent: COULEURS_DUO.nuit,
    secondaire: COULEURS_DUO.ivoire,
    degrade: { centre: COULEURS_DUO.orangeVif, milieu: COULEURS_DUO.orange, bord: COULEURS_DUO.nuitLueur },
    marque: COULEURS_DUO.blanc,
    ombre: teinte(COULEURS_DUO.nuit, 0.35),
    lueur: transparent,
    lueurLarge: transparent,
  };
}

/** Couleurs d'un écran : celles du fond de la fiche (v4), ou celles du fond fort si le jeu le demande. */
export function couleursDeLEcran(fond: Fond, jeu: JeuEcran | undefined): CouleursEcran {
  return estFort(jeu) ? couleursFortes() : couleursDuFond(fond);
}

/** Couleurs des barres sur le fond fort : « avant » ivoire, texte encre ; « maintenant » nuit, texte ivoire haut. */
export function couleursBarreForte(variante: "avant" | "maintenant") {
  return variante === "maintenant" ? { fond: COULEURS_DUO.nuit, texte: COULEURS_DUO.ivoireHaut } : { fond: COULEURS_DUO.ivoire, texte: COULEURS_DUO.encre };
}
