/** BR-RACCORD-FORME-a-v21m · règle de pose du raccord par forme sur les tranches du cas concret (constante éteinte). */
import { describe, expect, it } from "vitest";
import { RACCORD_FORME_ACTIF, habillerTranches } from "@/moteurs/montage-cas-concret/habillage-plan";
import type { PlanHabille } from "@/briques/motion/habillage-commun/types";
import { PLAFONDS_PAR_DEFAUT } from "@/briques/motion/habillage-commun/types";
import { tranchePlan } from "@/briques/plan-scenes-generateurs/tranche";
import type { PlanValide } from "@/briques/plan-scenes/schema";

function planDe(n: number, facecam = false): PlanValide {
  const scenes = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, debutMs: i * 1500, finMs: i * 1500 + 1500, position: "haut", calques: [], mots: { premier: i, dernier: i } }));
  return { facecam, format: { largeur: 1080, hauteur: 1920, fps: 25 }, dureeMs: n * 1500, mots: [], scenes } as unknown as PlanValide;
}
const ECRANS = [0, 1, 2, 3].map((k) => ({ cle: `e${k}`, debutMs: k * 9000, finMs: (k + 1) * 9000 }));
function tranchesDe(plan: PlanValide): Record<string, PlanValide> {
  const r: Record<string, PlanValide> = {};
  for (const e of ECRANS) {
    const t = tranchePlan(plan, e.debutMs, e.finMs);
    if (t) r[e.cle] = t;
  }
  return r;
}
const lancer = (plan: PlanValide, graine: number, raccordForme?: boolean) =>
  habillerTranches({ actif: true, plan, ecrans: ECRANS, tranches: tranchesDe(plan), plafonds: { ...PLAFONDS_PAR_DEFAUT }, graine, ...(raccordForme === undefined ? {} : { raccordForme }) });
const habillages = (r: Readonly<Record<string, PlanValide>>) => Object.values(r).flatMap((t) => ((t as PlanHabille).habillageCommun ? [(t as PlanHabille).habillageCommun!] : []));

describe("raccord par forme : la constante est éteinte", () => {
  it("RACCORD_FORME_ACTIF vaut false", () => {
    expect(RACCORD_FORME_ACTIF).toBe(false);
  });
  it("éteint (par défaut ou `false` explicite) : mêmes tranches qu'avant, aucun champ `raccords`, 20 graines", () => {
    for (let g = 1; g <= 20; g++) {
      const plan = planDe(24);
      const defaut = lancer(plan, g);
      expect(lancer(plan, g, false)).toEqual(defaut);
      for (const h of habillages(defaut)) expect("raccords" in h).toBe(false);
    }
  });
  it("seul `true` exact allume (une chaîne ne suffit pas)", () => {
    const plan = planDe(24);
    for (let g = 1; g <= 20; g++) expect(lancer(plan, g, "true" as never)).toEqual(lancer(plan, g));
  });
});

describe("raccord par forme : règle de pose quand on l'allume", () => {
  it("au plus un raccord par tranche, paire carré → carte, posé sur la première scène qui a une transition d'entrée", () => {
    let vus = 0;
    for (let g = 1; g <= 20; g++) {
      const plan = planDe(24);
      const r = lancer(plan, g, true);
      for (const h of habillages(r)) {
        const cles = Object.keys(h.raccords ?? {});
        expect(cles.length).toBeLessThanOrEqual(1);
        if (cles.length === 0) continue;
        vus++;
        expect(h.raccords![cles[0]!]).toEqual({ de: "carre", vers: "carte" });
        const avecEntree = Object.keys(h.transitions ?? {}).filter((k) => h.transitions![k]?.entree);
        const rang = (k: string) => Number(k.slice(1));
        expect(cles[0]).toBe([...avecEntree].sort((a, b) => rang(a) - rang(b))[0]);
      }
    }
    expect(vus).toBeGreaterThan(0);
  });
  it("allumé : les transitions choisies sont les mêmes qu'éteint (le raccord s'ajoute, ne remplace rien)", () => {
    for (let g = 1; g <= 20; g++) {
      const plan = planDe(24);
      const off = habillages(lancer(plan, g, false)).map((h) => h.transitions);
      const on = habillages(lancer(plan, g, true)).map((h) => h.transitions);
      expect(on).toEqual(off);
    }
  });
  it("jamais devant un visage : un plan facecam ne reçoit aucun raccord", () => {
    for (let g = 1; g <= 20; g++) for (const h of habillages(lancer(planDe(24, true), g, true))) expect(h.raccords).toBeUndefined();
  });
  it("déterministe : même entrée, même résultat", () => {
    const plan = planDe(24);
    expect(JSON.stringify(lancer(plan, 5, true))).toBe(JSON.stringify(lancer(plan, 5, true)));
  });
});
