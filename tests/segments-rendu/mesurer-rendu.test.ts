import { describe, expect, it } from "vitest";
import { enMarkdown, tableauMesures, type MesureRendu } from "../../outils/segments/mesurer-rendu";

const MESURES: MesureRendu[] = [
  { nom: "scène 1", genre: "scene", images: 100, ms: 2000, octets: 1000 },
  { nom: "scène 2", genre: "scene", images: 50, ms: 1000, octets: 500 },
  { nom: "vidéo entière", genre: "entier", images: 150, ms: 2500, octets: 1400 },
  { nom: "passage final", genre: "final", images: 150, ms: 400, octets: 1300 },
];

describe("tableauMesures", () => {
  it("calcule lignes, totaux et rapport somme des scènes / rendu entier", () => {
    const t = tableauMesures(MESURES);
    expect(t.lignes).toHaveLength(4);
    expect(t.lignes[0]).toEqual({ nom: "scène 1", genre: "scene", images: 100, ms: 2000, octets: 1000, msParImage: 20 });
    expect(t.totaux).toEqual({ scenes: { images: 150, ms: 3000, octets: 1500 }, entier: { images: 150, ms: 2500, octets: 1400 } });
    expect(t.rapport).toBeCloseTo(1.2, 5);
  });

  it("liste vide : tableau vide sans exception", () => {
    const t = tableauMesures([]);
    expect(t.lignes).toEqual([]);
    expect(t.rapport).toBeNull();
    expect(() => enMarkdown(t)).not.toThrow();
  });

  it("zéro image : ms par image nul, pas de division par zéro", () => {
    const t = tableauMesures([{ nom: "x", genre: "scene", images: 0, ms: 10, octets: 1 }]);
    expect(t.lignes[0].msParImage).toBe(0);
    expect(t.rapport).toBeNull();
  });

  it("produit le Markdown attendu", () => {
    const md = enMarkdown(tableauMesures(MESURES));
    expect(md.split("\n")[0]).toBe("| Élément | Images | ms | Octets | ms par image |");
    expect(md).toContain("| scène 1 | 100 | 2000 | 1000 | 20.00 |");
    expect(md).toContain("| **Somme des scènes** | 150 | 3000 | 1500 | 20.00 |");
    expect(md).toContain("Somme des scènes / rendu entier : 1.20");
  });
});
