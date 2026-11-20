import { describe, expect, it } from "vitest";
import { listerFormats } from "@/formats";
import { famille } from "@/domaine/vignettes";

/** Table d'AVANT G1-05b (ancien SANS_VISAGE de vignettes.ts), copiée telle quelle. */
const SANS_VISAGE_AVANT = ["tableau-anime", "cas-concret", "image-video", "motion"];
const FORMATS = listerFormats({ inclureMasques: true, inclureReservesAWill: true });

describe("famille() lit la déclaration (G1-05b)", () => {
  it("même sortie qu'avant pour tous les formats sauf tutoriel-outil, video-longue et tableau-de-bord", () => {
    for (const f of FORMATS.filter((x) => x.id !== "tutoriel-outil" && x.id !== "video-longue" && x.id !== "tableau-de-bord")) {
      expect(famille(f.id)).toEqual({ visage: !SANS_VISAGE_AVANT.includes(f.id) });
    }
  });

  it("tutoriel-outil passe sans visage", () => {
    expect(famille("tutoriel-outil").visage).toBe(false);
  });

  it("video-longue est sans visage", () => {
    expect(famille("video-longue").visage).toBe(false);
  });

  it("tableau-de-bord est sans visage", () => {
    expect(famille("tableau-de-bord").visage).toBe(false);
  });

  it("format inconnu = visage, comme avant", () => {
    expect(famille("inconnu").visage).toBe(true);
  });
});
