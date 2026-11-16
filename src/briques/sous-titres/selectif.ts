/**
 * Sous-titres sélectifs (C11-T2) : pièce NEUVE, pure, éteinte, non branchée. Imports relatifs (type seulement),
 * aucun alias `@/`. N'agit que sur l'affichage à l'écran : le minutage n'est jamais changé et le `.srt` complet
 * reste livré par ailleurs.
 */
import type { SegmentRendu } from "./types-rendu";

/** Éteint par défaut : seul `true` allumera le futur branchement (autre fiche). */
export const SELECTIF_ACTIF = false;

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s,.'-]/gu, "")
    .trim();

const NOMBRES_LETTRES = new Set([
  "zero", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize",
  "quatorze", "quinze", "seize", "vingt", "vingts", "trente", "quarante", "cinquante", "soixante", "cent", "cents",
  "mille", "million", "millions", "milliard", "milliards",
]);

/** Chiffres (« 30 », « 12,5 ») ou nombre en lettres (« trois », « vingt-deux »). « une » reste un article. */
function estNombre(mot: string): boolean {
  const m = normaliser(mot);
  if (/\d/.test(m)) return true;
  const morceaux = m.split(/[-\s]+/).filter(Boolean);
  return morceaux.length > 0 && morceaux.every((p) => NOMBRES_LETTRES.has(p) || p === "et") && morceaux.some((p) => NOMBRES_LETTRES.has(p) && p !== "un" || morceaux.length > 1);
}

/**
 * Garde les groupes qui contiennent un mot-clé fourni ou un nombre ; les autres gardent leurs bornes mais n'ont
 * plus de mots (sans texte). Éteint (`actif` absent ou différent de `true`) : copie égale de l'entrée.
 */
export function filtrerSelectif(
  groupes: readonly SegmentRendu[],
  motsCles: readonly string[],
  actif: boolean | undefined = SELECTIF_ACTIF,
): SegmentRendu[] {
  if (actif !== true) return structuredClone(groupes) as SegmentRendu[];
  const cles = new Set(motsCles.map(normaliser).filter(Boolean));
  return groupes.map((g) => {
    const garde = g.mots.some((m) => cles.has(normaliser(m.mot)) || estNombre(m.mot));
    return garde ? structuredClone(g) : { ...structuredClone(g), mots: [] };
  });
}
