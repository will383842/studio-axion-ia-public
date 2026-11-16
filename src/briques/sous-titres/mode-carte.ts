/**
 * Mode carte (C11-T7, effet TXT-50) : un groupe de sous-titres devient une carte plein cadre. Pièce NEUVE, éteinte,
 * hors de la gamme animée. Pur, lu par le rendu : imports relatifs seulement, aucun alias `@/`.
 * MÊME MINUTAGE que le groupe : la carte vit exactement de `debutSec` à `finSec` (rien n'est allongé ni raccourci) ;
 * la voix n'est jamais touchée. Le branchement (hors plans « double », visage non couvert) est une autre fiche.
 */
import { PALETTE } from "../charte/axion-2026";
import { progres } from "../motion/courbes";
import { DUREES } from "../motion/jetons";
import { largeurLigne, type NomPolice } from "./mesure";
import type { MotRendu } from "./types-rendu";

/** Éteint par défaut : seul `true` allumera le futur branchement (non planifié). */
export const MODE_CARTE_ACTIF = false;

/** Police de la carte : Manrope. */
export const POLICE_CARTE: NomPolice = "Manrope ExtraBold";

export type FondCarte = "ivoire" | "noir" | "terracotta";

export interface ParametresCarte {
  /** Mots du groupe (seul `mot` est lu). */
  mots: readonly Pick<MotRendu, "mot">[];
  debutSec: number;
  finSec: number;
  fond: FondCarte;
}

export interface GeometrieCarte {
  cadre: { x: number; y: number; largeur: number; hauteur: number };
  /** 2 à 4 lignes (1 seule si le groupe n'a qu'un mot). */
  lignes: string[];
  taillePolice: number;
  interligne: number;
  couleurs: { fond: string; texte: string };
  opacite: number;
}

/** Paires [texte, fond] de `PAIRES_TEXTE` (charte). */
const PAIRES: Record<FondCarte, { texte: string; fond: string }> = {
  ivoire: { texte: PALETTE.noir, fond: PALETTE.ivoire },
  noir: { texte: PALETTE.ivoire, fond: PALETTE.noir },
  terracotta: { texte: PALETTE.blanc, fond: PALETTE.terracotta },
};

const LIGNES_MIN = 2;
const LIGNES_MAX = 4;
const INTERLIGNE = 1.2;
const REF = 100;

/** Découpe en `nb` lignes qui minimise la plus large (programmation dynamique, ordre des mots conservé). */
function decouper(mots: string[], nb: number): { lignes: string[][]; largeurMax: number } {
  const n = mots.length;
  const larg = (i: number, j: number) => largeurLigne(mots.slice(i, j), POLICE_CARTE, REF);
  // meilleur[k][j] : plus petite largeur max pour les j premiers mots en k lignes.
  const meilleur: number[][] = Array.from({ length: nb + 1 }, () => Array<number>(n + 1).fill(Infinity));
  const coupe: number[][] = Array.from({ length: nb + 1 }, () => Array<number>(n + 1).fill(0));
  meilleur[0][0] = 0;
  for (let k = 1; k <= nb; k++) {
    for (let j = k; j <= n; j++) {
      for (let i = k - 1; i < j; i++) {
        const v = Math.max(meilleur[k - 1][i], larg(i, j));
        if (v < meilleur[k][j]) {
          meilleur[k][j] = v;
          coupe[k][j] = i;
        }
      }
    }
  }
  const lignes: string[][] = [];
  for (let k = nb, j = n; k >= 1; k--) {
    const i = coupe[k][j];
    lignes.unshift(mots.slice(i, j));
    j = i;
  }
  return { lignes, largeurMax: meilleur[nb][n] };
}

/** `tSec` : secondes dans la vidéo. `null` hors de `[debutSec, finSec]` (bornes incluses), groupe vide ou durée nulle. */
export function geometrieCarteGroupe(p: ParametresCarte, largeur: number, hauteur: number, tSec: number): GeometrieCarte | null {
  const mots = p.mots.map((m) => m.mot.trim()).filter((m) => m !== "");
  if (mots.length === 0 || !(p.finSec > p.debutSec) || !(tSec >= p.debutSec && tSec <= p.finSec)) return null;

  const petit = Math.min(largeur, hauteur);
  const zoneL = largeur * 0.84;
  const zoneH = hauteur * 0.7;
  const tailleMax = petit * 0.14;

  let meilleure: { lignes: string[][]; taille: number } | null = null;
  const bas = Math.min(LIGNES_MIN, mots.length);
  const haut = Math.min(LIGNES_MAX, mots.length);
  for (let nb = bas; nb <= haut; nb++) {
    const d = decouper(mots, nb);
    const taille = Math.min(tailleMax, (zoneL / d.largeurMax) * REF, zoneH / (nb * INTERLIGNE));
    if (!meilleure || taille > meilleure.taille) meilleure = { lignes: d.lignes, taille };
  }
  const { lignes, taille } = meilleure!;

  // Entrée à partir de debutSec, chute qui finit exactement à finSec ; une carte courte garde les deux dans sa durée.
  const duree = p.finSec - p.debutSec;
  const sortie = Math.min(DUREES.sortie, duree / 2);
  const e = progres(tSec, p.debutSec, Math.min(DUREES.entree, duree / 2));
  const s = progres(tSec, p.finSec - sortie, sortie, "sortie");

  return {
    cadre: { x: 0, y: 0, largeur, hauteur },
    lignes: lignes.map((l) => l.join(" ")),
    taillePolice: taille,
    interligne: INTERLIGNE,
    couleurs: PAIRES[p.fond],
    opacite: Math.max(0, Math.min(1, e * (1 - s))),
  };
}
