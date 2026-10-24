/**
 * Place d'un mot insécable dans les gabarits à colonnes (ART-1, tour 2) : pour chaque texte d'une page, la largeur (px) de sa colonne au
 * facteur de remplissage 1 et le plus petit corps (px) où le gabarit peut le poser. Un mot plus large que sa place DÉBORDE au rendu (le
 * navigateur ne le coupe pas) : la porte qualité le refuse AVANT (MOT_TROP_LONG). Fonction PURE.
 * Copie de la géométrie de `studio-rendu/compositions/visuels/` (`commun/geometrie.ts`, colonnes de chaque gabarit) — `src/` n'importe
 * jamais `studio-rendu/` ; le test `tests/visuels/porte-mot-long.test.ts` vérifie que les deux restent égales.
 */
import type { PageSpec } from "../../domaine/visuels/types";
import { capaciteQuestion } from "./registre-pages";

export interface PlaceMot {
  /** Chemin du champ dans la page (« avec.1 », « noeuds.0.texte »). */
  chemin: string;
  texte: string;
  /** Largeur (px) de la colonne au facteur 1. */
  largeur: number;
  /** Plus petit corps (px) du texte dans le gabarit. */
  corps: number;
  /** Où le texte est posé, pour la phrase de la porte (« une ligne du cas concret »). */
  lieu: string;
}

const MARGE = 64;
const BORD = 912;
/** Bord des textes qui peuvent descendre sous y = 1080 (compteur de Meta). */
const BORD_BAS = 860;
const bordLigne = (i: number, n: number) => (i >= n - 2 ? BORD_BAS : BORD);

/** T26 : lignes AVANT (Inter SemiBold 34), AVEC NOUS (Bold 34), pastilles d'outils sous l'illustration (x = 156 → 860, SemiBold 28, remplissage 2 × 16 + bordure 2 × 2), bandeau « VOUS » (Bold 36, étiquette prise à 150 px). */
export const PLACES_T26 = { avant: 614, avec: 550, outil: BORD_BAS - 156 - 2 * 16 - 2 * 2, vous: BORD_BAS - MARGE - 150 - 16 } as const;
/** T28 : la mise en page de repli (nœuds pleine largeur, x = 64 → 912, remplissage 28, icône × 1,5) est la plus large ; le corps descend à 30 px. */
export function placesT28(n: number): number[] {
  const icone = Math.round((n <= 3 ? 80 : n === 4 ? 72 : 60) * 1.5);
  return Array.from({ length: n }, (_, i) => Math.min(BORD - 28, bordLigne(i, n)) - (MARGE + 28 + icone + 22));
}
/** T24 : la mise en page de repli (chaque ligne sur toute la colonne, après l'icône) est la plus large ; le corps descend à 30 px. */
export const placesT24 = (n: number): number[] => Array.from({ length: n }, (_, i) => bordLigne(i, n) - (MARGE + 18 + 40 + 14));
/** T23 : après la pastille (60 + 28), avant l'icône (76 + 28, comptée toujours : choix prudent). */
export const placesT23 = (n: number): number[] => Array.from({ length: n }, (_, i) => bordLigne(i, n) - 104 - (MARGE + 60 + 28));
/**
 * T23 : corps (px, avant remplissage) de la question et de l'aide selon le nombre de questions et leur longueur : près du budget (plus de
 * 70 %), un cran plus bas. L'aide reste ≥ 30 px (texte courant). Lu par le gabarit ET par la porte (une seule règle).
 */
export function taillesT23(questions: readonly { question: string; aide: string }[]): { question: number; aide: number } {
  const n = questions.length;
  const budget = capaciteQuestion(n);
  const long = questions.some((q) => q.question.length > 0.7 * budget.question || q.aide.length > 0.7 * budget.aide);
  if (n <= 2) return long ? { question: 40, aide: 31 } : { question: 46, aide: 34 };
  if (n === 3) return long ? { question: 36, aide: 30 } : { question: 42, aide: 32 };
  return long ? { question: 33, aide: 30 } : { question: 38, aide: 30 };
}
/** T02 : colonne unique après le repère (104 + 28), ou colonne de grille de 404 px. */
export function placesT02(n: number): number[] {
  const colonnes = n <= 3 ? 1 : 2;
  const rangees = Math.ceil(n / colonnes);
  return Array.from({ length: n }, (_, i) => {
    const bord = Math.floor(i / colonnes) === rangees - 1 ? BORD_BAS : BORD;
    if (colonnes === 1) return bord - (MARGE + 104 + 28);
    const gauche = MARGE + (i % 2) * (404 + 40);
    return Math.min(gauche + 404, bord) - gauche;
  });
}
/** T27 : après la case à cocher (48 + 26). */
export const PLACE_T27 = BORD - (MARGE + 48 + 26);

/** Textes à colonnes d'une page, avec leur place. Les autres pages (pleine largeur) n'en ont pas. */
export function placesDesMots(page: PageSpec): PlaceMot[] {
  switch (page.type) {
    case "T26":
      return [
        ...page.avant.map((texte, i) => ({ chemin: `avant.${i}`, texte, largeur: PLACES_T26.avant, corps: 34, lieu: "une ligne « avant » du cas concret" })),
        ...page.avec.map((texte, i) => ({ chemin: `avec.${i}`, texte, largeur: PLACES_T26.avec, corps: 34, lieu: "une ligne « avec nous » du cas concret" })),
        // Une pastille ne se coupe jamais (`nowrap`) : c'est tout l'outil qui doit tenir.
        ...(page.outils ?? []).map((texte, i) => ({ chemin: `outils.${i}`, texte: texte.replace(/ /g, " "), largeur: PLACES_T26.outil, corps: 28, lieu: "une pastille d'outil" })),
        { chemin: "vous", texte: page.vous, largeur: PLACES_T26.vous, corps: 36, lieu: "le bandeau « vous »" },
      ];
    case "T28": {
      const places = placesT28(page.noeuds.length);
      return page.noeuds.map((x, i) => ({ chemin: `noeuds.${i}.texte`, texte: x.texte, largeur: places[i], corps: 30, lieu: "un nœud du schéma" }));
    }
    case "T24": {
      const places = placesT24(page.lignes.length);
      return page.lignes.flatMap((l, i) => (["sans", "avec"] as const).map((cote) => ({ chemin: `lignes.${i}.${cote}`, texte: l[cote], largeur: places[i], corps: 30, lieu: "une case de comparaison" })));
    }
    case "T23": {
      const places = placesT23(page.questions.length);
      const corps = taillesT23(page.questions);
      return page.questions.flatMap((q, i) => [
        { chemin: `questions.${i}.question`, texte: q.question, largeur: places[i], corps: corps.question, lieu: "une question" },
        { chemin: `questions.${i}.aide`, texte: q.aide, largeur: places[i], corps: corps.aide, lieu: "l'aide d'une question" },
      ]);
    }
    case "T02": {
      const places = placesT02(page.cartes.length);
      const une = page.cartes.length <= 3;
      return page.cartes.flatMap((c, i) => [
        { chemin: `cartes.${i}.titre`, texte: c.titre, largeur: places[i], corps: une ? 42 : 36, lieu: "un titre de carte" },
        { chemin: `cartes.${i}.corps`, texte: c.corps, largeur: places[i], corps: une ? 32 : 30, lieu: "le texte d'une carte" },
      ]);
    }
    case "T27":
      return page.lignes.map((l, i) => ({ chemin: `lignes.${i}.texte`, texte: l.texte, largeur: PLACE_T27, corps: page.lignes.length <= 4 ? 36 : 33, lieu: "une ligne de la liste" }));
    default:
      return [];
  }
}
