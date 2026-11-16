import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleReglageBibliotheque,
  interpreterReglageBibliotheque,
  lireReglageBibliotheque,
} from "@/briques/bibliotheque-video/reglage";

const RACINE = join(__dirname, "..", "..");
const ETEINT = { actif: false };

describe("réglage bibliothequeVideo.<format>", () => {
  it("construit la clé", () => {
    expect(cleReglageBibliotheque("cas-concret")).toBe("bibliothequeVideo.cas-concret");
  });

  it.each([
    undefined, null, false, 0, 1, "", "true", "oui", {}, [], [true],
    { capacites: "texte.surlignage-marqueur" },
    { capacites: [], autre: 1 },
    { actif: true },
  ])("éteint par défaut : %j", (v) => {
    expect(interpreterReglageBibliotheque(v)).toEqual(ETEINT);
  });

  it("true allume sans capacité", () => {
    expect(interpreterReglageBibliotheque(true)).toEqual({ actif: true, capacites: [] });
  });

  it("filtre, déduplique, garde l'ordre", () => {
    expect(
      interpreterReglageBibliotheque({
        capacites: ["texte.surlignage-marqueur", "texte.surlignage-marqueur", "surlignage", 3, null, "texte.style-varie"],
      }),
    ).toEqual({ actif: true, capacites: ["texte.surlignage-marqueur", "texte.style-varie"] });
  });

  it("capacites vide allume", () => {
    expect(interpreterReglageBibliotheque({ capacites: [] })).toEqual({ actif: true, capacites: [] });
  });

  it("lecture : clé demandée et échecs", async () => {
    let cle = "";
    const r = await lireReglageBibliotheque("cas-concret", async (c) => { cle = c; return true; });
    expect(cle).toBe("bibliothequeVideo.cas-concret");
    expect(r).toEqual({ actif: true, capacites: [] });
    expect(await lireReglageBibliotheque("x", () => Promise.reject(new Error("no")))).toEqual(ETEINT);
    expect(await lireReglageBibliotheque("x", () => { throw new Error("no"); })).toEqual(ETEINT);
  });

  it("garde statique : aucun import interdit", () => {
    const src = readFileSync(join(RACINE, "src/briques/bibliotheque-video/reglage.ts"), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b|\brequire\(/.test(l)).join("\n");
    expect(imports).not.toMatch(/@\/services\//);
    expect(imports).not.toMatch(/studio-rendu/);
    expect(imports).not.toMatch(/credits|budget-mensuel|mode-budget|autonomie-usine|couts|cle-depense-usine|depense-claude|generation-claude|image-video/);
  });

  it("absent de reglages.ts", () => {
    expect(readFileSync(join(RACINE, "src/services/reglages.ts"), "utf8")).not.toContain("bibliothequeVideo");
  });
});
