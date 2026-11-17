import { describe, expect, it } from "vitest";
import { usagesDe, type Moment } from "@/briques/note-extraits";

const base = (p: Partial<Moment> = {}): Moment => ({
  id: "m", origine: "parole", debutSec: 0, finSec: 4, montre: "interface", avecVisage: false, texteIncruste: false, ratio: "9:16", ...p,
});
const NON = { chiffresReels: false };

describe("usagesDe (§ b.5)", () => {
  it("téléphone : 9:16 ou 4:5, 3 à 6 s, sans texte incrusté", () => {
    expect(usagesDe(base(), NON)).toContain("telephone");
    expect(usagesDe(base({ ratio: "4:5" }), NON)).toContain("telephone");
  });
  it("téléphone refusé en 16:9, en 1:1 et sans ratio", () => {
    expect(usagesDe(base({ ratio: "16:9" }), NON)).not.toContain("telephone");
    expect(usagesDe(base({ ratio: "1:1" }), NON)).not.toContain("telephone");
    expect(usagesDe(base({ ratio: undefined }), NON)).not.toContain("telephone");
  });
  it("téléphone refusé sous 3 s et au-delà de 6 s", () => {
    expect(usagesDe(base({ finSec: 2.9 }), NON)).not.toContain("telephone");
    expect(usagesDe(base({ finSec: 6.1 }), NON)).not.toContain("telephone");
    expect(usagesDe(base({ finSec: 3 }), NON)).toContain("telephone");
    expect(usagesDe(base({ finSec: 6 }), NON)).toContain("telephone");
  });
  it("téléphone refusé avec texte incrusté par défaut, permis si accepté", () => {
    const m = base({ texteIncruste: true });
    expect(usagesDe(m, NON)).not.toContain("telephone");
    expect(usagesDe(m, { ...NON, texteIncrusteAccepte: false })).not.toContain("telephone");
    expect(usagesDe(m, { ...NON, texteIncrusteAccepte: true })).toContain("telephone");
  });
  it("téléphone permis avec visage", () => {
    expect(usagesDe(base({ avecVisage: true }), NON)).toContain("telephone");
  });
  it("écran : montre écran sans visage ; refusé avec visage", () => {
    for (const montre of ["interface", "chiffre", "demarche", "geste"] as const) {
      expect(usagesDe(base({ montre }), NON)).toContain("ecran");
    }
    expect(usagesDe(base({ montre: "texte" }), NON)).not.toContain("ecran");
    expect(usagesDe(base({ avecVisage: true }), NON)).not.toContain("ecran");
  });
  it("fond : 5 s au moins, sans texte incrusté, pas sur un chiffre", () => {
    expect(usagesDe(base({ finSec: 5 }), NON)).toContain("fond");
    expect(usagesDe(base({ finSec: 4.9 }), NON)).not.toContain("fond");
    expect(usagesDe(base({ finSec: 8, texteIncruste: true }), NON)).not.toContain("fond");
    expect(usagesDe(base({ finSec: 8, montre: "chiffre" }), NON)).not.toContain("fond");
  });
  it("preuve chiffrée : jamais sans chiffresReels (20 moments « chiffre »)", () => {
    for (let i = 0; i < 20; i++) {
      const m = base({ id: `c${i}`, montre: "chiffre", finSec: 3 + i, origine: i % 2 ? "capture-cas" : "ecran-demo" });
      expect(usagesDe(m, NON)).not.toContain("preuve-chiffree");
      expect(usagesDe(m, {} as never)).not.toContain("preuve-chiffree");
    }
  });
  it("chiffresReels « true » (chaîne) ou truthy : jamais preuve", () => {
    const m = base({ montre: "chiffre" });
    for (const v of ["true", 1, {}, "oui"]) {
      expect(usagesDe(m, { chiffresReels: v as never })).not.toContain("preuve-chiffree");
    }
  });
  it("chiffresReels === true : preuve sur un chiffre, sauf capture de cas concret ; jamais sur un autre moment", () => {
    expect(usagesDe(base({ montre: "chiffre" }), { chiffresReels: true })).toContain("preuve-chiffree");
    expect(usagesDe(base({ montre: "chiffre", origine: "capture-cas" }), { chiffresReels: true })).not.toContain("preuve-chiffree");
    expect(usagesDe(base({ montre: "interface" }), { chiffresReels: true })).not.toContain("preuve-chiffree");
  });
  it("résultat trié, sans doublon, déterministe", () => {
    const m = base({ montre: "chiffre", finSec: 5 });
    const a = usagesDe(m, { chiffresReels: true });
    expect(a).toEqual([...new Set(a)].sort());
    expect(usagesDe(m, { chiffresReels: true })).toEqual(a);
  });
});
