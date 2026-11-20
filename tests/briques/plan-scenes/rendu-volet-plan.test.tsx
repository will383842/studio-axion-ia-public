import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RenduVoletPlan } from "@/briques/plan-scenes/briques/rendu-volet-plan";
import { OBJET_VOLET_AVANT_APRES } from "@/briques/motion/petits-objets/volet-avant-apres";
import { geometrieVolet } from "@/briques/motion/petits-objets/volet-avant-apres";

const A = "https://a/x.png";
const B = "https://a/y.png";
const base = { image: 12, fps: 30, dureeImages: 90, fond: "clair" as never, graine: 1 };
const rendre = (parametres: Record<string, unknown>, image = 12) => renderToStaticMarkup(createElement(RenduVoletPlan as never, { ...base, image, parametres }));
const clips = (html: string) => [...html.matchAll(/clip-path:([^;"]+)/g)].map((m) => m[1]);

describe("N-05-VOLET-c · RenduVoletPlan", () => {
  it("a) deux images dans l'ordre, dessin pur par-dessus, étiquettes", () => {
    const h = rendre({ avant: A, apres: B, etiquettes: true });
    expect(h.match(/<img/g)?.length).toBe(2);
    expect(h.indexOf(`src="${A}"`)).toBeGreaterThan(-1);
    expect(h.indexOf(`src="${A}"`)).toBeLessThan(h.indexOf(`src="${B}"`));
    expect(h).toContain("<svg");
    expect(h).toContain("Avant");
    expect(h).toContain("Après");
  });

  it("b) sens droite-gauche : clip-path inversés (formules de l'habillage Remotion)", () => {
    const pct = geometrieVolet(12, 90, "droite-gauche").coupure * 100;
    expect(clips(rendre({ avant: A, apres: B, sens: "droite-gauche" })).slice(0, 2)).toEqual([`inset(0 0 0 ${pct}%)`, `inset(0 ${100 - pct}% 0 0)`]);
    const pg = geometrieVolet(12, 90).coupure * 100;
    expect(clips(rendre({ avant: A, apres: B })).slice(0, 2)).toEqual([`inset(0 ${100 - pg}% 0 0)`, `inset(0 0 0 ${pg}%)`]);
  });

  it("c) le trait glisse ; en fin d'entrée la coupure est à mi-course", () => {
    expect(clips(rendre({ avant: A, apres: B }, 0))).not.toEqual(clips(rendre({ avant: A, apres: B }, 12)));
    expect(clips(rendre({ avant: A, apres: B }, 60)).slice(0, 2)).toEqual(["inset(0 50% 0 0)", "inset(0 0 0 50%)"]);
  });

  it("d) sans les deux adresses valides : rien du tout", () => {
    for (const p of [{}, { etiquettes: true }, { avant: A }, { apres: B }, { avant: "", apres: B }, { avant: "  ", apres: B }, { avant: A, apres: A }, { avant: 3, apres: B }, { avant: A, apres: null }]) {
      expect(rendre(p)).toBe("");
    }
  });

  it("e) même entrée = même sortie", () => {
    expect(rendre({ avant: A, apres: B, etiquettes: true })).toBe(rendre({ avant: A, apres: B, etiquettes: true }));
  });

  it("f) garde statique : pur, sans Remotion, sans couleur écrite", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/plan-scenes/briques/rendu-volet-plan.tsx"), "utf8");
    for (const interdit of [/from "@\//, /remotion/, /useCurrentFrame/, /useState/, /zod/, /plan-scenes-objets/, /mask/, /filter/, /drop-shadow/, /#[0-9a-fA-F]{3,8}\b/]) expect(src).not.toMatch(interdit);
  });

  it("g) le dessin pur de la sortie est celui de OBJET_VOLET_AVANT_APRES, rien de redessiné", () => {
    const pur = renderToStaticMarkup(OBJET_VOLET_AVANT_APRES.Rendu({ ...base, parametres: { avant: A, apres: B, etiquettes: true } }));
    expect(rendre({ avant: A, apres: B, etiquettes: true })).toContain(pur);
  });
});
