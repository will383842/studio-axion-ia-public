/**
 * Tirage du style du tableau : graine sha256 de la vidéo, rotation sans reprise des 2 derniers styles, style imposé
 * prioritaire, vidéo existante inchangée (style déjà posé gardé, découpage sans tirage = style de la série).
 */
import { describe, expect, it } from "vitest";
import { STYLES_TABLEAU, type StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { avecStyleDeLaSerie } from "@/moteurs/montage-tableau/decoupage";
import { ajouterAHistoriqueStyles, lireHistoriqueStyles, styleDuDecoupage, tirerStyleTableau, type EntreeHistoriqueStyle } from "@/moteurs/montage-tableau/tirage-style";

const ids = Array.from({ length: 300 }, (_, i) => `v-${(i * 7919 + 13).toString(16).padStart(12, "0")}`);
const serie = { code: "formation", nom: "Formation" };

describe("tirerStyleTableau", () => {
  it("répartition proche d'un tiers sur 300 identifiants", () => {
    const n: Record<string, number> = {};
    for (const id of ids) n[tirerStyleTableau(id)] = (n[tirerStyleTableau(id)] ?? 0) + 1;
    for (const s of STYLES_TABLEAU) {
      expect(n[s] ?? 0, s).toBeGreaterThanOrEqual(75);
      expect(n[s] ?? 0, s).toBeLessThanOrEqual(125);
    }
  });

  it("déterministe : même identifiant, même historique → même style", () => {
    const h: EntreeHistoriqueStyle[] = [{ videoId: "a", style: "ardoise" }];
    for (const id of ids.slice(0, 50)) {
      expect(tirerStyleTableau(id)).toBe(tirerStyleTableau(id));
      expect(tirerStyleTableau(id, h)).toBe(tirerStyleTableau(id, h));
    }
  });

  it("rotation : jamais le style des 2 dernières vidéos, sur une chaîne de 300", () => {
    let h: EntreeHistoriqueStyle[] = [];
    const suite: StyleTableau[] = [];
    for (const id of ids) {
      const style = tirerStyleTableau(id, h);
      suite.push(style);
      h = ajouterAHistoriqueStyles(h, { videoId: id, style });
    }
    for (let i = 2; i < suite.length; i++) expect([suite[i - 1], suite[i - 2]], `rang ${i}`).not.toContain(suite[i]);
    expect(new Set(suite).size).toBe(3);
  });

  it("les 2 derniers styles différents laissent un seul choix ; la ligne de la vidéo elle-même est ignorée", () => {
    const h: EntreeHistoriqueStyle[] = [{ videoId: "a", style: "ardoise" }, { videoId: "b", style: "paperboard" }];
    for (const id of ids.slice(0, 20)) expect(tirerStyleTableau(id, h)).toBe("tableau-blanc");
    expect(tirerStyleTableau("c", [...h, { videoId: "c", style: "tableau-blanc" }])).toBe("tableau-blanc");
  });

  it("historique illisible : ignoré", () => {
    expect(lireHistoriqueStyles([{ videoId: "a", style: "inconnu" }, null, "x", { videoId: "b", style: "ardoise" }])).toEqual([{ videoId: "b", style: "ardoise" }]);
    expect(lireHistoriqueStyles("n'importe quoi")).toEqual([]);
  });
});

describe("style au découpage", () => {
  it("style imposé respecté, avec ou sans tirage", () => {
    for (const id of ids.slice(0, 30)) {
      expect(styleDuDecoupage({ videoId: id, serie, styleImpose: "paperboard", tirage: {} })).toBe("paperboard");
      expect(styleDuDecoupage({ videoId: id, serie, styleImpose: "paperboard" })).toBe("paperboard");
    }
  });

  it("sans tirage demandé : le style de la série, comme avant", () => {
    expect(styleDuDecoupage({ videoId: "x", serie })).toBe("ardoise");
    expect(styleDuDecoupage({ videoId: "x", serie: { code: "audit" } })).toBe("paperboard");
  });

  it("vidéo existante : un style déjà posé dans la fiche n'est jamais retiré au re-découpage", () => {
    const fiche = { styleTableau: "ardoise" };
    for (const id of ids.slice(0, 30)) expect(avecStyleDeLaSerie(fiche, { habillage: "reference/3", serie, videoId: id, tirage: {} })).toBe(fiche);
  });

  it("avecStyleDeLaSerie pose le style tiré (et rien hors reference/3)", () => {
    const e = { habillage: "reference/3", serie, videoId: ids[0]!, tirage: {} };
    expect(avecStyleDeLaSerie({}, e)).toEqual({ styleTableau: tirerStyleTableau(ids[0]!) });
    expect(avecStyleDeLaSerie({}, { ...e, habillage: "reference/2" })).toEqual({});
  });
});
