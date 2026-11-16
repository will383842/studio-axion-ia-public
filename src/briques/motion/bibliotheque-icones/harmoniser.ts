/**
 * HARMONISER LES ICÔNES (C9-31). Fonctions pures, SANS alias « @/ » : lisibles par le rendu.
 * Ajout pur : rien n'appelle ce module. Jamais d'exception : en cas de doute, l'entrée est renvoyée telle quelle.
 */
import type { IconeBibliotheque, NoeudBibliotheque } from "./lucide";

const GRILLE = 24;
const TRAIT = "2";

/** Mots interdits dans un nom d'icône (visages, personnages). Liste figée. */
export const MOTS_INTERDITS: readonly string[] = Object.freeze([
  "visage", "smile", "smiley", "emoji", "face", "user-circle", "avatar", "portrait", "tete", "personnage", "mascotte", "grimace",
]);

/** Vrai si le nom d'icône n'évoque ni visage ni personnage. */
export function nomPermis(nom: string): boolean {
  if (typeof nom !== "string" || nom.trim() === "") return false;
  const n = nom.toLowerCase();
  return !MOTS_INTERDITS.some((m) => n.includes(m));
}

function nombre(x: number): string {
  const r = Math.round(x * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

interface Echelle { s: number; dx: number; dy: number }

function lireViewBox(vb: unknown): Echelle | null {
  if (typeof vb !== "string") return null;
  const p = vb.trim().split(/[\s,]+/).map(Number);
  if (p.length !== 4 || p.some((v) => !Number.isFinite(v)) || p[2] <= 0 || p[3] <= 0) return null;
  return { s: GRILLE / Math.max(p[2], p[3]), dx: p[0], dy: p[1] };
}

const NB = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

function chemin(d: string, e: Echelle): string {
  const sortie: string[] = [];
  let i = 0;
  let cmd = "";
  const sauter = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  while (true) {
    sauter();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) {
      cmd = d[i++];
      if (!(cmd.toLowerCase() in ARGS)) throw new Error("commande");
      if (cmd.toLowerCase() === "z") { sortie.push(cmd); continue; }
    } else if (!cmd || cmd.toLowerCase() === "z") throw new Error("syntaxe");
    const min = cmd.toLowerCase();
    const abs = cmd !== min;
    const v: number[] = [];
    for (let k = 0; k < ARGS[min]; k++) {
      sauter();
      let m: RegExpMatchArray | null;
      if (min === "a" && (k === 3 || k === 4)) {
        if (d[i] !== "0" && d[i] !== "1") throw new Error("drapeau");
        v.push(Number(d[i++]));
      } else if ((m = d.slice(i).match(NB))) {
        v.push(Number(m[0]));
        i += m[0].length;
      } else throw new Error("nombre");
    }
    const t = v.map((x, k) => {
      if (min === "a") {
        if (k === 0 || k === 1) return x * e.s;
        if (k === 5) return (abs ? x - e.dx : x) * e.s;
        if (k === 6) return (abs ? x - e.dy : x) * e.s;
        return x;
      }
      if (min === "h") return (abs ? x - e.dx : x) * e.s;
      if (min === "v") return (abs ? x - e.dy : x) * e.s;
      const estX = k % 2 === 0;
      return (abs ? x - (estX ? e.dx : e.dy) : x) * e.s;
    });
    sortie.push(cmd + t.map(nombre).join(" "));
  }
  return sortie.join("");
}

function points(p: string, e: Echelle): string {
  const n = p.trim().split(/[\s,]+/).map(Number);
  if (n.length % 2 !== 0 || n.some((v) => !Number.isFinite(v))) throw new Error("points");
  const o: string[] = [];
  for (let k = 0; k < n.length; k += 2) o.push(`${nombre((n[k] - e.dx) * e.s)},${nombre((n[k + 1] - e.dy) * e.s)}`);
  return o.join(" ");
}

const ABS_X = new Set(["cx", "x", "x1", "x2"]);
const ABS_Y = new Set(["cy", "y", "y1", "y2"]);
const LONGUEURS = new Set(["r", "rx", "ry", "width", "height"]);
const COULEURS = new Set(["color", "stop-color", "flood-color", "lighting-color"]);

function nombreAttr(v: string, f: (x: number) => number): string {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new Error("nombre");
  return nombre(f(x));
}

function noeud(n: NoeudBibliotheque, e: Echelle | null, change: boolean): NoeudBibliotheque {
  const entree = (n?.[1] ?? {}) as Record<string, string>;
  const sortie: Record<string, string> = {};
  for (const [k, v0] of Object.entries(entree)) {
    const v = String(v0);
    if (k === "style" || k === "class") continue;
    if (k === "stroke") { sortie[k] = v.trim() === "none" ? "none" : "currentColor"; continue; }
    if (k === "stroke-width") { sortie[k] = TRAIT; continue; }
    if (k === "fill") { sortie[k] = v.trim() === "none" ? "none" : "currentColor"; continue; }
    if (COULEURS.has(k)) { sortie[k] = "currentColor"; continue; }
    if (change && e) {
      if (k === "d") { sortie[k] = chemin(v, e); continue; }
      if (k === "points") { sortie[k] = points(v, e); continue; }
      if (ABS_X.has(k)) { sortie[k] = nombreAttr(v, (x) => (x - e.dx) * e.s); continue; }
      if (ABS_Y.has(k)) { sortie[k] = nombreAttr(v, (x) => (x - e.dy) * e.s); continue; }
      if (LONGUEURS.has(k)) { sortie[k] = nombreAttr(v, (x) => x * e.s); continue; }
    }
    sortie[k] = v;
  }
  return [n[0], sortie];
}

/** Ramène l'icône sur la grille 24 : viewBox « 0 0 24 24 », trait 2, couleurs en currentColor. Une icône déjà conforme est renvoyée à l'identique (copie). */
export function harmoniser(icone: IconeBibliotheque): IconeBibliotheque {
  try {
    const e = lireViewBox(icone.viewBox);
    const change = !!e && (e.s !== 1 || e.dx !== 0 || e.dy !== 0);
    return {
      ...icone,
      viewBox: `0 0 ${GRILLE} ${GRILLE}`,
      noeuds: icone.noeuds.map((n) => noeud(n, e, change)),
    };
  } catch {
    return icone;
  }
}
