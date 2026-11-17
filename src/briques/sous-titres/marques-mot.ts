/**
 * C11-T3 : variantes de la plaque d'un mot (pinceau, papier déchiré, chevauchement, évidé). PUR : ni React, ni
 * Remotion, aucun alias `@/`, aucun hasard non déterministe, aucune horloge. Même graine = mêmes formes, toujours.
 * Éteint : rien ne l'appelle encore. La géométrie de base est INJECTÉE (déjà calculée par l'appelant, modèle : la
 * pièce du pavé de C2-U7b), jamais recalculée ici : la logique des marges reste en un seul endroit.
 */
import type { GeometriePave } from "./pave";
import { MARQUEURS } from "./marqueur";
import type { TeinteMarqueurRendu } from "./types-rendu";

/** Interrupteur : seul `true` allumerait. Éteint ici. */
export const MARQUES_MOT_ACTIF = false;

export type MarqueMot = "pinceau" | "papier" | "chevauche" | "evide";
export const MARQUES_MOT: readonly MarqueMot[] = Object.freeze(["pinceau", "papier", "chevauche", "evide"] as const);

/** Hachage FNV-1a 32 bits d'une chaîne (recopié du bruit maison, pas importé). */
function hacher32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (s.charCodeAt(i) >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur à graine (mulberry32) → valeurs dans [0, 1). */
function aleatoire(graine: string): () => number {
  let a = hacher32(graine);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Marque tirée de la graine parmi les permises ; `null` si la liste est vide. */
export function tirerMarqueMot(graine: string, permises: readonly MarqueMot[] = MARQUES_MOT): MarqueMot | null {
  if (permises.length === 0) return null;
  const h = hacher32(`marque:${graine}`);
  // mélange final pour que les petites graines se répartissent bien
  const m = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return permises[((m ^ (m >>> 16)) >>> 0) % permises.length];
}

export type GeometrieMarque = {
  base: GeometriePave;
  chemin?: string;
  decalageYPx?: number;
  contourSeul?: true;
};

/** Point du contour (superellipse inscrite dans la boîte), élargi de 5 % de chaque dimension au plus (10 % au total). */
function pointContour(b: GeometriePave, angle: number, k: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const u = Math.sign(c) * Math.sqrt(Math.abs(c));
  const v = Math.sign(s) * Math.sqrt(Math.abs(s));
  const e = 1 + 0.05 * k;
  return [r2(b.x + b.largeur / 2 + u * (b.largeur / 2) * e), r2(b.y + b.hauteur / 2 + v * (b.hauteur / 2) * e)];
}

function cheminPinceau(b: GeometriePave, alea: () => number): string {
  const n = 24;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) pts.push(pointContour(b, (2 * Math.PI * i) / n, alea()));
  const milieu = (p: [number, number], q: [number, number]): [number, number] => [r2((p[0] + q[0]) / 2), r2((p[1] + q[1]) / 2)];
  const m0 = milieu(pts[n - 1], pts[0]);
  let d = `M ${m0[0]} ${m0[1]}`;
  for (let i = 0; i < n; i++) {
    const m = milieu(pts[i], pts[(i + 1) % n]);
    d += ` Q ${pts[i][0]} ${pts[i][1]} ${m[0]} ${m[1]}`;
  }
  return `${d} Z`;
}

/** Bord en dents : 6 à 14 dents, chacune = un creux puis une pointe (donc 2 × dents sommets, tous en `L`). */
function cheminPapier(b: GeometriePave, alea: () => number): string {
  const dents = 6 + Math.floor(alea() * 9);
  const sommets: [number, number][] = [];
  for (let i = 0; i < dents; i++) {
    const a0 = (2 * Math.PI * i) / dents;
    const a1 = (2 * Math.PI * (i + 0.5 + (alea() - 0.5) * 0.3)) / dents;
    sommets.push(pointContour(b, a0, 0));
    sommets.push(pointContour(b, a1, 0.4 + 0.6 * alea()));
  }
  return sommets.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") + " Z";
}

/** Forme de la plaque pour une marque. `base === null` (avant le mot) donne `null`. */
export function geometrieMarque(
  marque: MarqueMot,
  base: GeometriePave | null,
  taillePx: number,
  graine: string,
): GeometrieMarque | null {
  if (base === null) return null;
  const alea = aleatoire(`${graine}:${marque}`);
  switch (marque) {
    case "pinceau":
      return { base, chemin: cheminPinceau(base, alea) };
    case "papier":
      return { base, chemin: cheminPapier(base, alea) };
    case "chevauche":
      return { base, decalageYPx: r2(-(0.2 + 0.15 * alea()) * taillePx) };
    case "evide":
      return { base, contourSeul: true };
  }
}

/** Paire de couleurs de la charte pour une marque (fond de la plaque, texte). */
export function couleursMarque(
  _marque: MarqueMot,
  teinte: Extract<TeinteMarqueurRendu, "terracotta" | "ivoire">,
): { fond: string; texte: string } {
  const p = MARQUEURS[teinte];
  return { fond: p.fond, texte: p.texte };
}
