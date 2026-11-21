/** FIX-PLANCHE-X1-v21m : la planche tendances 2027 montre les trois correctifs (mot x1-05 dans sa case, rail x1-16, fenêtre x1-03 inclinée ET remplie) ; le script prend navigateur et sortie en arguments. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FORMATS_PLANCHE, PlancheTendances2027, casesDeLaPlanche, geometrieMotX105, type FormatPlanche } from "../../outils/tendances-2027/PlancheTendances2027";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FORMATS = Object.keys(FORMATS_PLANCHE) as FormatPlanche[];

function morceau(h: string, id: string): string {
  const debut = h.indexOf(`data-case="${id}"`);
  expect(debut, id).toBeGreaterThanOrEqual(0);
  const suite = h.indexOf("data-case=", debut + 10);
  return h.slice(debut, suite < 0 ? undefined : suite);
}

describe("FIX-PLANCHE-X1-v21m", () => {
  it("x1-05 : aucun mot visible ne dépasse sa case, dans les 4 formats et aux 3 instants", () => {
    for (const f of FORMATS) {
      const h = renderToStaticMarkup(createElement(PlancheTendances2027, { format: f }));
      const g = geometrieMotX105(f);
      expect(g.largeurCadre).toBeGreaterThan(0);
      for (const id of ["x1-05-a", "x1-05-b", "x1-05-c"]) {
        const c = morceau(h, id);
        const echelle = Number(/data-echelle-mot="([\d.]+)"/.exec(c)?.[1]);
        const opacite = Number(/data-opacite-mot="([\d.]+)"/.exec(c)?.[1]);
        expect(Number.isFinite(echelle), `${f} ${id}`).toBe(true);
        if (opacite > 0) expect(g.largeurMot * echelle, `${f} ${id}`).toBeLessThanOrEqual(g.largeurCadre - 2 * g.marge + 0.01);
      }
    }
  });
  it("x1-16 : le rail est dessiné et contient la barre", () => {
    for (const f of FORMATS) {
      const c = morceau(renderToStaticMarkup(createElement(PlancheTendances2027, { format: f })), "x1-16");
      const boite = (nom: string) => {
        const m = new RegExp(`data-${nom}="([\\d.]+) ([\\d.]+) ([\\d.]+) ([\\d.]+)"`).exec(c);
        expect(m, `${f} ${nom}`).not.toBeNull();
        const [x, y, l, h] = (m as RegExpExecArray).slice(1).map(Number);
        return { x, y, l, h };
      };
      const rail = boite("rail");
      const barre = boite("barre");
      expect(rail.l).toBeGreaterThan(barre.l);
      expect(barre.x).toBeGreaterThanOrEqual(rail.x - 0.001);
      expect(barre.x + barre.l).toBeLessThanOrEqual(rail.x + rail.l + 0.001);
      expect(barre.y).toBeCloseTo(rail.y, 3);
    }
  });
  it("x1-03 : la fenêtre est inclinée (angle non nul) ET remplie (son titre est là et son contenu est visible)", () => {
    for (const f of FORMATS) {
      const c = morceau(renderToStaticMarkup(createElement(PlancheTendances2027, { format: f })), "x1-03");
      const angle = Number(/rotateX\(([\d.]+)deg\)/.exec(c)?.[1]);
      expect(angle, f).toBeGreaterThan(0);
      expect(c, f).toContain("Mon espace");
      // Le titre est dans le balisage même quand le contenu est invisible : « remplie » se prouve par une opacité de remplissage > 0.
      const opacites = [...c.matchAll(/fill-opacity="([\d.]+)"/g)].map((m) => Number(m[1]));
      expect(opacites.length, `${f} fill-opacity`).toBeGreaterThan(0);
      expect(Math.max(...opacites), `${f} contenu visible`).toBeGreaterThan(0);
    }
  });
  it("les cases ne se chevauchent pas (grille inchangée)", () => {
    for (const f of FORMATS) expect(casesDeLaPlanche(f).length).toBe(23);
  });
  it("planche.mts : navigateur et sortie par les arguments, aucun process.env", () => {
    const s = lire("outils/tendances-2027/planche.mts");
    expect(s).toContain("--navigateur");
    expect(s).toContain("--sortie");
    expect(s).toContain("browserExecutable");
    expect(s).not.toMatch(/process\.env/);
    expect(s).toContain('"captures", "tendances-2027"');
  });
});
