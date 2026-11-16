/**
 * C11-E3 — géométrie des cinq mises en page d'archive (pièces neuves, non branchées). Géométrie seule, pure.
 * Le temps `t` des mises en page est un avancement de 0 à 1 ; celui du mur est en secondes (il boucle).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BORNES_ARCHIVE,
  ECRANS_ARCHIVE_ACTIFS,
  catalogueFormats,
  friseMontage,
  grilleElue,
  murDefilant,
  periodeColonneMur,
  triptyque,
  type Rect,
} from "../../../src/briques/motion/ecrans-couverture/grilles";

const L = 1080;
const H = 1920;
const TEMPS = [0, 0.5, 1];
const dedans = (r: Rect) => r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.largeur <= L + 1e-6 && r.y + r.hauteur <= H + 1e-6;
const aire = (r: Rect) => r.largeur * r.hauteur;

describe("C11-E3 · grilles de couverture", () => {
  it("éteint par défaut", () => {
    expect(ECRANS_ARCHIVE_ACTIFS).toBe(false);
  });

  it("grille élue : tout tient dans le cadre, l'élue finit la plus grande, les autres à 30 %", () => {
    for (const n of [4, 9]) {
      for (const t of TEMPS) for (const r of grilleElue(L, H, n, t, 1)) expect(dedans(r)).toBe(true);
      const fin = grilleElue(L, H, n, 1, 1);
      expect(fin).toHaveLength(n);
      fin.forEach((r, i) => {
        if (i === 1) expect(fin.every((o, j) => j === 1 || aire(r) > aire(o))).toBe(true);
        else expect(r.opacite).toBeCloseTo(0.3, 5);
      });
      expect(grilleElue(L, H, n, 0, 1)[1].opacite).toBe(1);
    }
    expect(grilleElue(L, H, 3, 0.5)).toHaveLength(3);
    expect(grilleElue(L, H, 5, 0.5)).toHaveLength(5);
  });

  it("mur défilant : 3 colonnes, vitesses différentes, reboucle sans saut", () => {
    const m0 = murDefilant(L, H, 12, 0.7);
    expect(m0.colonnes).toHaveLength(3);
    const v = m0.colonnes.map((c) => c.vitesse);
    expect(v[1] / v[0]).toBeCloseTo(1.4, 5);
    expect(v[2] / v[0]).toBeCloseTo(0.8, 5);
    for (const t of TEMPS) for (const r of murDefilant(L, H, 12, t).cartes) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.largeur).toBeLessThanOrEqual(L + 1e-6); }
    for (let c = 0; c < 3; c++) {
      const p = periodeColonneMur(L, H, 12, c);
      const a = murDefilant(L, H, 12, 1.3).cartes.filter((r) => r.colonne === c).map((r) => +r.y.toFixed(3)).sort((x, y) => x - y);
      const b = murDefilant(L, H, 12, 1.3 + p).cartes.filter((r) => r.colonne === c).map((r) => +r.y.toFixed(3)).sort((x, y) => x - y);
      expect(b).toEqual(a);
    }
    // la colonne couvre tout le cadre : aucune case vide visible
    const cartes = murDefilant(L, H, 12, 2.2).cartes;
    expect(cartes.length).toBeGreaterThanOrEqual(3);
    // pas de saut d'une image à l'autre (1/25 s) : écart de position borné par la vitesse
    const d = murDefilant(L, H, 12, 1 / 25).cartes[0].y - murDefilant(L, H, 12, 0).cartes[0].y;
    expect(Math.abs(d)).toBeLessThan(H / 10);
  });

  it("catalogue : 4 cases aux bons rapports, libellés, tout dans le cadre", () => {
    for (const t of TEMPS) {
      const c = catalogueFormats(L, H, 4, t);
      expect(c.map((x) => x.libelle)).toEqual(["9:16", "4:5", "1:1", "16:9"]);
      const attendu = [9 / 16, 4 / 5, 1, 16 / 9];
      c.forEach((x, i) => {
        expect(dedans(x.rect)).toBe(true);
        expect(dedans(x.etiquette)).toBe(true);
        expect(Math.abs(x.rect.largeur / x.rect.hauteur / attendu[i] - 1)).toBeLessThan(0.01);
      });
    }
  });

  it("triptyque : angles −18 / 0 / +18, centre de face, dans le cadre", () => {
    for (const t of TEMPS) {
      const r = triptyque(L, H, 3, t);
      expect(r.cartes.map((c) => c.rotation)).toEqual([-18, 0, 18]);
      r.cartes.forEach((c) => expect(dedans(c)).toBe(true));
      expect(r.perspective).toBeGreaterThan(0);
    }
  });

  it("triptyque : convention concave (ouverture signée, pièce applique −rotation)", () => {
    const [g, c, d] = triptyque(L, H, 3, 1).cartes;
    expect(g.rotation).toBeLessThan(0);
    expect(c.rotation).toBe(0);
    expect(d.rotation).toBeGreaterThan(0);
    const src = readFileSync(join(__dirname, "..", "..", "..", "studio-rendu/compositions/commune/ecrans-couverture/Triptyque.tsx"), "utf8");
    expect(src).toContain("rotateY(${-r.rotation}deg)");
  });

  it("frise : tête à 0 au début, à la largeur utile à la fin, monotone", () => {
    expect(friseMontage(L, H, 5, 0).tete.avance).toBe(0);
    const fin = friseMontage(L, H, 5, 1);
    expect(fin.tete.avance).toBeCloseTo(fin.utile, 6);
    let prec = -1;
    for (let i = 0; i <= 20; i++) {
      const a = friseMontage(L, H, 5, i / 20).tete.avance;
      expect(a).toBeGreaterThanOrEqual(prec);
      prec = a;
    }
    for (const t of TEMPS) {
      const f = friseMontage(L, H, 8, t);
      f.vignettes.forEach((v) => expect(dedans(v)).toBe(true));
      expect(dedans(f.tete.rect)).toBe(true);
      expect(f.vignettes[0].y).toBeGreaterThan(H / 2);
    }
  });

  it("sources au-delà de la borne coupées, vide sans erreur", () => {
    expect(grilleElue(L, H, 50, 1)).toHaveLength(BORNES_ARCHIVE.grille);
    expect(new Set(murDefilant(L, H, 50, 0).cartes.map((r) => r.source)).size).toBeLessThanOrEqual(BORNES_ARCHIVE.mur);
    expect(triptyque(L, H, 50, 0).cartes).toHaveLength(3);
    expect(catalogueFormats(L, H, 50, 0)).toHaveLength(4);
    expect(friseMontage(L, H, 50, 0).vignettes).toHaveLength(BORNES_ARCHIVE.frise);
    for (const n of [0, -3]) {
      expect(() => { grilleElue(L, H, n, 0.5); murDefilant(L, H, n, 1); triptyque(L, H, n, 1); catalogueFormats(L, H, n, 1); friseMontage(L, H, n, 1); }).not.toThrow();
      expect(grilleElue(L, H, n, 0.5).every(dedans)).toBe(true);
    }
  });

  it("déterministe", () => {
    expect(JSON.stringify(murDefilant(L, H, 9, 3.3))).toBe(JSON.stringify(murDefilant(L, H, 9, 3.3)));
    expect(JSON.stringify(grilleElue(L, H, 9, 0.4, 2))).toBe(JSON.stringify(grilleElue(L, H, 9, 0.4, 2)));
    expect(JSON.stringify(friseMontage(L, H, 6, 0.4))).toBe(JSON.stringify(friseMontage(L, H, 6, 0.4)));
  });

  it("les sept fichiers existent : aucun « @/ », aucun bezier littéral, ni BandeVideo ni FenetrePleinCadre", () => {
    const fichiers = [
      "src/briques/motion/ecrans-couverture/grilles.ts",
      ...["GrilleElue", "MurDefilant", "CatalogueFormats", "Triptyque", "FriseMontage"].map((n) => `studio-rendu/compositions/commune/ecrans-couverture/${n}.tsx`),
    ];
    for (const f of fichiers) {
      const chemin = join(__dirname, "..", "..", "..", f);
      expect(existsSync(chemin)).toBe(true);
      const texte = readFileSync(chemin, "utf8");
      expect(texte).not.toMatch(/from\s+["']@\//);
      expect(texte).not.toMatch(/cubic-bezier\(|Easing\.bezier\(/);
      expect(texte).not.toMatch(/BandeVideo|FenetrePleinCadre/);
    }
  });
});
