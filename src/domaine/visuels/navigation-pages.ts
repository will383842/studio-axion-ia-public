/** Navigation pure de la visionneuse des pages d'un carrousel (index en base 0). */

export function borner(index: number, total: number): number {
  if (total <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), total - 1);
}

export function suivant(index: number, total: number): number {
  return borner(index + 1, total);
}

export function precedent(index: number, total: number): number {
  return borner(index - 1, total);
}

/** Compteur affiché en base 1 : « 3 / 7 ». */
export function compteur(index: number, total: number): string {
  return `${borner(index, total) + 1} / ${total}`;
}

/** Grande vue : l'image ×2 si elle existe, sinon la ×1. */
export function urlGrandeVue(p: { urlX1?: string; urlX2?: string }): string | undefined {
  return p.urlX2 ?? p.urlX1;
}

export type ActionClavier = { type: "fermer" } | { type: "aller"; index: number };

/** Touche → action de la visionneuse (Échap ferme, flèches changent de page, bornes respectées). */
export function actionClavier(key: string, index: number, total: number): ActionClavier | null {
  if (key === "Escape") return { type: "fermer" };
  if (key === "ArrowRight") return { type: "aller", index: suivant(index, total) };
  if (key === "ArrowLeft") return { type: "aller", index: precedent(index, total) };
  return null;
}

/** Clic sur le fond sombre seulement : la cible est l'élément lui-même, pas un enfant (image, bouton). */
export function estClicFond(target: unknown, currentTarget: unknown): boolean {
  return target === currentTarget;
}
