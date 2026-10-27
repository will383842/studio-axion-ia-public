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

/** Géométrie de l'en-tête pour un code, un titre et un format ; `fond` est celui de l'écran (ivoire par défaut). */
export function geometrieEntete(code: CodeEntete, texte: string, format: FormatIV, fond: "ivoire" | "sombre" = "ivoire"): GeometrieEntete {
  const hauteur = HAUTEUR[format];
  const m = miseEnPageDeHauteurIV(hauteur);
  const ht = m.hauteurTexte;
  const haut = m.entete.haut * hauteur;
  const bas = m.entete.bas * hauteur;
  const zone = { x: 0, y: haut, largeur: LARGEUR, hauteur: bas - haut };
  const titre = planTitre(texte, LARGEUR, ht);
  const yTitre = haut + HAUTEUR_LIGNE_ETIQUETTE * TAILLES_DUO.etiquette * ht + ECART_ETIQUETTE * ht;
  const hTitre = Math.min(bas - yTitre, titre.lignes.length * INTERLIGNE * titre.taille);
  const lTitre = Math.min(0.94 * LARGEUR, Math.max(0, ...titre.lignes.map((l) => largeurLigneTitre(l, titre.taille))));
  const boiteTexte = { x: (LARGEUR - lTitre) / 2, y: yTitre, largeur: lTitre, hauteur: hTitre };
  const sombre = fond === "sombre";
  const base = { zone, texte: boiteTexte, couleurTitre: sombre ? COULEURS_DUO.ivoire : COULEURS_DUO.encre, couleurAccent: sombre ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange, fondDuTitre: sombre ? COULEURS_DUO.nuit : COULEURS_DUO.ivoire, couleurHabillage: null, bordure: null };
  if (code === "ENT-A") return { ...base, boite: null, forme: "aucune" };
  if (code === "ENT-C") {
    const l = Math.min(lTitre, 220);
    return { ...base, forme: "filet", couleurHabillage: sombre ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange, boite: { x: (LARGEUR - l) / 2, y: Math.max(haut, yTitre - 14), largeur: l, hauteur: 4 } };
  }
  // Pastille et bandeau : la boîte déborde du texte, mais reste dans la zone et dans la largeur.
  const [px, py] = code === "ENT-B" ? [32, 10] : [26, 8];
  const y = Math.max(haut, yTitre - py);
  const boite = { x: Math.max(0, boiteTexte.x - px), y, largeur: Math.min(LARGEUR, lTitre + 2 * px), hauteur: Math.min(bas, yTitre + hTitre + py) - y };
  boite.x = (LARGEUR - boite.largeur) / 2;
  if (code === "ENT-B") return { ...base, forme: "capsule", boite, couleurTitre: COULEURS_DUO.ivoire, couleurAccent: COULEURS_DUO.orangeVif, fondDuTitre: COULEURS_DUO.encre, couleurHabillage: COULEURS_DUO.encre, bordure: COULEURS_DUO.orangeVif };
  return { ...base, forme: "bandeau", boite, couleurTitre: COULEURS_DUO.encre, couleurAccent: COULEURS_DUO.encre, fondDuTitre: COULEURS_DUO.orangeVif, couleurHabillage: COULEURS_DUO.orangeVif };
}
