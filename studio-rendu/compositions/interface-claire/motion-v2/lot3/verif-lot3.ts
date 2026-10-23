/** Contrôles géométriques du lot 3 (sans rendu) : `npx tsx compositions/interface-claire/motion-v2/lot3/verif-lot3.ts`. Prise commune des planches v2. */
import { planMotSaute } from "./MotSaute";
import { planPile } from "./PileLettres";
import { imagesVisagePartiel } from "./RafaleTroisMots";
import { boiteTournee, dimensionsMot, intersecte, zonePx, PRISE_COMMUNE_LOT } from "./outils3";
const W = 1080, H = 1920, A = W * H;
const prise = PRISE_COMMUNE_LOT;
const Z = zonePx(prise, W, H);
const pct = (b: { x0: number; x1: number; y0: number; y1: number }) => (((b.x1 - b.x0) * (b.y1 - b.y0)) / A * 100).toFixed(1) + " %";
const pl = planMotSaute({ largeurImage: W, hauteurImage: H, mot: "RETARD", prise });
let dedans = 0;
for (let k = 0; k < 14; k += 0.25) { const e = pl.vol(k); const d = dimensionsMot("RETARD", e.taille); if (intersecte(boiteTournee(e.cx, e.cy, d.w, d.h, e.rot), Z)) dedans++; }
const d = dimensionsMot("RETARD", pl.tailleF);
const b = boiteTournee(pl.cible.x, pl.cible.y, d.w, d.h, pl.rotFin);
console.log("11 saute: cote", pl.sens, "corps", Math.round(pl.tailleF), "px, boite posee", pct(b), "largeur", ((d.w / W) * 100).toFixed(0), "% L, images dans Z:", dedans, "cible", Math.round(pl.cible.x), Math.round(pl.cible.y));
const pi = planPile({ largeurImage: W, hauteurImage: H, mot: "AGENDA", prise });
console.log("14 pile: corps", Math.round(pi.taille), "px, boite", pct(pi.globale), "dans Z:", pi.hors, "x0", Math.round(pi.globale.x0), "Z.x1", Math.round(Z.x1), "y", Math.round(pi.globale.y0), Math.round(pi.globale.y1));
console.log("13 rafale: images de visage partiel:", imagesVisagePartiel(W, H, prise), "(plein ecran = 100 % de l'image)");
