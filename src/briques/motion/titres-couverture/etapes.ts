/**
 * RÈGLES PURES DES TITRES DE COUVERTURE (C11-T6b-a) — « Étape N » qui monte et pastille de contexte.
 * Sans React, sans Remotion, sans service : temps, place et texte seulement. Le texte vient toujours de l'appelant.
 * Rien devant le visage (ZONE_VISAGE de plan-scenes/zones : x 22-78 %, y 14-56 %) : l'étape et la pastille restent
 * dans la bande tout en haut, au-dessus de cette zone. Éteint : rien n'appelle ce fichier.
 */

/** Police du neuf : Manrope. */
export const POLICE_COUVERTURE = "Manrope";

/** Durées (secondes). */
export const ENTREE_S = 0.3;
export const TENUE_S = 2;
export const SORTIE_S = 0.2;

/** Tailles de texte (en % de la hauteur du cadre) et graisses. */
export const TAILLES_TEXTE = {
  etape: { taillePctHauteur: 4.2, graisse: 800 },
  pastille: { taillePctHauteur: 2.4, graisse: 400 },
} as const;

/** Place de l'étape (en % du cadre) : bande tout en haut, au-dessus du visage, dans le tiers haut. */
export const ETAPE_X_PCT = 5;
export const ETAPE_LARGEUR_PCT = 90;
export const ETAPE_HAUTEUR_PCT = 6;
export const ETAPE_Y_FINAL_PCT = 6;
/** Point de départ de la montée : juste en dessous, sans entrer dans la zone du visage. */
export const ETAPE_Y_DEPART_PCT = 8;
export const ETAPE_ECHELLE_DEPART = 0.92;

export const ETAPE_NUMERO_MIN = 1;
export const ETAPE_NUMERO_MAX = 9;
export const ETAPE_MOTS_MAX = 5;
export const PASTILLE_CARACTERES_MAX = 28;

export const RATIOS_COUVERTURE = ["9:16", "4:5", "1:1", "16:9"] as const;
export type RatioCouverture = (typeof RATIOS_COUVERTURE)[number];

/** Largeur / hauteur de chaque ratio. */
const PROPORTION: Record<RatioCouverture, number> = { "9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1, "16:9": 16 / 9 };

export interface EtapeEntree {
  numero: number;
  libelle: string;
  debutImage: number;
  ips: number;
}
export interface EtapeImage {
  /** Haut de l'étape, en % de la hauteur du cadre. */
  y: number;
  opacite: number;
  echelle: number;
}
export interface PastilleEntree {
  texte: string;
  ratio: RatioCouverture;
}
export interface PastilleRect {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

const compterMots = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
const borne01 = (v: number): number => Math.min(1, Math.max(0, v));
/** Sortie douce (cubique), monotone de 0 à 1. */
const adoucir = (t: number): number => 1 - Math.pow(1 - borne01(t), 3);

/**
 * « Étape N » qui monte : rend une fonction image → { y, opacite, echelle }.
 * Entrée 0,3 s (montée + apparition), tenue, sortie 0,2 s (fondu, sans bouger). Opacité 0 avant et après.
 */
export function etapeMontante(entree: EtapeEntree): (image: number) => EtapeImage {
  const { numero, libelle, debutImage, ips } = entree;
  if (!Number.isInteger(numero) || numero < ETAPE_NUMERO_MIN || numero > ETAPE_NUMERO_MAX) {
    throw new Error(`Numéro d'étape invalide : ${numero} (1 à 9).`);
  }
  const mots = compterMots(libelle);
  if (mots < 1 || mots > ETAPE_MOTS_MAX) {
    throw new Error(`Libellé d'étape invalide : ${mots} mot(s) (1 à 5).`);
  }
  if (!Number.isFinite(ips) || ips <= 0) throw new Error("Images par seconde invalides.");
  if (!Number.isFinite(debutImage) || debutImage < 0) throw new Error("Image de début invalide.");

  const nEntree = Math.round(ENTREE_S * ips);
  const nTenue = Math.round(TENUE_S * ips);
  const nSortie = Math.round(SORTIE_S * ips);
  const finEntree = debutImage + nEntree;
  const debutSortie = finEntree + nTenue;
  const fin = debutSortie + nSortie;
  const delta = ETAPE_Y_DEPART_PCT - ETAPE_Y_FINAL_PCT;

  return (image: number): EtapeImage => {
    if (image < debutImage || image > fin) return { y: ETAPE_Y_DEPART_PCT, opacite: 0, echelle: ETAPE_ECHELLE_DEPART };
    if (image < finEntree) {
      const p = adoucir((image - debutImage) / nEntree);
      return {
        y: ETAPE_Y_DEPART_PCT - delta * p,
        opacite: p,
        echelle: ETAPE_ECHELLE_DEPART + (1 - ETAPE_ECHELLE_DEPART) * p,
      };
    }
    if (image <= debutSortie) return { y: ETAPE_Y_FINAL_PCT, opacite: 1, echelle: 1 };
    return { y: ETAPE_Y_FINAL_PCT, opacite: borne01(1 - (image - debutSortie) / nSortie), echelle: 1 };
  };
}

/**
 * Pastille de contexte, tenue toute la vidéo : coin haut gauche, au-dessus du visage, une ligne.
 * Rend { x, y, largeur, hauteur } en % du cadre ; la largeur suit le nombre de caractères et le ratio.
 */
export function pastilleContexte(entree: PastilleEntree): PastilleRect {
  const { texte, ratio } = entree;
  if (!(RATIOS_COUVERTURE as readonly string[]).includes(ratio)) throw new Error(`Ratio inconnu : ${String(ratio)}.`);
  if (/[\r\n]/.test(texte)) throw new Error("La pastille tient sur une seule ligne.");
  const n = [...texte.trim()].length;
  if (n < 1 || n > PASTILLE_CARACTERES_MAX) {
    throw new Error(`Texte de pastille invalide : ${n} caractère(s) (1 à 28).`);
  }
  // Taille du texte en % de la hauteur → en % de la largeur ; un caractère Manrope ≈ 0,58 de la taille.
  const taillePctLargeur = TAILLES_TEXTE.pastille.taillePctHauteur / PROPORTION[ratio];
  const remplissage = 2 * taillePctLargeur;
  const largeur = Math.min(92, Math.round((n * 0.58 * taillePctLargeur + remplissage) * 10) / 10);
  return { x: 4, y: 1, largeur, hauteur: 4.5 };
}
