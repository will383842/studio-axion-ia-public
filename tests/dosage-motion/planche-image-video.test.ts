/**
 * X3-13c : la planche du dosage et la pièce pure de l'image→vidéo (X3-08a) disent la même chose.
 * Test seul : lecture et import, aucun code de production touché.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NIVEAU_DU_DOSAGE } from "@/briques/dosage-motion/crans";
import { intensiteDosageIV } from "@/moteurs/montage-image-video/dosage";
import { tableauDosage } from "../../scripts/dosage-motion/planche";

const lignesIV = tableauDosage().filter((l) => l.generateur === "image-video");

describe("planche du dosage × image→vidéo", () => {
  it("3 lignes image→vidéo exactement, jamais « aucun »", () => {
    expect(lignesIV).toHaveLength(3);
    expect(lignesIV.map((l) => l.cran).sort()).toEqual(["dynamique", "equilibre", "sobre"]);
    expect(lignesIV.some((l) => l.cran === "aucun")).toBe(false);
  });

  it("le moteur et la planche ne se contredisent pas (undefined seulement pour équilibré)", () => {
    for (const l of lignesIV) {
      const v = intensiteDosageIV(l.cran);
      expect([undefined, NIVEAU_DU_DOSAGE[l.cran]]).toContain(v);
      if (v === undefined) expect(l.cran).toBe("equilibre");
      else expect(l.cran).not.toBe("equilibre");
    }
  });

  it("la commande porte le cran de la ligne, sous-titres présents", () => {
    for (const l of lignesIV) {
      expect(l.commande.dosageMotion?.cran).toBe(l.cran);
      expect(l.sousTitresPresents).toBe(true);
    }
  });

  it("garde statique : aucun import de src/services ni de montage-image-video/{fabrication,index}", () => {
    const src = readFileSync(join(__dirname, "planche-image-video.test.ts"), "utf8");
    const imports = src.split("\n").filter((ligne) => /^\s*import\b/.test(ligne));
    expect(imports.some((ligne) => /services\//.test(ligne))).toBe(false);
    expect(imports.some((ligne) => /montage-image-video\/(fabrication|index)/.test(ligne))).toBe(false);
  });
});
