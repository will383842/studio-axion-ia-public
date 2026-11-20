import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validerVoletPlan } from "@/briques/plan-scenes/briques/volet-plan";
import { OBJET_VOLET_AVANT_APRES } from "@/briques/motion/petits-objets/volet-avant-apres";

describe("validerVoletPlan", () => {
  it("a) accepte sans adresse", () => {
    expect(validerVoletPlan({})).toEqual({});
    expect(validerVoletPlan({ sens: "droite-gauche", etiquettes: true })).toEqual({ sens: "droite-gauche", etiquettes: true });
  });
  it("b) refuse toute adresse", () => {
    for (const p of [{ avant: "x" }, { apres: "x" }, { avant: "a", apres: "b" }, { avant: undefined }, { avant: "" }]) expect(validerVoletPlan(p)).toBeNull();
  });
  it("c) refuse sens ou étiquettes invalides", () => {
    expect(validerVoletPlan({ sens: "haut" })).toBeNull();
    expect(validerVoletPlan({ etiquettes: "oui" })).toBeNull();
  });
  it("d) refuse les non-objets sans lever", () => {
    for (const p of [null, "x", [], 42, undefined]) expect(validerVoletPlan(p)).toBeNull();
  });
  it("e) un getter qui lève donne null", () => {
    const p = {};
    Object.defineProperty(p, "sens", { enumerable: true, get() { throw new Error("boum"); } });
    expect(validerVoletPlan(p)).toBeNull();
  });
  it("f) garde statique", () => {
    const src = readFileSync("src/briques/plan-scenes/briques/volet-plan.ts", "utf8");
    expect(src.match(/^\s*import .*$/gm)).toEqual(['import type { SensVolet } from "../../motion/petits-objets/volet-avant-apres";']);
    for (const m of ["@/", "zod", "plan-scenes-objets", "remotion"]) expect(src).not.toContain(m);
  });
  it("g) le valider d'origine ne convient pas au plan", () => {
    expect(validerVoletPlan({ etiquettes: true })).toEqual({ etiquettes: true });
    expect(OBJET_VOLET_AVANT_APRES.valider({ etiquettes: true })).toBeNull();
  });
});
