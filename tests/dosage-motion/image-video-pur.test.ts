import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { intensiteDosageIV } from "@/moteurs/montage-image-video/dosage";
import { CRANS_PERMIS, NIVEAU_DU_DOSAGE } from "@/briques/dosage-motion/crans";

describe("image→vidéo : cran du dosage → intensité des sous-titres (pur)", () => {
  it("table des crans et de l'absence de cran", () => {
    expect(intensiteDosageIV("sobre")).toBe("sobre");
    expect(intensiteDosageIV("dynamique")).toBe("tres-dynamique");
    expect(intensiteDosageIV("equilibre")).toBeUndefined();
    expect(intensiteDosageIV(undefined)).toBeUndefined();
    expect(intensiteDosageIV("aucun")).toBeUndefined();
  });
  it("« aucun » n'est pas permis pour image-video", () => {
    expect(CRANS_PERMIS["image-video"]).not.toContain("aucun");
  });
  it("cohérent avec NIVEAU_DU_DOSAGE pour les crans permis allumés", () => {
    expect(intensiteDosageIV("sobre")).toBe(NIVEAU_DU_DOSAGE.sobre);
    expect(intensiteDosageIV("dynamique")).toBe(NIVEAU_DU_DOSAGE.dynamique);
  });
  it("même entrée = même sortie", () => {
    for (const c of ["aucun", "sobre", "equilibre", "dynamique", undefined] as const)
      expect(intensiteDosageIV(c)).toBe(intensiteDosageIV(c));
  });
  it("le fichier n'importe rien de src/services/", () => {
    const src = readFileSync(join(process.cwd(), "src/moteurs/montage-image-video/dosage.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*services\//);
  });
});
