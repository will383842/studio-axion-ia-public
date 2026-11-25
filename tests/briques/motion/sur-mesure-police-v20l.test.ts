/** POLICES-P5-a-v20l : la carte sur mesure embarque Manrope dans son cadre isolé (avant : Poppins seul, texte en Arial). Aucun navigateur, 0 €. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POLITIQUE_IFRAME } from "../../../src/briques/motion/sur-mesure";
import { GSAP_JS, POLICES_CSS, TROIS_D_JS } from "../../../studio-rendu/compositions/commune/motion/sur-mesure/bibliotheques.genere";

const regles = POLICES_CSS.split("\n");
const deManrope = (famille: string) => regles.filter((r) => r.startsWith(`@font-face{font-family:"${famille}";`));

describe("POLICES-P5-a · Manrope dans le cadre isolé", () => {
  for (const famille of ["Axion Manrope", "Manrope"]) {
    it(`(a) une règle @font-face « ${famille} », graisse 200 800, en data:`, () => {
      const r = deManrope(famille);
      expect(r).toHaveLength(1);
      expect(r[0]).toContain("font-weight:200 800");
      expect(r[0]).toContain("font-style:normal");
      expect(r[0]).toMatch(/src:url\(data:font\/ttf;base64,[A-Za-z0-9+/=]{1000,}\) format\("truetype"\)/);
      expect(r[0]).not.toMatch(/url\((?!data:)/);
    });
  }

  it("(b) les deux règles Manrope portent exactement la police du dépôt", () => {
    const b64 = readFileSync(join(__dirname, "..", "..", "..", "studio-rendu/compositions/commune/polices/Manrope-Variable.ttf")).toString("base64");
    for (const famille of ["Axion Manrope", "Manrope"]) expect(deManrope(famille)[0]).toContain(`base64,${b64})`);
  });

  it("(c) Poppins est inchangé : 5 graisses x 2 plages x 2 familles", () => {
    expect(regles.filter((r) => r.includes('"Axion Poppins"') || r.includes('font-family:"Poppins"'))).toHaveLength(20);
  });

  it("(d) bibliothèques inchangées et politique font-src data: toujours là", () => {
    expect(GSAP_JS.length).toBeGreaterThan(1000);
    expect(TROIS_D_JS.length).toBeGreaterThan(1000);
    expect(POLITIQUE_IFRAME).toContain("font-src data:");
  });
});
