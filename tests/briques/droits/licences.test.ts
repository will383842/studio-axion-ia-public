import { describe, expect, it } from "vitest";
import { DROITS, TYPES_PIECE } from "../../../src/briques/droits";
import type { EntreeDroit } from "../../../src/briques/droits";
import { LICENCES_SANS_CREDIT, SPDX_ADMIS, admissibleEnAutomatique } from "../../../src/briques/droits/licences";

const faux = (licence: string, extra: Partial<EntreeDroit> = {}): EntreeDroit => ({
  id: "faux", type: "police", licence, auteur: "x", preuve: "x", date: "2026-11-15", ...extra,
});

describe("licences sans crédit", () => {
  it("liste exacte des libellés", () => {
    expect([...LICENCES_SANS_CREDIT]).toEqual(["Création interne Axion-IA", "ISC", "SIL OFL 1.1", "ISC + MIT (Feather)", "CC0 1.0", "MIT", "Apache-2.0"]);
    expect(LICENCES_SANS_CREDIT).not.toContain("Lottie Simple License");
    expect([...SPDX_ADMIS]).toEqual(["MIT", "ISC", "Apache-2.0", "CC0-1.0", "Unlicense", "OFL-1.1"]);
  });

  it("toutes les entrées du registre (hors logo-outil) sont admissibles", () => {
    const lot = DROITS.filter((d) => d.type !== "logo-outil");
    expect(lot.length).toBeGreaterThanOrEqual(48);
    for (const d of lot) expect(admissibleEnAutomatique(d), d.id).toBe(true);
  });

  it("AM-17 : le type logo-outil existe et est exclu du lot de licences libres", () => {
    expect(TYPES_PIECE).toContain("logo-outil");
    expect(DROITS.filter((d) => d.type === "logo-outil")).toEqual([]);
  });

  it("refuse les licences à crédit ou inconnues (la garde mord)", () => {
    for (const l of ["CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-ND", "CC-BY-NC", "GPL-3.0", "MPL-2.0", "LicenseRef-x", "Licence inconnue", ""])
      expect(admissibleEnAutomatique(faux(l)), l).toBe(false);
  });

  it("refuse si creditRequis est vrai", () => {
    expect(admissibleEnAutomatique({ ...faux("MIT"), creditRequis: true } as unknown as EntreeDroit)).toBe(false);
  });

  it("icône/animation : exige spdx admis et fichier de licence", () => {
    const ok = { type: "icone" as const, spdx: "MIT", fichierLicence: "LICENSE" };
    expect(admissibleEnAutomatique(faux("MIT", ok))).toBe(true);
    expect(admissibleEnAutomatique(faux("MIT", { ...ok, spdx: "CC-BY-4.0" }))).toBe(false);
    expect(admissibleEnAutomatique(faux("MIT", { ...ok, fichierLicence: undefined }))).toBe(false);
    expect(admissibleEnAutomatique(faux("MIT", { type: "animation", spdx: "MIT" }))).toBe(false);
  });
});
