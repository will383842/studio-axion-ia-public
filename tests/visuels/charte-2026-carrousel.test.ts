import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as carrousel from "@/briques/visuels/charte-carrousel";
import { PALETTE, choisirFond, type Fond } from "@/briques/charte/axion-2026";
import { PASTILLE_AXION, PASTILLE_AXION_ARDOISE } from "@/briques/sous-titres/pastille";

const autorises = new Set(Object.values(PALETTE).map((h) => h.toUpperCase()));
const hexDe = (src: string) => (src.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toUpperCase());

describe("V7-02 : carrousels sur la charte Axion 2026", () => {
  it("charte-carrousel.ts n'écrit aucun hex hors palette et n'expose aucun dégradé", () => {
    const src = readFileSync("src/briques/visuels/charte-carrousel.ts", "utf8");
    expect(hexDe(src).filter((h) => !autorises.has(h))).toEqual([]);
    expect(src).not.toMatch(/gradient|degrade/i);
    expect(Object.keys(carrousel)).not.toContain("DEGRADES_CONTINU");
  });

  it("les couleurs du carrousel viennent de PALETTE (orange sur noir seulement)", () => {
    const c = carrousel.CHARTE_CARROUSEL.couleurs;
    expect(c.creme).toBe(PALETTE.ivoire);
    expect(c.blanc).toBe(PALETTE.ivoire);
    expect(c.pale).toBe(PALETTE.gris);
    expect(c.encre).toBe(PALETTE.noir);
    expect(c.orangeFonce).toBe(PALETTE.terracotta);
    expect(c.orange).toBe(PALETTE.orange);
    expect(carrousel.texteLisible(c.orangeFonce, c.creme, 30)).toBe(true);
    expect(carrousel.texteLisible(c.orange, c.encre, 30)).toBe(true);
  });

  it("pastille : couleurs de la palette, Manrope", () => {
    const src = readFileSync("src/briques/sous-titres/pastille.ts", "utf8");
    expect(hexDe(src).filter((h) => !autorises.has(h))).toEqual([]);
    expect(src).not.toMatch(/Inter|Poppins/);
    for (const p of [PASTILLE_AXION, PASTILLE_AXION_ARDOISE]) {
      for (const h of [p.fond, p.texte, p.motDit, ...(p.bord ? [p.bord.couleur] : [])]) expect(autorises.has(h.toUpperCase())).toBe(true);
      expect(carrousel.texteLisible(p.texte, p.fond, 62)).toBe(true);
      expect(carrousel.texteLisible(p.motDit, p.fond, 62)).toBe(true);
    }
  });

  it("choisirFond : jamais deux sombres de suite sur un carrousel entier", () => {
    const voulus: Fond[] = ["sombre", "sombre", "clair", "sombre", "sombre", "sombre", "clair"];
    let prec: Fond | null = null;
    const res = voulus.map((v, i) => (prec = choisirFond(i, prec, v)));
    expect(res.some((f, i) => f === "sombre" && res[i - 1] === "sombre")).toBe(false);
    expect(res[0]).toBe("sombre");
  });
});
