import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DROITS, droitValide, trouverDroit } from "../../src/briques/droits";

const racine = new URL("../../", import.meta.url);
const dossierPolices = "studio-rendu/compositions/commune/polices/";

describe("police JetBrains Mono des objets (C9-05)", () => {
  it("l'entrée police-jetbrains-mono est valide, SIL OFL 1.1, de type police", () => {
    const d = trouverDroit("police-jetbrains-mono");
    expect(d?.type).toBe("police");
    expect(d?.licence).toBe("SIL OFL 1.1");
    expect(d?.auteur).toBe("The JetBrains Mono Project Authors");
    expect(d?.preuve).toContain(`${dossierPolices}OFL-JetBrainsMono.txt`);
    expect(d?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(droitValide("police-jetbrains-mono", d!.date)).toBe(true);
  });

  it("la police et la licence copiée sont présentes", () => {
    expect(existsSync(new URL(`${dossierPolices}JetBrainsMono-Variable.ttf`, racine))).toBe(true);
    const ofl = readFileSync(new URL(`${dossierPolices}OFL-JetBrainsMono.txt`, racine), "utf8");
    expect(ofl).toContain("SIL OPEN FONT LICENSE");
  });

  it("le chargeur ne charge rien au niveau du module", () => {
    const src = readFileSync(new URL("studio-rendu/compositions/petits-objets/polices.ts", racine), "utf8");
    expect(src).toMatch(/export function chargerJetBrainsMono\(\): void/);
    expect(src).toContain("delayRender");
    expect(src).not.toMatch(/^(?!\s)(?!export function|let |import |const |\/\/|\/\*|\s*\*|\}).*\bload\(/m);
    expect(src).not.toMatch(/^chargerJetBrainsMono\(/m);
  });

  it("aucune police manuscrite n'a d'entrée (W-I non tranchée)", () => {
    expect(DROITS.filter((d) => /police-(kalam|caveat|permanent-marker)/.test(d.id))).toEqual([]);
  });
});
