/**
 * Lecture d'une raison de refus STOCKÉE (`refusPrive`) : le validateur strict refuse toute clé en plus, donc aussi `le`.
 * On retire `le`, on valide le reste, puis on vérifie `le` à part. PUR ; ne touche pas `raison-refus.ts`.
 */
import { estRaisonRefus, type RaisonRefus } from "./raison-refus";

export function lireRaisonStockee(x: unknown): (RaisonRefus & { le: string }) | null {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return null;
  const { le, ...reste } = x as Record<string, unknown>;
  if (typeof le !== "string" || !Number.isFinite(Date.parse(le))) return null;
  return estRaisonRefus(reste) ? { ...reste, le } : null;
}
