import { describe, expect, it } from "vitest";

import { evaluerSeuil } from "./seuil";

describe("evaluerSeuil", () => {
  const regleAuMoins = { seuil: 10, sens: "au-moins" as const };
  const regleAuPlus = { seuil: 10, sens: "au-plus" as const };

  describe("valeur non évaluable", () => {
    it("renvoie « non-evalue » pour null", () => {
      expect(evaluerSeuil(null, regleAuMoins)).toBe("non-evalue");
    });

    it("renvoie « non-evalue » pour undefined", () => {
      expect(evaluerSeuil(undefined, regleAuMoins)).toBe("non-evalue");
    });

    it("renvoie « non-evalue » pour NaN", () => {
      expect(evaluerSeuil(Number.NaN, regleAuMoins)).toBe("non-evalue");
    });

    it("renvoie « non-evalue » pour Infinity", () => {
      expect(evaluerSeuil(Number.POSITIVE_INFINITY, regleAuMoins)).toBe("non-evalue");
      expect(evaluerSeuil(Number.NEGATIVE_INFINITY, regleAuPlus)).toBe("non-evalue");
    });
  });

  describe("sens « au-moins »", () => {
    it("renvoie « alerte » quand la valeur est égale au seuil", () => {
      expect(evaluerSeuil(10, regleAuMoins)).toBe("alerte");
    });

    it("renvoie « alerte » quand la valeur dépasse le seuil", () => {
      expect(evaluerSeuil(11, regleAuMoins)).toBe("alerte");
    });

    it("renvoie « ok » quand la valeur est hors seuil", () => {
      expect(evaluerSeuil(9, regleAuMoins)).toBe("ok");
    });
  });

  describe("sens « au-plus »", () => {
    it("renvoie « alerte » quand la valeur est égale au seuil", () => {
      expect(evaluerSeuil(10, regleAuPlus)).toBe("alerte");
    });

    it("renvoie « alerte » quand la valeur est sous le seuil", () => {
      expect(evaluerSeuil(9, regleAuPlus)).toBe("alerte");
    });

    it("renvoie « ok » quand la valeur est hors seuil", () => {
      expect(evaluerSeuil(11, regleAuPlus)).toBe("ok");
    });
  });
});
