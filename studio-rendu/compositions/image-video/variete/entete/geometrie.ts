/**
 * Variété « Image → vidéo » · axe 14, en-tête / titre (ENT-A à ENT-D) : géométrie PURE de l'habillage du titre.
 * Le titre reste en Anton, à la place d'aujourd'hui ; l'habillage (pastille, filet, bandeau) reste DANS la zone
 * de l'en-tête d'aujourd'hui (jamais sous elle : la zone sûre et les sous-titres, y 1152-1286, restent libres).
 */
import { COULEURS_DUO, TAILLES_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { ECART_ETIQUETTE, largeurLigneTitre, planTitre } from "../../../../../src/briques/schema-motion/plan-objets";
import { miseEnPageDeHauteurIV } from "../../../../../src/briques/schema-motion/types";
import type { CodesParAxe, FormatIV } from "../../../../../src/briques/schema-motion/variete";

export type CodeEntete = CodesParAxe["entete"];
export interface BoiteEntete { x: number; y: number; largeur: number; hauteur: number }
export interface GeometrieEntete {
  /** Boîte de l'habillage (null : aucun, ENT-A). */
  boite: BoiteEntete | null;
  /** Zone de l'en-tête d'aujourd'hui dans ce format. */
  zone: BoiteEntete;
  /** Boîte du texte du titre (étiquette exclue). */
  texte: BoiteEntete;
  /** Taille (px) du titre : celle de `planTitre`, réduite si l'étiquette sur plusieurs lignes laisse moins de place. */
  tailleTitre: number;
  /** Nombre de lignes de l'étiquette (estimé), le titre se pose dessous. */
  lignesEtiquette: number;
  forme: "aucune" | "capsule" | "filet" | "bandeau";
  /** Couleur du titre et du fond qui est directement derrière lui. */
  couleurTitre: string;
  couleurAccent: string;
  fondDuTitre: string;
  /** Pastille et bandeau : fond de l'habillage ; filet : sa couleur. */
  couleurHabillage: string | null;
  bordure: string | null;
}

const LARGEUR = 1080;
const HAUTEUR = { "9:16": 1920, "4:5": 1350 } as const;
const INTERLIGNE = 1.05;
const HAUTEUR_LIGNE_ETIQUETTE = 1.21;
/** Chasse prudente d'une capitale Inter gras + espacement 0,32em, en em : sur-estime, donc plutôt trop de lignes que trop peu. */
const CHASSE_ETIQUETTE_EM = 1.0;
const LIGNES_ETIQUETTE_MAX = 3;
/** Marge de sécurité sur la largeur estimée du titre (chasse réelle d'Anton). */
const MARGE_LARGEUR_TITRE = 1.04;

/** Nombre de lignes de l'étiquette (en-tête : `div` pleine largeur, retour à la ligne aux espaces), estimé par le nombre de signes. */
export function lignesEtiquetteEstimees(etiquette: string, ht: number): number {
  const parLigne = Math.max(1, Math.floor(LARGEUR / (CHASSE_ETIQUETTE_EM * TAILLES_DUO.etiquette * ht)));
  let lignes = 1;
  let courant = 0;
  for (const mot of etiquette.trim().split(/\s+/).filter(Boolean)) {
    const n = mot.length;
    if (courant === 0) courant = n;
    else if (courant + 1 + n <= parLigne) courant += 1 + n;
    else { lignes += 1; courant = n; }
    while (courant > parLigne) { lignes += 1; courant -= parLigne; }
  }
  return Math.min(LIGNES_ETIQUETTE_MAX, lignes);
}

/** Géométrie de l'en-tête pour un code, un titre et un format ; `fond` est celui de l'écran (ivoire par défaut). */
export function geometrieEntete(code: CodeEntete, texte: string, format: FormatIV, fond: "ivoire" | "sombre" = "ivoire", etiquette = ""): GeometrieEntete {
  const hauteur = HAUTEUR[format];
  const m = miseEnPageDeHauteurIV(hauteur);
  const ht = m.hauteurTexte;
  const haut = m.entete.haut * hauteur;
  const bas = m.entete.bas * hauteur;
  const zone = { x: 0, y: haut, largeur: LARGEUR, hauteur: bas - haut };
  const titre = planTitre(texte, LARGEUR, ht);
  const lignesEtiquette = lignesEtiquetteEstimees(etiquette, ht);
  const yTitre = haut + lignesEtiquette * HAUTEUR_LIGNE_ETIQUETTE * TAILLES_DUO.etiquette * ht + ECART_ETIQUETTE * ht;
  const [px, py] = code === "ENT-B" ? [32, 10] : [26, 8];
  // Le titre (et son habillage) tient sous l'étiquette, dans la zone : si l'étiquette prend plusieurs lignes, il se réduit.
  const reserve = lignesEtiquette > 1 && (code === "ENT-B" || code === "ENT-D") ? py : 0;
  const tailleTitre = Math.min(titre.taille, Math.max(0, (bas - yTitre - reserve) / (titre.lignes.length * INTERLIGNE)));
  const hTitre = titre.lignes.length * INTERLIGNE * tailleTitre;
  const lTitre = Math.min(0.94 * LARGEUR, Math.max(0, ...titre.lignes.map((l) => largeurLigneTitre(l, tailleTitre))));
  const boiteTexte = { x: (LARGEUR - lTitre) / 2, y: yTitre, largeur: lTitre, hauteur: hTitre };
  const sombre = fond === "sombre";
  const base = { zone, texte: boiteTexte, tailleTitre, lignesEtiquette, couleurTitre: sombre ? COULEURS_DUO.ivoire : COULEURS_DUO.encre, couleurAccent: sombre ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange, fondDuTitre: sombre ? COULEURS_DUO.nuit : COULEURS_DUO.ivoire, couleurHabillage: null, bordure: null };
  if (code === "ENT-A") return { ...base, boite: null, forme: "aucune" };
  if (code === "ENT-C") {
    const l = Math.min(lTitre, 220);
    return { ...base, forme: "filet", couleurHabillage: sombre ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange, boite: { x: (LARGEUR - l) / 2, y: Math.max(haut, yTitre - 14), largeur: l, hauteur: 4 } };
  }
  // Pastille et bandeau : la boîte déborde du texte, mais reste dans la zone et dans la largeur.
  const y = Math.max(haut, yTitre - py);
  const boite = { x: Math.max(0, boiteTexte.x - px), y, largeur: Math.min(LARGEUR, lTitre * MARGE_LARGEUR_TITRE + 2 * px), hauteur: Math.min(bas, yTitre + hTitre + py) - y };
  boite.x = (LARGEUR - boite.largeur) / 2;
  if (code === "ENT-B") return { ...base, forme: "capsule", boite, couleurTitre: COULEURS_DUO.ivoire, couleurAccent: COULEURS_DUO.orangeVif, fondDuTitre: COULEURS_DUO.encre, couleurHabillage: COULEURS_DUO.encre, bordure: COULEURS_DUO.orangeVif };
  return { ...base, forme: "bandeau", boite, couleurTitre: COULEURS_DUO.encre, couleurAccent: COULEURS_DUO.encre, fondDuTitre: COULEURS_DUO.orangeVif, couleurHabillage: COULEURS_DUO.orangeVif };
}
