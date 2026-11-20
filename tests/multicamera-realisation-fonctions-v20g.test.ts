import { describe, expect, it } from "vitest";
import { angleAuTemps, anglesUtilisables, coupeDansUnMot } from "@/briques/multicamera/realisation";
import type { AngleMulticamera, PlanCamera } from "@/briques/multicamera/types";

const mots = [
  { debutSec: 0, finSec: 1 },
  { debutSec: 1.5, finSec: 2.5 },
];

describe("coupeDansUnMot", () => {
  it("vrai strictement à l'intérieur d'un mot", () => {
    expect(coupeDansUnMot(0.5, mots)).toBe(true);
    expect(coupeDansUnMot(2, mots)).toBe(true);
  });
  it("faux dans un blanc, sur les bornes, hors de la prise", () => {
    expect(coupeDansUnMot(1.25, mots)).toBe(false);
    expect(coupeDansUnMot(0, mots)).toBe(false);
    expect(coupeDansUnMot(1, mots)).toBe(false);
    expect(coupeDansUnMot(1.5, mots)).toBe(false);
    expect(coupeDansUnMot(2.5, mots)).toBe(false);
    expect(coupeDansUnMot(-3, mots)).toBe(false);
    expect(coupeDansUnMot(99, mots)).toBe(false);
  });
  it("aucun mot : faux ; la liste reçue n'est pas modifiée", () => {
    expect(coupeDansUnMot(1, [])).toBe(false);
    const copie = structuredClone(mots);
    coupeDansUnMot(0.5, mots);
    expect(mots).toEqual(copie);
  });
});

describe("anglesUtilisables", () => {
  it("ordre stable face, côté, contre-plongée, quel que soit l'ordre reçu", () => {
    expect(anglesUtilisables(["contre-plongee", "cote"])).toEqual(["face", "cote", "contre-plongee"]);
    expect(anglesUtilisables(["cote", "contre-plongee", "face"])).toEqual(["face", "cote", "contre-plongee"]);
  });
  it("la face est toujours présente, une seule fois ; angle absent écarté", () => {
    expect(anglesUtilisables([])).toEqual(["face"]);
    expect(anglesUtilisables(["face", "face"])).toEqual(["face"]);
    expect(anglesUtilisables(["contre-plongee"])).toEqual(["face", "contre-plongee"]);
  });
  it("ne modifie pas le tableau reçu", () => {
    const d: AngleMulticamera[] = ["contre-plongee", "cote"];
    anglesUtilisables(d);
    expect(d).toEqual(["contre-plongee", "cote"]);
  });
});

describe("angleAuTemps", () => {
  const plans: PlanCamera[] = [
    { angle: "face", debutSec: 0, finSec: 3, raison: "accroche", premierMot: 0, dernierMot: 3 },
    { angle: "cote", debutSec: 3, finSec: 7, raison: "explication", premierMot: 4, dernierMot: 9 },
  ];
  it("renvoie l'angle du plan qui couvre l'instant ; la fin d'un plan appartient au suivant", () => {
    expect(angleAuTemps(plans, 0)).toBe("face");
    expect(angleAuTemps(plans, 2.99)).toBe("face");
    expect(angleAuTemps(plans, 3)).toBe("cote");
    expect(angleAuTemps(plans, 5)).toBe("cote");
  });
  it("au-delà de la fin ou avant le début : le dernier plan ; sans plan : face", () => {
    expect(angleAuTemps(plans, 7)).toBe("cote");
    expect(angleAuTemps(plans, 100)).toBe("cote");
    expect(angleAuTemps(plans, -1)).toBe("cote");
    expect(angleAuTemps([], 2)).toBe("face");
  });
});
