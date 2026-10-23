/** Zones recouvertes par la plateforme et bord droit du texte : fonctions PURES (la mesure du DOM réel les applique, `mesure/MesureVisuelPage.tsx`). */
import { BORD_DROIT_TEXTE, FORMAT, MARGE, PAGE, ZONE_COMPTEUR, ZONE_FLECHE } from "./constantes";

export interface Boite {
  gauche: number;
  haut: number;
  droite: number;
  bas: number;
}

export const ZONES_RESERVEES: readonly Boite[] = [
  { gauche: ZONE_FLECHE.gauche, haut: ZONE_FLECHE.haut, droite: FORMAT.largeur, bas: ZONE_FLECHE.bas },
  { gauche: ZONE_COMPTEUR.gauche, haut: ZONE_COMPTEUR.haut, droite: FORMAT.largeur, bas: FORMAT.hauteur },
];

/** Vrai si la boîte recouvre (même d'un pixel) l'une des zones réservées. */
export function boiteEnZoneReservee(b: Boite): boolean {
  return ZONES_RESERVEES.some((z) => b.gauche < z.droite && b.droite > z.gauche && b.haut < z.bas && b.bas > z.haut);
}

/** Largeur maximale (px) d'une colonne de texte qui commence à l'abscisse `xDebut` : elle s'arrête à `bord` (`BORD_DROIT_TEXTE` par défaut). */
export function largeurTexteMax(xDebut: number, bord: number = BORD_DROIT_TEXTE): number {
  return Math.max(0, bord - xDebut);
}

/** Bord droit (px) d'un texte qui peut descendre jusqu'au bas de la page (dernière rangée de cartes) : le compteur de Meta (x ≥ 860, y ≥ 1080) y recouvre l'image. */
export const BORD_DROIT_TEXTE_BAS = ZONE_COMPTEUR.gauche;

/** Boîte de la signature, en bas à gauche du pied de page (`largeur` : largeur de son texte). */
export function boiteSignature(largeur: number): Boite {
  const haut = FORMAT.hauteur - MARGE - PAGE.hauteurPied;
  return { gauche: MARGE, haut, droite: MARGE + largeur, bas: haut + PAGE.hauteurPied };
}

/** Attribut posé sur l'enveloppe d'un dessin de la banque (illustration ou icône) : la mesure du rendu y cherche les chevauchements. */
export const ATTRIBUT_DESSIN = "data-dessin";

/** Part de la hauteur d'une ligne de texte gardée pour la comparaison (bande centrale) : la boîte d'une ligne déborde de son interligne (titres serrés), seul le cœur des lettres compte. */
export const BANDE_TEXTE = 0.6;
/** Recouvrement minimal (px, sur chaque axe) compté comme un chevauchement. */
export const RECOUVREMENT_MIN = 2;

function bande(b: Boite): Boite {
  const marge = ((b.bas - b.haut) * (1 - BANDE_TEXTE)) / 2;
  return { ...b, haut: b.haut + marge, bas: b.bas - marge };
}

function recouvre(a: Boite, b: Boite): boolean {
  return Math.min(a.droite, b.droite) - Math.max(a.gauche, b.gauche) > RECOUVREMENT_MIN && Math.min(a.bas, b.bas) - Math.max(a.haut, b.haut) > RECOUVREMENT_MIN;
}

/**
 * Nombre de chevauchements d'une page : paires de lignes de texte de DEUX textes différents (`groupe`) qui se recouvrent, et lignes de texte
 * posées sur un dessin de la banque. Fonction PURE (la mesure du DOM réel l'applique, `mesure/MesureVisuelPage.tsx`).
 */
export function compterChevauchements(lignes: readonly { boite: Boite; groupe: number }[], dessins: readonly Boite[]): number {
  const bandes = lignes.map((l) => ({ boite: bande(l.boite), groupe: l.groupe }));
  let n = 0;
  for (let i = 0; i < bandes.length; i++) {
    for (let j = i + 1; j < bandes.length; j++) if (bandes[i].groupe !== bandes[j].groupe && recouvre(bandes[i].boite, bandes[j].boite)) n++;
    for (const d of dessins) if (recouvre(bandes[i].boite, d)) n++;
  }
  return n;
}

/** Candidat dessin relevé dans le DOM : élément marqué `ATTRIBUT_DESSIN`, ou `<svg>` dessiné sur place (marqué ou non). */
export interface CandidatDessin {
  boite: Boite;
  /** Porte `ATTRIBUT_DESSIN`. */
  marque: boolean;
  /** Élément `<svg>`. */
  svg: boolean;
  /** Placé sous un élément marqué (déjà compté par son enveloppe). */
  dansMarque: boolean;
  /** Porte lui-même du texte (pastille numérotée `W01`) : ce texte est mesuré comme une ligne, le dessin n'est pas un obstacle pour lui. */
  avecTexte: boolean;
}

/**
 * Dessins surveillés par la mesure des chevauchements : toute enveloppe marquée, ET tout `<svg>` sans texte qui n'est pas sous une enveloppe
 * marquée — un dessin oublié par l'auteur d'un gabarit reste un obstacle pour le texte. Fonction PURE.
 */
export function dessinsSurveilles(candidats: readonly CandidatDessin[]): Boite[] {
  return candidats.filter((c) => c.marque || (c.svg && !c.dansMarque && !c.avecTexte)).map((c) => c.boite);
}

/** Attribut posé sur la zone du corps de page (`PageBase`) : la mesure du vide y rapporte la place occupée. */
export const ATTRIBUT_ZONE_CORPS = "data-zone-corps";
/** Part maximale de VIDE admise dans le corps d'une page (L9) : au-delà, la page flotte (cartes étirées, texte perdu). */
export const VIDE_MAX = 0.25;
/** Bande (px) autour de chaque ligne et de chaque dessin comptée comme occupée : l'interligne et le remplissage serré d'une carte ne sont pas du vide. */
export const RESPIRATION = 24;

/**
 * Part (0 à 1) de la hauteur du corps de page où aucune ligne de texte ni aucun dessin n'est posé (projection verticale, chaque boîte
 * élargie de `respiration` en haut et en bas). Fonction PURE (la mesure du DOM réel l'applique, `mesure/MesureVisuelPage.tsx`).
 */
export function partVide(zone: { haut: number; bas: number }, boites: readonly Boite[], respiration: number = RESPIRATION): number {
  const hauteur = zone.bas - zone.haut;
  if (hauteur <= 0) return 0;
  const plages = boites
    .map((b) => [Math.max(zone.haut, b.haut - respiration), Math.min(zone.bas, b.bas + respiration)] as const)
    .filter(([h, b]) => b > h)
    .sort((a, b) => a[0] - b[0]);
  let occupe = 0;
  let fin = zone.haut;
  for (const [h, b] of plages) {
    if (b <= fin) continue;
    occupe += b - Math.max(h, fin);
    fin = b;
  }
  return Math.round((1 - occupe / hauteur) * 1000) / 1000;
}
