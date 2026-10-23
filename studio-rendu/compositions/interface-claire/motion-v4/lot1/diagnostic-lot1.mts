/**
 * Diagnostic du lot 1 (sans rendu) : écart max entre événements d'un objet (≤ 12 i), densité, sous-titres contre la bande des yeux à CHAQUE image,
 * trajectoire du MotSaute (bord droit ≤ 0,95 L, recouvrement de Z).
 * Usage (depuis `studio-rendu/`) : npx tsx compositions/interface-claire/motion-v4/lot1/diagnostic-lot1.mts
 */
import { definitions, enchainement, IDS_ELEMENTS } from "./ScenesLot1";
import { pointTrajet, largeurBase, hauteurBase } from "./MotSaute";
import { zoneVisage, bandeYeux, centreSurs, descenteA, W, H, DESCENTE, FPS } from "./commun-lot1";
import type { DefScene } from "./ScenesLot1";

const defs = definitions("B");
const verifier = (nom: string, d: DefScene): void => {
  let maxGap = 0;
  for (const x of d.instances) {
    const e = [...x.evts].sort((a, b) => a - b);
    for (let k = 1; k < e.length; k++) maxGap = Math.max(maxGap, e[k] - e[k - 1]);
  }
  const ev = d.instances.flatMap((x) => x.evts.map((e) => x.at + e));
  // sous-titres : boîte du groupe (hauteur plaque max 1,32 × 84 + 10) jamais dans la bande des yeux, à chaque image
  let pire = 1e9;
  for (let i = 0; i < d.total; i++) {
    const dd = descenteA(i, d.cles);
    const c = centreSurs(dd, 1.32 * 84 + 10);
    const haut = c - (1.32 * 84 + 10) / 2;
    pire = Math.min(pire, haut - bandeYeux(dd).y1);
  }
  const premier = Math.min(...d.instances.map((x) => x.at));
  const fin = Math.max(...d.instances.map((x) => x.at + x.duree));
  console.log(`${nom.padEnd(16)} ${(d.total / FPS).toFixed(2)} s · prise seule au début ${premier} i · queue ${d.total - fin} i · ${ev.length} événements (${(ev.length / (d.total / FPS)).toFixed(1)}/s) · écart max ${maxGap} i (${(maxGap / FPS).toFixed(2)} s) · marge sous-titre/yeux min ${pire.toFixed(0)} px`);
};
console.log("=== Extraits (palette B) ===");
for (const id of IDS_ELEMENTS) verifier(id, defs[id]);
console.log("\n=== Enchaînement 15 s ===");
const e = enchainement("B");
verifier("enchainement", e);
const ev = e.instances.flatMap((x) => x.evts.map((n) => x.at + n)).sort((a, b) => a - b);
let mini = 99;
for (let t = 0; t + 5 * FPS <= 450; t += 3) mini = Math.min(mini, ev.filter((x) => x >= t && x < t + 5 * FPS).length / 5);
console.log(`densité ${(ev.length / 15).toFixed(2)}/s, minimale sur 5 s glissantes ${mini.toFixed(2)}/s`);
const couvert = new Array(450).fill(false);
for (const x of e.instances) for (let i = x.at; i < Math.min(450, x.at + x.duree); i++) couvert[i] = true;
console.log(`images sans objet : ${couvert.filter((c) => !c).length}`);

console.log("\n=== MotSaute : trajectoire (D1) ===");
const z = zoneVisage(DESCENTE.D1);
for (const mot of ["TEMPS", "DEVIS", "SEUL"]) {
  const bw = largeurBase(mot), bh = hauteurBase();
  let aireMax = 0, droite = 0, imagesZ = 0;
  for (let i = 0; i <= 8; i++) {
    const p = Math.min(1, i / 8); const q = p * p * (3 - 2 * p);
    const pos = pointTrajet(q, mot);
    const x0 = pos.x - (bw * pos.s) / 2, x1 = pos.x + (bw * pos.s) / 2, y0 = pos.y - (bh * pos.s) / 2, y1 = pos.y + (bh * pos.s) / 2;
    const ix = Math.max(0, Math.min(x1, z.x1) - Math.max(x0, z.x0)), iy = Math.max(0, Math.min(y1, z.y1) - Math.max(y0, z.y0));
    const aire = ((ix * iy) / (W * H)) * 100;
    if (aire > 0.2) imagesZ++;
    aireMax = Math.max(aireMax, aire); droite = Math.max(droite, x1 / W);
  }
  console.log(`${mot}: bord droit max ${droite.toFixed(3)} L · recouvrement max de Z ${aireMax.toFixed(2)} % · images avec recouvrement > 0,2 % : ${imagesZ}`);
}
void H;
