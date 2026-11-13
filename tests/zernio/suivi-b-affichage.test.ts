/** SUI-B : aides pures de l'affichage du suivi. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AU_MOINS_PARTOUT, chiffreOuTiret, compteAffiche, libelleGagnees } from "@/components/mots/suivi-affichage";

describe("suivi-affichage", () => {
  it("libelleGagnees : « au moins 3 »", () => expect(libelleGagnees(3)).toBe("au moins 3"));
  it("libelleGagnees : 0 → aucune vue pour l'instant", () => {
    expect(libelleGagnees(0)).toBe("aucune vue pour l'instant");
    expect(libelleGagnees(-1)).toBe("aucune vue pour l'instant");
  });
  it("chiffreOuTiret : null → « — », 0 reste 0", () => {
    expect(chiffreOuTiret(null)).toBe("—");
    expect(chiffreOuTiret(0)).toBe("0");
    expect(chiffreOuTiret(12)).toBe("12");
  });
  it("AU_MOINS_PARTOUT vaut false", () => expect(AU_MOINS_PARTOUT).toBe(false));
  it("compteAffiche : exact par défaut, « au moins N » si le réglage global est actif", () => {
    expect(compteAffiche(4)).toBe("4");
    expect(compteAffiche(4, true)).toBe("au moins 4");
  });
  it("le fichier source n'emploie pas le mot interdit", () => {
    const motif = new RegExp(["ab", "onn"].join(""), "i");
    expect(readFileSync("src/components/mots/suivi-affichage.ts", "utf8")).not.toMatch(motif);
  });
});
