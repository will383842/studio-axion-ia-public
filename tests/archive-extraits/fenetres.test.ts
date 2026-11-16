import { describe, expect, it } from "vitest";
import {
  LECTEUR_FENETRES,
  MARGE_FENETRE_SEC,
  fenetresDuFormat,
  fenetresInconnues,
  fenetresParPlans,
  fenetresV4,
} from "@/briques/archive-extraits/fenetres";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";

function planV4(): PlanFacecamAnimee {
  return {
    duree: 60,
    elementsV4: [
      { id: "a", debut: 10, fin: 14 },
      { id: "b", debut: 20, fin: 24 },
      { id: "c", debut: 30, fin: 33 },
    ],
    fin: { debut: 55 },
  } as unknown as PlanFacecamAnimee;
}

describe("fenetresV4", () => {
  it("interdits : accroche, plaquettes avec marge, carte de fin ; visage = complément exact", () => {
    const f = fenetresV4(planV4());
    expect(MARGE_FENETRE_SEC).toBe(0.3);
    expect(f.inconnues).toBe(false);
    expect(f.interdits.map((i) => [i.debutSec, i.finSec, i.raison])).toEqual([
      [0, 5, "accroche"],
      [9.7, 14.3, "plaquette"],
      [19.7, 24.3, "plaquette"],
      [29.7, 33.3, "plaquette"],
      [55, 60, "carte-fin"],
    ]);
    expect(f.avecVisage.map((i) => [i.debutSec, i.finSec])).toEqual([
      [5, 9.7],
      [14.3, 19.7],
      [24.3, 29.7],
      [33.3, 55],
    ]);
  });
  it("fusionne les intervalles qui se touchent", () => {
    const p = { duree: 30, elementsV4: [{ id: "a", debut: 2, fin: 7 }], fin: { debut: 29 } } as unknown as PlanFacecamAnimee;
    const f = fenetresV4(p);
    expect(f.interdits[0]).toMatchObject({ debutSec: 0, finSec: 7.3 });
  });
  it("null → inconnues, sans erreur", () => {
    expect(fenetresV4(null)).toEqual(fenetresInconnues());
    expect(fenetresInconnues()).toEqual({ interdits: [], avecVisage: [], inconnues: true });
  });
});

describe("fenetresParPlans", () => {
  const plans = [
    { debutSec: 0, finSec: 4, sourceImage: "double" },
    { debutSec: 4, finSec: 8, sourceImage: "illustration", illustration: { source: "banque", verrouille: false, candidats: [] } },
    { debutSec: 8, finSec: 12, sourceImage: "rush" },
    { debutSec: 12, finSec: 16, sourceImage: "illustration", illustration: { source: "generee-ia", verrouille: false, candidats: [] } },
    { debutSec: 16, finSec: 20, sourceImage: "illustration", illustration: { source: "bibliotheque", verrouille: false, candidats: [] } },
  ] as Parameters<typeof fenetresParPlans>[0];
  it("tiers et visage", () => {
    const f = fenetresParPlans(plans);
    expect(f.inconnues).toBe(false);
    expect(f.interdits).toEqual([
      { debutSec: 4, finSec: 8, raison: "tiers" },
      { debutSec: 12, finSec: 16, raison: "tiers" },
    ]);
    expect(f.avecVisage.map((i) => [i.debutSec, i.finSec])).toEqual([[0, 4], [8, 12]]);
  });
});

describe("fenetresDuFormat", () => {
  it("aiguille par format et ne lève jamais", () => {
    expect(Object.keys(LECTEUR_FENETRES).sort()).toEqual(["avocat", "facecam", "facecam-animee"]);
    expect(fenetresDuFormat("cas-concret", {})).toEqual(fenetresInconnues());
    expect(fenetresDuFormat("facecam-animee", null)).toEqual(fenetresInconnues());
    expect(fenetresDuFormat("avocat", "n'importe quoi")).toEqual(fenetresInconnues());
    expect(fenetresDuFormat("facecam", undefined)).toEqual(fenetresInconnues());
    expect(fenetresDuFormat("facecam-animee", planV4()).interdits.length).toBe(5);
  });
  it("déterministe", () => {
    expect(fenetresDuFormat("facecam-animee", planV4())).toEqual(fenetresDuFormat("facecam-animee", planV4()));
  });
});
