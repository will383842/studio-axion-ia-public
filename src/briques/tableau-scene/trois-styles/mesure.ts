/**
 * MESURE DE L'ÉCRITURE MANUSCRITE des trois styles du tableau : largeur d'un texte dans Permanent Marker, Kalam Bold
 * ou Caveat Brush, d'après la chasse lue dans les fichiers de police (`metriques.ts`, généré). Le rendu écrit sans
 * crénage (`fontKerning = "none"`) : la chasse fait la largeur. PUR, sans alias « @/ » : importable par Remotion.
 */
import { CARACTERES_TABLEAU, CAVEAT_BRUSH, KALAM_BOLD, PERMANENT_MARKER } from "./metriques";
import type { PoliceTableau } from "./styles";

const TABLES: Record<PoliceTableau, { unitesParEm: number; largeurs: readonly number[] }> = { marker: PERMANENT_MARKER, kalam: KALAM_BOLD, caveat: CAVEAT_BRUSH };

const INDEX = new Map<string, number>();
Array.from(CARACTERES_TABLEAU).forEach((c, i) => {
  if (!INDEX.has(c)) INDEX.set(c, i);
});

function chasse(police: PoliceTableau, c: string): number {
  const t = TABLES[police];
  const i = INDEX.get(c) ?? INDEX.get(c.normalize("NFD")[0]) ?? INDEX.get("n")!;
  return t.largeurs[i] / t.unitesParEm;
}

/** Largeur (px) d'un texte à la taille donnée. */
export function largeurTableau(texte: string, police: PoliceTableau, taille: number): number {
  let em = 0;
  for (const c of texte) em += chasse(police, c);
  return em * taille;
}

/** Hauteur d'interligne (px) d'une ligne manuscrite : la boîte où l'encre tient (jambages compris). */
export const INTERLIGNES_TABLEAU: Readonly<Record<PoliceTableau, number>> = { marker: 1.12, kalam: 1.24, caveat: 1.08 };

/** Position de la ligne de base dans la boîte d'une ligne (part de sa hauteur). */
export const LIGNE_DE_BASE_TABLEAU: Readonly<Record<PoliceTableau, number>> = { marker: 0.8, kalam: 0.74, caveat: 0.8 };

const DETERMINANTS = new Set(["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "ce", "cet", "cette", "ces", "son", "sa", "ses", "leur", "leurs", "mon", "ma", "mes", "ton", "ta", "tes", "votre", "vos", "notre", "nos", "au", "aux"]);
/** Vrai si une rangée finit par un déterminant séparé de son nom (« PRENNENT LE / MÊME TEMPS. »). */
export const coupeUnGroupe = (rangs: readonly { texte: string }[]): boolean => rangs.slice(0, -1).some((r) => DETERMINANTS.has((r.texte.split(/\s+/).at(-1) ?? "").toLowerCase().replace(/[’']$/u, "")));
const petit = (u: string) => /^[\p{L}'’]{1,3}$/u.test(u) && !/^\p{Lu}{2,}$/u.test(u);

/**
 * Coupe un texte en rangées dans `largeurMax` : le moins de rangées, puis les plus égales, un petit mot jamais en fin
 * de rangée quand c'est évitable. `null` si un mot ne tient pas.
 */
export function couperTableau(texte: string, police: PoliceTableau, taille: number, largeurMax: number): { texte: string; largeur: number }[] | null {
  const u = texte.split(/\s+/).filter(Boolean).reduce<string[]>((acc, m) => {
    if (acc.length && !/[\p{L}\p{N}]/u.test(m)) acc[acc.length - 1] += ` ${m}`;
    else acc.push(m);
    return acc;
  }, []);
  if (!u.length) return null;
  const lu = u.map((m) => largeurTableau(m, police, taille));
  const large = lu.findIndex((x) => x > largeurMax);
  if (large >= 0) {
    // Un mot composé plus large que la rangée (« PROGRAMMEZ-LES » à côté de la pastille, bench du 17/10) se coupe après
    // son trait d'union, en deux rangées ; un mot sans trait d'union ne se coupe jamais.
    const mot = u[large];
    const k = mot.indexOf("-");
    if (k <= 0 || k >= mot.length - 1) return null;
    const a = couperTableau([...u.slice(0, large), mot.slice(0, k + 1)].join(" "), police, taille, largeurMax);
    const b = couperTableau([mot.slice(k + 1), ...u.slice(large + 1)].join(" "), police, taille, largeurMax);
    return a && b ? [...a, ...b] : null;
  }
  const esp = largeurTableau(" ", police, taille);
  const larg = (i: number, j: number) => lu.slice(i, j).reduce((s, x) => s + x, 0) + (j - i - 1) * esp;
  let n0 = 1;
  for (let i = 0, w = 0; i < u.length; i++) {
    if (w > 0 && w + esp + lu[i] > largeurMax) {
      n0++;
      w = lu[i];
    } else w += (w > 0 ? esp : 0) + lu[i];
  }
  const n = u.length;
  const memo = new Map<string, { cout: number; coupes: number[] }>();
  const meilleur = (i: number, r: number): { cout: number; coupes: number[] } => {
    const cle = `${i},${r}`;
    const m = memo.get(cle);
    if (m) return m;
    let res = { cout: Infinity, coupes: [] as number[] };
    if (r === 1) {
      const w = larg(i, n);
      if (w <= largeurMax) res = { cout: w, coupes: [n] };
    } else
      for (let j = i + 1; j <= n - r + 1; j++) {
        const w = larg(i, j);
        if (w > largeurMax) break;
        const reste = meilleur(j, r - 1);
        // Jamais un petit mot en fin de rangée, ni seul sur sa rangée (« ET » seul en tête du titre).
        const seul = j - i === 1 && u[i].replace(/[^\p{L}]/gu, "").length <= 3;
        // Un déterminant (« le », « les », « un »…) reste avec son nom : jamais en fin de rangée (« le même temps »).
        const cout = Math.max(w, reste.cout) + (DETERMINANTS.has(u[j - 1].toLowerCase().replace(/[’']$/u, "")) ? largeurMax * 0.4 : petit(u[j - 1]) ? largeurMax * 0.05 : 0) + (seul ? largeurMax * 0.5 : 0);
        if (cout < res.cout) res = { cout, coupes: [j, ...reste.coupes] };
      }
    memo.set(cle, res);
    return res;
  };
  const r = meilleur(0, n0);
  if (!Number.isFinite(r.cout)) return null;
  let i = 0;
  return r.coupes.map((j) => {
    const x = { texte: u.slice(i, j).join(" "), largeur: Math.ceil(larg(i, j)) };
    i = j;
    return x;
  });
}
