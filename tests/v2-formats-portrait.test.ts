/**
 * VÉRIF V2 (10/10) — formats secondaires (4:5, 1:1, 16:9) d'une prise PORTRAIT d'iPhone (« J'ai déjà filmé ma vidéo »).
 *
 * Mesuré en faisant tourner la vraie chaîne sur une prise 1080 × 1920 : en 16:9, les plans 100, 115 et 130 % avaient
 * EXACTEMENT le même cadre (992 × 558) ; en 4:5 et 1:1, 6,5 % d'écart entre 100 et 115 %, 0 % entre 115 et 130 %.
 * Le plancher d'agrandissement (1,16) écrasait les tailles : chaque coupe devenait une saute (même cadre de part et
 * d'autre), contraire à la grammaire du montage (≥ 12 % d'écart à chaque changement de taille).
 */
import { describe, expect, it } from "vitest";
import { plansDuFormat, sourceUtile } from "@/briques/formats-facecam/cadrage";
import { GRAMMAIRE_MONTAGE, realiser, type PlanCamera } from "@/briques/realisation";

const TAILLES = [100, 115, 100, 130, 115, 130, 100] as const;

function plans916(source: { largeur: number; hauteur: number }): PlanCamera[] {
  const r = realiser({ gardes: [{ debutSec: 0, finSec: 21 }], mots: [], piste: null, source });
  // Plans du 9:16 aux tailles voulues (même visage, centré), 3 s chacun.
  return TAILLES.map((taille, i) => {
    const base = r.plans[0];
    const largeur = 2 * Math.round(base.cadre.largeur / (taille / 100) / 2);
    const hauteur = 2 * Math.round(base.cadre.hauteur / (taille / 100) / 2);
    return { ...base, debutSec: i * 3, finSec: i * 3 + 3, priseDebutSec: i * 3, priseFinSec: i * 3 + 3, taille, ouverture: i ? "coupe" : "debut", cadre: { x: (source.largeur - largeur) / 2, y: Math.round(0.34 * source.hauteur - 0.34 * hauteur), largeur, hauteur } };
  });
}

describe("Vérif V2 — formats secondaires d'une prise portrait : chaque changement de taille reste visible", () => {
  for (const source of [{ largeur: 1080, hauteur: 1920 }, { largeur: 2160, hauteur: 3840 }]) {
    for (const ratio of ["4:5", "1:1", "16:9"] as const) {
      it(`${source.largeur} × ${source.hauteur} → ${ratio} : ≥ ${GRAMMAIRE_MONTAGE.ecartTaillePctMin} % d'écart à chaque changement de taille, cadre dans la source`, () => {
        const plans = plansDuFormat(ratio, plans916(source), source, null);
        const utile = sourceUtile(source);
        for (let i = 1; i < plans.length; i++) {
          const [a, b] = [plans[i - 1], plans[i]];
          if (a.taille === b.taille) continue;
          const ecart = (Math.max(a.cadre.hauteur, b.cadre.hauteur) / Math.min(a.cadre.hauteur, b.cadre.hauteur) - 1) * 100;
          expect(ecart, `${a.taille} → ${b.taille} : ${a.cadre.hauteur} → ${b.cadre.hauteur}`).toBeGreaterThanOrEqual(GRAMMAIRE_MONTAGE.ecartTaillePctMin - 0.5);
          // Le plus serré est bien le plus grand pourcentage.
          expect(Math.sign(a.cadre.hauteur - b.cadre.hauteur)).toBe(Math.sign(b.taille - a.taille));
        }
        for (const p of plans) {
          expect(p.cadre.x).toBeGreaterThanOrEqual(utile.x);
          expect(p.cadre.y).toBeGreaterThanOrEqual(utile.y);
          expect(p.cadre.x + p.cadre.largeur).toBeLessThanOrEqual(utile.x + utile.largeur);
          expect(p.cadre.y + p.cadre.hauteur).toBeLessThanOrEqual(utile.y + utile.hauteur);
        }
      });
    }
  }
});
