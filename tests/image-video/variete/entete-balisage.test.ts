/**
 * En-tête (axe 14) : sans la prop `hauteurEtiquetteMin`, `Entete` rend en 9:16 exactement le balisage d'avant (ENT-A et le repli
 * d'alerte n'ont pas de prop : ils sont inchangés) ; en 4:5 seul l'espacement de l'étiquette change (0,24 em).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Entete } from "../../../studio-rendu/compositions/image-video/Entete";

const entete = { titre: "Vos relances *partent* seules", etiquette: "Suivi le jour même" };
const rendre = (hauteur: number, largeur: number, extra: object = {}) =>
  renderToStaticMarkup(React.createElement(Entete, { entete, ecoule: 1, sortie: 0, fond: "ivoire", marque: "axion-ia.com", largeur, hauteur, ...extra } as never));

describe("balisage de l'en-tête", () => {
  it("9:16 sans la prop : balisage d'avant (figé, relevé sur master c14b83c)", () => {
    expect(rendre(1920, 1080)).toBe('<div style="position:absolute;left:0;top:86.39999999999999px;width:1080px;text-align:center;font-family:Axion Inter Bold;font-size:36.096000000000004px;letter-spacing:0.083em;color:#15100C;white-space:nowrap">axion-<span style="color:#C2532A">ia</span>.com</div><div style="position:absolute;left:0;top:259.20000000000005px;width:1080px;text-align:center;opacity:1"><div style="font-family:Axion Inter Bold;font-weight:700;font-size:28.032px;letter-spacing:0.32em;text-transform:uppercase;color:#C2532A;opacity:1">Suivi le jour même</div><div style="margin-top:30.72px;font-family:Axion Anton;font-weight:400;font-size:79.27px;line-height:1.05;text-transform:uppercase;color:#15100C"><div style="white-space:nowrap"><span style="display:inline-block;margin-right:0.22em;opacity:1;transform:translateY(0px);color:#15100C">Vos</span><span style="display:inline-block;margin-right:0.22em;opacity:1;transform:translateY(0px);color:#15100C">relances</span><span style="display:inline-block;margin-right:0.22em;opacity:1;transform:translateY(0px);color:#C2532A">partent</span><span style="display:inline-block;margin-right:0.22em;opacity:1;transform:translateY(0px);color:#15100C">seules</span></div></div></div>');
  });
  it("9:16 : la prop ajoute seulement minHeight", () => {
    expect(rendre(1920, 1080, { hauteurEtiquetteMin: 33.92 })).toBe(rendre(1920, 1080).replace("letter-spacing:0.32em;", "letter-spacing:0.32em;min-height:33.92px;"));
  });
  it("4:5 : espacement 0,24 em, pas de minHeight sans la prop", () => {
    const h = rendre(1350, 1080);
    expect(h).toContain("letter-spacing:0.24em");
    expect(h).not.toContain("min-height");
  });
});
