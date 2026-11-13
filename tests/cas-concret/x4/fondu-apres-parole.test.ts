import { describe, expect, it } from "vitest";
import { parametresRaccord, parametresRecette, planRaccordVoix, planRecetteVoix } from "@/moteurs/montage-cas-concret/recette-voix";
import type { MotHorodate } from "@/domaine/types";

// GV2-16 : le fondu de sortie ne commence jamais avant la fin du dernier mot (+ 0,12 s), quelle que soit la queue
// réellement gardée après lui ; la durée après le dernier mot reste celle d'une queue complète.
const mots = (finDernier: number): MotHorodate[] => [
  { mot: "Bonjour", debutSec: 0.2, finSec: 0.7 },
  { mot: "à", debutSec: 0.8, finSec: 0.9 },
  { mot: "tous.", debutSec: 9.4, finSec: finDernier },
];
const FIN_MOT = 10;
const APRES = [0, 0.05, 0.2, 0.6];
const finDernierMotFinal = (plan: { mots: { finSec: number }[] }) => plan.mots.at(-1)!.finSec;

describe("fondu de sortie après la parole (plan seul)", () => {
  const plans = APRES.map((a) => planRecetteVoix(mots(FIN_MOT), FIN_MOT + a));

  it("(a) le fondu commence au plus tôt 0,12 s après le dernier mot", () => {
    for (const p of plans) expect(p.debutFonduSortieSec).toBeGreaterThanOrEqual(finDernierMotFinal(p) + 0.12 - 1e-6);
  });
  it("(b) la durée après le dernier mot est la même dans les quatre cas", () => {
    const apres = plans.map((p) => p.dureeSec - finDernierMotFinal(p));
    for (const x of apres) expect(Math.abs(x - apres[3])).toBeLessThan(0.001);
  });
  it("(c) queue complète : plan identique à celui d'avant (fondu 0,22 s, silence 0,8 s)", () => {
    const p = plans[3];
    expect(p.fonduSortieSec).toBe(0.22);
    expect(p.silenceFinSec).toBe(0.8);
    expect(p.debutFonduSortieSec).toBeCloseTo(p.dureeSec - 0.8 - 0.22, 3);
  });
  it("le fondu ne dépasse jamais ce qui reste avant la fin de la parole", () => {
    for (const p of plans) if (p.fonduSortieSec > 0) expect(p.debutFonduSortieSec + p.fonduSortieSec).toBeLessThanOrEqual(p.dureeSec - p.silenceFinSec + 1e-6);
  });
  it("les paramètres du rendu lisent le plan", () => {
    for (const p of plans) {
      const r = parametresRecette(p);
      expect(r.fonduSortieSec).toBe(p.fonduSortieSec);
      expect(r.silenceFinSec).toBe(p.silenceFinSec);
      expect(r.debutFonduSortieSec).toBe(p.debutFonduSortieSec);
    }
  });
});

describe("fondu de sortie après la parole (raccord corps + fin)", () => {
  const corps = { mots: [{ mot: "Salut.", debutSec: 0.2, finSec: 1 }], dureeSec: 1.6 };
  const fin = (a: number) => ({ mots: mots(FIN_MOT), dureeSec: FIN_MOT + a });
  const plans = APRES.map((a) => planRaccordVoix(corps, fin(a)));

  it("(a) le fondu commence au plus tôt 0,12 s après le dernier mot", () => {
    for (const p of plans) expect(p.debutFonduSortieSec).toBeGreaterThanOrEqual(finDernierMotFinal(p) + 0.12 - 1e-6);
  });
  it("(b) la durée après le dernier mot est la même dans les quatre cas", () => {
    const apres = plans.map((p) => p.dureeSec - finDernierMotFinal(p));
    for (const x of apres) expect(Math.abs(x - apres[3])).toBeLessThan(0.001);
  });
  it("(c) queue complète : fondu 0,22 s, silence 0,8 s", () => {
    expect(plans[3].fonduSortieSec).toBe(0.22);
    expect(plans[3].silenceFinSec).toBe(0.8);
  });
  it("les paramètres du raccord lisent le plan", () => {
    for (const p of plans) {
      const r = parametresRaccord(p);
      expect(r.fonduSortieSec).toBe(p.fonduSortieSec);
      expect(r.silenceFinSec).toBe(p.silenceFinSec);
    }
  });
  it("sans phrase de fin : mêmes garanties", () => {
    const ps = APRES.map((a) => planRaccordVoix({ mots: mots(FIN_MOT), dureeSec: FIN_MOT + a }));
    for (const p of ps) expect(p.debutFonduSortieSec).toBeGreaterThanOrEqual(finDernierMotFinal(p) + 0.12 - 1e-6);
  });
});
