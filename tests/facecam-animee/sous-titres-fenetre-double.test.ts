/** Sous FenetreDouble (37,2-40,7 s), les sous-titres restent à gauche de la carte DEVIS (B) au lieu de la traverser (vidéo v-e5d262bd9da5). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";

const DOSSIER = join(process.cwd(), "studio-rendu/compositions/interface-claire");
const charger = async () => {
  const reg = await import("../../studio-rendu/compositions/interface-claire/motion-v4/registre-v4");
  const zone = await import("../../studio-rendu/compositions/interface-claire/motion-v4/communs/zone-sure-v4");
  const fen = await import("../../studio-rendu/compositions/interface-claire/motion-v4/lot4/FenetreDouble");
  return { reg, zone, fen };
};
const DOUBLE: ElementV4Plan = { id: "FenetreDouble", debut: 37.2, fin: 40.7 };
const ETIQ: ElementV4Plan = { id: "EtiquetteTete", debut: 37.2, fin: 40.7, mots: ["DEVIS"] };

describe("sous-titres · bande sous FenetreDouble", () => {
  it("la bande vaut [0,06 ; 0,44] sur toute la durée de FenetreDouble, null sinon", async () => {
    const { reg, zone } = await charger();
    const f = Math.round(38.9 * 30);
    expect(reg.bandeSousTitresV4([DOUBLE], f)).toEqual([zone.X_ST_MIN, 0.44]);
    expect(zone.X_ST_MIN).toBeCloseTo(0.06, 6);
    expect(reg.bandeSousTitresV4([DOUBLE], Math.round(37.3 * 30))).toEqual([zone.X_ST_MIN, 0.44]);
    expect(reg.bandeSousTitresV4([DOUBLE], Math.round(41.5 * 30))).toBeNull();
    expect(reg.bandeSousTitresV4([ETIQ], f)).toBeNull();
  });
  it("le rectangle des sous-titres ne touche pas la carte B de FenetreDouble", async () => {
    const { reg, zone, fen } = await charger();
    const f = Math.round(38.9 * 30);
    const bande = reg.bandeSousTitresV4([DOUBLE], f)!;
    const y = reg.positionSousTitresV4([DOUBLE], [], f)!;
    const st = { x0: bande[0], x1: bande[1], y0: y - zone.DEMI_HAUTEUR_ST, y1: y + zone.DEMI_HAUTEUR_ST };
    const B = fen.RECT_B_FENETRE_DOUBLE;
    const touche = st.x0 < B.x1 && st.x1 > B.x0 && st.y0 < B.y1 && st.y1 > B.y0;
    expect(touche).toBe(false);
  });
  it("le rendu branche la bande sur les sous-titres", () => {
    expect(readFileSync(join(DOSSIER, "VideoAnimeeV4.tsx"), "utf8")).toContain("bande=");
  });
  it("un groupe long sous FenetreDouble reste dans la bande [0,06 ; 0,44] L (x et largeur de chaque mot)", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { SousTitresV4 } = await import("../../studio-rendu/compositions/interface-claire/motion-v4/communs/briques-v4");
    const { reg, zone } = await charger();
    const groupe = { mots: [{ mot: "ADMINISTRATIF", debut: 38.9, fin: 39.3, fort: true }, { mot: "AUTOMATISATION", debut: 39, fin: 39.4 }], debut: 38.9, fin: 39.6 };
    const html = renderToStaticMarkup(
      React.createElement(SousTitresV4, { frame: Math.round(39.2 * 30), groupes: [groupe], palette: "claire" as never, position: () => 0.66, bande: (f: number) => reg.bandeSousTitresV4([DOUBLE], f) }),
    );
    const blocs = [...html.matchAll(/left:([\d.]+)px;top:[^;]+;width:([\d.]+)px/g)].map((m) => ({ x: Number(m[1]), l: Number(m[2]) }));
    expect(blocs.length).toBeGreaterThan(0);
    for (const b of blocs) {
      expect(b.x).toBeGreaterThanOrEqual(zone.X_ST_MIN * 1080 - 0.5);
      expect(b.x + b.l).toBeLessThanOrEqual(0.44 * 1080 + 0.5);
    }
  });
});
