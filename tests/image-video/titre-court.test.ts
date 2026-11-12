import { describe, expect, it } from "vitest";
import { titreCourt } from "@/services/image-video-ecran";

describe("titreCourt (écran Image → vidéo)", () => {
  it("garde un titre court tel quel et replie les espaces", () => {
    expect(titreCourt("  Ma   photo  ")).toBe("Ma photo");
  });
  it("coupe un long titre sur un mot, 40 caractères au plus, fini par « … »", () => {
    const r = titreCourt("Une très longue description de la photo du chantier terminé hier soir");
    expect(r.length).toBeLessThanOrEqual(40);
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toMatch(/\s…$/);
    expect(r).toBe("Une très longue description de la photo…");
  });
  it("titre vide : libellé par défaut", () => {
    expect(titreCourt("   ")).toBe("Image → vidéo");
  });
  it("compte en caractères, pas en moitiés d'emoji : jamais de paire coupée", () => {
    const r = titreCourt("😀".repeat(50));
    expect(Array.from(r)).toHaveLength(40);
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toMatch(/[\ud800-\udbff]$|^[\udc00-\udfff]/);
  });
});
