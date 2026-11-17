import { describe, expect, it } from "vitest";
import { planPage3, type Action3, type Plan3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import { dessinsInacheves } from "../../../src/moteurs/montage-tableau/dessins-finis";
import { proprietesVfc3 } from "../titre-seul/fiche-vfc3";

const trait = (id: string, partie: string, debut: number, duree: number, fondu = false): Action3 => ({
  id, partie, trace: "contour", points: [], cible: { x: 0, y: 0, largeur: 1, hauteur: 1 }, debut, duree, angle: 0, couleur: "#000", epaisseur: 1, ...(fondu ? { fondu: true } : {}),
});
const plan = (actions: Action3[]) => ({ actions } as unknown as Plan3);

describe("dessinsInacheves", () => {
  it("(a) un bloc pressé : les contours sautés restent posés en fondu → liste vide", () => {
    const p = plan([trait("d1", "croquis:avant:0", 1, 0.2, true), trait("d1", "croquis:avant:1", 1, 0.2, true), trait("d2", "visuel:x:0", 0.5, 1)]);
    expect(dessinsInacheves(p, 5)).toEqual([]);
  });

  it("(b) un contour qui commence après la fin (ou n'est pas fini) → le dessin est listé", () => {
    const p = plan([trait("d1", "croquis:avant:0", 1, 0.5), trait("d2", "croquis:avant:0", 6, 0.5), trait("d3", "visuel:y:0", 4.9, 0.5)]);
    expect(dessinsInacheves(p, 5)).toEqual([{ id: "d2", partie: "croquis:avant:0" }, { id: "d3", partie: "visuel:y:0" }]);
  });

  it("(c) témoin de référence 3 (calendrier) : chaque page finit avec tous ses dessins", () => {
    const props = proprietesVfc3("paperboard", "vertical");
    expect(props.length).toBeGreaterThan(0);
    let contours = 0;
    for (const p of props) {
      const pl = planPage3(p.page, p.styleReference!, { largeur: p.largeur, hauteur: p.hauteur });
      contours += pl.actions.filter((a) => a.trace === "contour").length;
      expect(dessinsInacheves(pl, pl.finPage), `page ${p.page.page}`).toEqual([]);
      if (pl.actions.some((a) => a.trace === "contour")) expect(dessinsInacheves(pl, pl.debutPage - 1).length, `garde : page ${p.page.page}`).toBeGreaterThan(0);
    }
    expect(contours).toBeGreaterThan(0);
  });
});
