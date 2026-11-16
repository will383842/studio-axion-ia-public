/**
 * Repère rond près de l'épaule (C2-U18) : pièce NEUVE (Q1), éteinte, jamais dans la v4. Pur, lu par le rendu :
 * imports relatifs seulement, aucun alias `@/`. Aucune détection de visage : l'appelant donne le point d'épaule et
 * garantit la zone hors visage (`devantLeVisage`, `src/briques/plan-scenes/zones.ts:38`).
 */
import { COURBES, DUREES } from "../motion/jetons";
import { MARQUEURS } from "./marqueur";
import type { NomPolice } from "./mesure";
import type { TeinteMarqueurRendu } from "./types-rendu";

/** Éteint par défaut : seul `true` allumera le futur branchement (non planifié). */
export const REPERE_EPAULE_ACTIF = false;

/** Police du repère : Manrope (Q2), graisse chargée à la demande par `polices.ts` (C2-U3). */
export const POLICE_REPERE: NomPolice = "Manrope Bold";

export interface ParametresRepere {
  /** Point d'épaule, fractions 0..1 du cadre. */
  x: number;
  y: number;
  /** Côté de l'étiquette par rapport au cercle (opposé au visage). */
  cote: "gauche" | "droite";
  /** Au plus 3 mots. */
  texte: string;
  teinte: TeinteMarqueurRendu;
}

export interface GeometrieRepere {
  cercle: { cx: number; cy: number; r: number };
  etiquette: { x: number; y: number; largeur: number; hauteur: number; taillePolice: number; texte: string };
  couleurs: { fond: string; texte: string };
  opacite: number;
  echelle: number;
}

const MOTS_MAX = 3;
const dansUnite = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
const borner = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Courbe de Bézier cubique CSS (x1, y1, x2, y2) : progression 0..1 pour un temps normalisé 0..1. */
function bezier([x1, y1, x2, y2]: readonly number[], t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const coord = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (coord(x1, x2, m) < t) lo = m;
    else hi = m;
  }
  return coord(y1, y2, (lo + hi) / 2);
}

/** `t` : secondes depuis l'apparition. `null` si le texte est vide ou dépasse 3 mots, ou si x/y sortent de 0..1. */
export function geometrieRepere(p: ParametresRepere, largeur: number, hauteur: number, t: number): GeometrieRepere | null {
  const texte = p.texte.trim().replace(/\s+/g, " ");
  const mots = texte === "" ? 0 : texte.split(" ").length;
  if (mots === 0 || mots > MOTS_MAX || !dansUnite(p.x) || !dansUnite(p.y)) return null;

  const petit = Math.min(largeur, hauteur);
  const r = petit * 0.035;
  const taillePolice = petit * 0.036;
  const largeurEtiquette = Math.min(largeur * 0.7, texte.length * taillePolice * 0.62 + taillePolice * 1.4);
  const hauteurEtiquette = taillePolice * 1.9;
  const ecart = r * 0.5;
  // Bornage : le cercle est ramené assez loin du bord pour que l'étiquette tienne, entière, du côté demandé.
  const place = r + ecart + largeurEtiquette;
  const cx =
    p.cote === "gauche"
      ? borner(p.x * largeur, place, largeur - r)
      : borner(p.x * largeur, r, largeur - place);
  const cy = borner(p.y * hauteur, r, hauteur - r);
  const x = p.cote === "gauche" ? cx - r - ecart - largeurEtiquette : cx + r + ecart;
  const y = borner(cy - hauteurEtiquette / 2, 0, hauteur - hauteurEtiquette);

  const avancement = bezier(COURBES.signature, t / DUREES.entree);
  return {
    cercle: { cx, cy, r },
    etiquette: { x, y, largeur: largeurEtiquette, hauteur: hauteurEtiquette, taillePolice, texte },
    couleurs: { fond: MARQUEURS[p.teinte].fond, texte: MARQUEURS[p.teinte].texte },
    opacite: avancement,
    echelle: 0.85 + 0.15 * avancement,
  };
}
