/* eslint-disable @typescript-eslint/no-explicit-any -- pièce factice injectée dans le catalogue, le temps du test */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES, pieceLaPlusProche } from "@/briques/plan-scenes/catalogue";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";

const AVANT = readFileSync(new URL("./__fixtures__/consigne-avant-porte.txt", import.meta.url), "utf8");
const catalogue = CATALOGUE_BRIQUES as unknown as Record<string, any>;
const toiles = TOILES as unknown as Record<string, unknown>;
const copie = () => structuredClone(PLAN_DEMO) as unknown as Record<string, any>;

describe("porte C9-33 : la consigne ne change pas", () => {
  it("sans argument et avec une liste vide : identique à la consigne d'avant la porte", () => {
    expect(consignePlan()).toBe(AVANT);
    expect(consignePlan([])).toBe(AVANT);
  });

  it("les plans d'essai sont identiques avec ou sans liste vide", () => {
    expect(validerPlan(PLAN_DEMO, { objetsPermis: [] })).toEqual(validerPlan(PLAN_DEMO));
    expect(validerPlan(null, { objetsPermis: [] })).toEqual(validerPlan(null));
  });
});

describe("porte C9-33 : une pièce objet factice (injectée ici seulement)", () => {
  beforeEach(() => {
    catalogue["objet-test"] = { ...catalogue["legende"], id: "objet-test", nom: "Objet test", famille: "objet", alias: ["bidule-test"] };
    toiles["objet-test"] = { largeur: 800, hauteur: 460 };
  });
  afterEach(() => {
    delete catalogue["objet-test"];
    delete toiles["objet-test"];
  });

  it("n'apparaît dans la consigne que si elle est permise", () => {
    expect(consignePlan()).toBe(AVANT);
    expect(consignePlan([])).toBe(AVANT);
    expect(consignePlan(["objet-test"])).toContain("- objet-test (Objet test)");
    expect(consignePlan(["objet-test"])).not.toBe(AVANT);
  });

  it("pieceLaPlusProche ne la renvoie pas sans permission", () => {
    expect(pieceLaPlusProche("objet-test")).not.toBe("objet-test");
    expect(pieceLaPlusProche("bidule-test")).not.toBe("objet-test");
    expect(pieceLaPlusProche("objet-test", undefined, ["objet-test"])).toBe("objet-test");
    expect(pieceLaPlusProche("bidule-test", undefined, ["objet-test"])).toBe("objet-test");
  });

  it("validerPlan refuse la scène sans permission (repli, « objet non permis ») et l'accepte avec", () => {
    const p = copie();
    p.scenes[0].piece = "objet-test";
    const sans = validerPlan(p);
    expect(sans.plan.scenes[0]!.piece).not.toBe("objet-test");
    expect(sans.remarques.some((r) => /objet non permis/i.test(r.message))).toBe(true);
    const avec = validerPlan(p, { objetsPermis: ["objet-test"] });
    expect(avec.plan.scenes[0]!.piece).toBe("objet-test");
    expect(avec.remarques.some((r) => /objet non permis/i.test(r.message))).toBe(false);
  });

  it("validerPlan refuse le calque objet sans permission (ajout par le chat, revalidé sans liste)", () => {
    const p = copie();
    p.scenes[0].niveau = 2;
    p.scenes[0].calques = [{ piece: "objet-test", parametres: {}, debutMs: 0, zone: "plein" }];
    const sans = validerPlan(p);
    expect((sans.plan.scenes[0]!.calques ?? []).some((c) => (c.piece as string) === "objet-test")).toBe(false);
    expect(sans.remarques.some((r) => /objet non permis/i.test(r.message))).toBe(true);
    const avec = validerPlan(p, { objetsPermis: ["objet-test"] });
    expect((avec.plan.scenes[0]!.calques ?? []).some((c) => (c.piece as string) === "objet-test")).toBe(true);
  });
});
