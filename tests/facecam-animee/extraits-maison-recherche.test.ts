/** Extraits maison v4 (C4-U4.1) : préfixe `axion:` et type d'un extrait candidat. Pur, sans réseau. */
import { describe, expect, it } from "vitest";
import {
  PREFIXE_AXION, ecrireRechercheAxion, estRechercheAxion, lireRechercheAxion,
} from "@/moteurs/montage-facecam-animee/extraits-maison/recherche";
import { DUREE_MIN_EXTRAIT_V4_SEC, type ExtraitMaisonV4 } from "@/moteurs/montage-facecam-animee/extraits-maison/types";

describe("extraits maison v4 · recherche axion:", () => {
  it("préfixe et durée minimale", () => {
    expect(PREFIXE_AXION).toBe("axion:");
    expect(DUREE_MIN_EXTRAIT_V4_SEC).toBe(3);
  });

  it("aller-retour écrire → lire", () => {
    const s = ecrireRechercheAxion(["Chat", "bureau"]);
    expect(s.startsWith("axion:")).toBe(true);
    expect(estRechercheAxion(s)).toBe(true);
    expect(lireRechercheAxion(s)).toEqual({ motsCles: ["chat", "bureau"] });
  });

  it("casse, espaces et mots vides normalisés", () => {
    expect(lireRechercheAxion("  AXION:  Le   Chat  de la   MAISON ")).toEqual({ motsCles: ["chat", "maison"] });
  });

  it("rend null sans lever", () => {
    for (const v of ["pexels: chat", "", "axion:", "axion:   ", "axion: le de la", 42, null, undefined, {}, ["axion:x"]]) {
      expect(() => lireRechercheAxion(v as unknown)).not.toThrow();
      expect(lireRechercheAxion(v as unknown)).toBeNull();
    }
  });

  it("une recherche sans préfixe reste inchangée (éteint = identique)", () => {
    expect(estRechercheAxion("pexels: chat")).toBe(false);
    expect(estRechercheAxion("chat qui dort")).toBe(false);
    expect(estRechercheAxion(12 as unknown)).toBe(false);
  });

  it("le type d'extrait étend CandidatExtrait", () => {
    const e = {
      elementId: "e", plageId: "p", debutSec: 0, finSec: 4, ratio: "9:16", visage: "aucun", texteIncruste: false, famille: [],
      licenceOk: true, parentes: [],
    } as unknown as ExtraitMaisonV4;
    expect(e.licenceOk).toBe(true);
  });
});
