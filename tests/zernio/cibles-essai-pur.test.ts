/** Cibles d'essai : module pur. Identifiants factices. */
import { describe, expect, it } from "vitest";
import {
  cibleEssaiPermise,
  comptesEssai,
  essaiActif,
  VARIABLE_ESSAI_COMPTES,
} from "@/domaine/guide-reseau/cibles-essai";

const X = "compte-fb-essai-x";
const Y = "compte-fb-autre-y";
const V = VARIABLE_ESSAI_COMPTES;

describe("S1 · variable absente, vide, mal formée : jamais permis", () => {
  it.each([
    ["absente", {}],
    ["undefined", { [V]: undefined }],
    ["vide", { [V]: "" }],
    ["blancs", { [V]: "   " }],
    ["étoile", { [V]: "*" }],
    ["étoile avec un compte", { [V]: `${X},*` }],
    ["entrée vide", { [V]: `${X},` }],
    ["entrée trop courte", { [V]: `${X},ab` }],
    ["caractère interdit", { [V]: `${X};${Y}` }],
    ["plus de trois comptes", { [V]: `${X},${Y},compte-fb-3-zzz,compte-fb-4-zzz` }],
  ])("%s", (_n, env) => {
    expect(comptesEssai(env)).toEqual([]);
    expect(essaiActif(env)).toBe(false);
    expect(cibleEssaiPermise(env, X, "facebook")).toBe(false);
  });
});

describe("compte listé et Facebook seulement", () => {
  const env = { [V]: ` ${X} , ${Y} ` };
  it("listé + facebook : vrai", () => {
    expect(comptesEssai(env)).toEqual([X, Y]);
    expect(cibleEssaiPermise(env, X, "facebook")).toBe(true);
    expect(cibleEssaiPermise(env, Y, "facebook")).toBe(true);
  });
  it("compte non listé : faux", () => {
    expect(cibleEssaiPermise(env, "compte-fb-inconnu", "facebook")).toBe(false);
    expect(cibleEssaiPermise(env, undefined, "facebook")).toBe(false);
    expect(cibleEssaiPermise(env, "", "facebook")).toBe(false);
  });
  it("jamais Instagram ni un autre réseau, même listé", () => {
    for (const r of ["instagram", "linkedin", "tiktok", "tous", null, undefined])
      expect(cibleEssaiPermise(env, X, r)).toBe(false);
  });
  it("égalité exacte : ni préfixe ni sous-chaîne", () => {
    expect(cibleEssaiPermise(env, "compte-fb-essai", "facebook")).toBe(false);
    expect(cibleEssaiPermise(env, `${X}-suite`, "facebook")).toBe(false);
    expect(cibleEssaiPermise({ [V]: "compte-fb-essai" }, X, "facebook")).toBe(false);
  });
});

import { auteurEssaiPermis, auteursEssai } from "@/domaine/guide-reseau/cibles-essai";
describe("auteurs d'essai (PARCOURS_ESSAI_AUTEURS)", () => {
  const A = "auteur-fictif-001";
  const B = "auteur-fictif-002";
  it("listés : permis ; autre, vide, absent : refusé", () => {
    const env = { PARCOURS_ESSAI_AUTEURS: ` ${A} , ${B} ` };
    expect(auteursEssai(env)).toEqual([A, B]);
    expect(auteurEssaiPermis(env, A)).toBe(true);
    expect(auteurEssaiPermis(env, "auteur-fictif-009")).toBe(false);
    expect(auteurEssaiPermis(env, "")).toBe(false);
    expect(auteurEssaiPermis(env, undefined)).toBe(false);
  });
  it.each([[undefined], [""], ["*"], [`${A},`], [`${A},ab`], [`${A},${B},auteur-fictif-003,auteur-fictif-004`]])("%s : fermé", (v) => {
    expect(auteurEssaiPermis({ PARCOURS_ESSAI_AUTEURS: v }, A)).toBe(false);
  });
});
