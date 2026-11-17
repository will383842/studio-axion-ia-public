/**
 * Dessins inachevés (FIX-CONTROLES-IMAGE-AVANT-PRET-c) : fonction PURE, non branchée (le branchement est la pièce -b).
 * Un dessin = les traits `contour` d'un même `id` (animation-3.ts:33-34). Un trait est « posé » avant `fin` s'il est
 * tracé en entier, ou posé en fondu (`fondu: true`), avant `fin`. Un dessin est inachevé dès qu'un de ses traits ne l'est pas.
 */
import type { Plan3 } from "@/briques/tableau-scene/reference/animation-3";

const TOLERANCE_SEC = 0.001;

export function dessinsInacheves(plan: Plan3, fin: number): { id: string; partie: string }[] {
  const res: { id: string; partie: string }[] = [];
  const vus = new Set<string>();
  for (const a of plan.actions) {
    if (a.trace !== "contour") continue;
    if (a.debut + a.duree <= fin + TOLERANCE_SEC) continue;
    const cle = `${a.id}\u0000${a.partie}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    res.push({ id: a.id, partie: a.partie });
  }
  return res;
}
