/**
 * Place du repère « k/N » (`RepereChapitre`) face au surtitre d'un écran, en 4:5. PUR.
 *
 * Défaut vu sur un essai LinkedIn 4:5 : à y 94 → 169 (haut du repère, remonté de 60 px), le repère recouvrait le surtitre
 * (l'étiquette en capitales espacées) de l'écran « chiffres », posé à y 96 à gauche (x 72) : le repère, centré, passait dessus.
 * Règle : le repère ne recouvre jamais le surtitre. Il se décale vers la droite (bord droit au bord de la marge), et s'il ne
 * reste pas la place d'un côté comme de l'autre, il s'efface sur cet écran seulement (le surtitre dit déjà l'essentiel ; jamais de blocage).
 * En 9:16 le repère est à y 154 et ce surtitre à y 250 : rien ne se recouvre, rien ne change.
 */
import { HAUT_REPERE, planRepere, type ChangementRepere } from "../../../../src/briques/schema-motion/plan-objets";
import { formatDeHauteurIV, DECALAGE_REFERENCE_4X5_PX } from "../../../../src/briques/schema-motion/types";
import { cadreChiffres } from "./chiffres/outils";

const LARGEUR = 1080;
/** Marge latérale de l'étiquette (`Etiquette`) et du bord droit du repère décalé. */
const MARGE = 72;
/** Écart minimal entre le surtitre et le repère. */
const ECART = 24;
/** Corps, chasse (pire cas, comme `geometrieEntete`) et interligne de l'étiquette des écrans « chiffres ». */
const TAILLE_ETIQUETTE = 28;
const CHASSE_ETIQUETTE_EM = 1.27;
const INTERLIGNE_ETIQUETTE = 1.15;

export type BoiteRepere = { x: number; y: number; largeur: number; hauteur: number };

/** Boîte du surtitre d'un écran « chiffres » en 4:5 (pixels du cadre), ou null : pas de surtitre, ou pas en 4:5. */
export function boiteSurtitreChiffres(hauteur: number, etiquette: string | undefined, code: string): BoiteRepere | null {
  if (formatDeHauteurIV(hauteur) !== "4:5" || !etiquette || code === "CHI-D") return null;
  const largeur = Math.min(LARGEUR - 2 * MARGE, etiquette.length * TAILLE_ETIQUETTE * CHASSE_ETIQUETTE_EM);
  return { x: MARGE, y: cadreChiffres(hauteur).etiquetteY, largeur, hauteur: TAILLE_ETIQUETTE * INTERLIGNE_ETIQUETTE };
}

/** Boîte du repère à l'instant `t` dans le cadre 4:5 (comme `RepereChapitre`, remonté de `DECALAGE_REFERENCE_4X5_PX`) ; null : pas encore là. */
export function boiteRepere45(changements: readonly ChangementRepere[], total: number, t: number, prefixe?: string): BoiteRepere | null {
  const r = planRepere(changements, total, t, prefixe);
  if (!r) return null;
  const hauteur = r.taille * 1.3;
  const largeur = r.largeur + 28 + (total * 34 + (total - 1) * 10) + 34;
  return { x: (LARGEUR - largeur) / 2, y: HAUT_REPERE * 1920 - DECALAGE_REFERENCE_4X5_PX, largeur, hauteur };
}

const seRecouvrent = (a: BoiteRepere, b: BoiteRepere) => a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;

/**
 * Décalage horizontal (px) du repère pour qu'il ne recouvre pas le surtitre : 0 s'ils sont déjà disjoints, vers la droite
 * (bord droit à la marge) sinon, `null` quand même là il recouvre le surtitre (le repère s'efface alors).
 */
export function decalageRepereSurtitre(repere: BoiteRepere | null, surtitre: BoiteRepere | null): number | null {
  if (!repere || !surtitre || !seRecouvrent(repere, surtitre)) return 0;
  const dx = LARGEUR - MARGE - (repere.x + repere.largeur);
  if (dx <= 0) return null;
  return seRecouvrent({ ...repere, x: repere.x + dx }, { ...surtitre, largeur: surtitre.largeur + ECART }) ? null : dx;
}
