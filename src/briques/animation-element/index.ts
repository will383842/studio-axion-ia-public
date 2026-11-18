/**
 * Brique « animation-element » (S-07) : nom stable par élément animé + fiche d'animation fermée.
 * Pure : aucun import hors de zod et de ce dossier ; aucune opération déclarée ici.
 */
export * from "./types";

/** Hachage FNV-1a 32 bits (stable, sans hasard ni horloge). */
function hacher(texte: string, graine: number): number {
  let h = graine >>> 0;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** 8 caractères [0-9a-z], même graine → même uid. */
export function creerUid(graine: string): string {
  const a = hacher(graine, 2166136261).toString(36).padStart(7, "0");
  const b = hacher(graine, 0x9e3779b9).toString(36).padStart(7, "0");
  return (a + b).slice(-8);
}

/**
 * Pose un `uid` aux éléments qui n'en ont pas, sans toucher ceux qui en ont ; garantit l'unicité
 * (suffixes `-2`, `-3`). Ne modifie pas la liste reçue.
 */
export function completerUids<T extends { uid?: string }>(elements: readonly T[], graineDe: (element: T, index: number) => string): Array<T & { uid: string }> {
  const pris = new Set<string>();
  for (const e of elements) if (e.uid) pris.add(e.uid);
  return elements.map((e, i) => {
    if (e.uid) return e as T & { uid: string };
    const base = creerUid(graineDe(e, i));
    let uid = base;
    for (let n = 2; pris.has(uid); n++) uid = `${base}-${n}`;
    pris.add(uid);
    return { ...e, uid };
  });
}
