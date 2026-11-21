/** BR-RACCORD-FORME-a-v21m · le raccord par forme dans le rendu du plan de scènes (pur, éteint par défaut). */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImagePlan } from "@/briques/plan-scenes/rendu";
import { CHARTE_AXION } from "@/briques/jetons-motion";
import { choisirRaccordForme, cheminAuTemps, DUREE_RACCORD_IMAGES } from "@/briques/motion/habillage-commun/raccord-forme";
import type { PlanHabille } from "@/briques/motion/habillage-commun/types";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";

const plan = validerPlan(PLAN_DEMO).plan;
const planFacecam = validerPlan({ ...structuredClone(PLAN_DEMO), facecam: true }).plan;
const fps = plan.format.fps;
const scene0 = plan.scenes[0]!;
const debut0 = Math.round((scene0.debutMs * fps) / 1000);
const rendre = (p: unknown, image: number) => renderToStaticMarkup(createElement(ImagePlan, { plan: p as never, image }));
const avecRaccord = (p: typeof plan) => ({ ...p, habillageCommun: { version: "habillage-1", pleinCadrePermis: false, raccords: { [p.scenes[0]!.id]: { de: "carre", vers: "carte" } } } }) as PlanHabille;
const retirerRaccord = (html: string) => html.replace(/<svg data-raccord-forme="1".*?<\/svg>/, "");

describe("cheminAuTemps (interpolation pure)", () => {
  const r = choisirRaccordForme({ de: "carre", vers: "carte", avecVisage: false, boite: { largeur: 1080, hauteur: 1920 } })!;
  it("bornes : t = 0 rend le chemin de départ, t = 1 le chemin d'arrivée, à l'identique", () => {
    expect(cheminAuTemps(r, 0)).toBe(r.cheminDe);
    expect(cheminAuTemps(r, 1)).toBe(r.cheminVers);
    expect(cheminAuTemps(r, -3)).toBe(r.cheminDe);
    expect(cheminAuTemps(r, 7)).toBe(r.cheminVers);
  });
  it("milieu : même structure (mêmes commandes), aucun NaN, nombres entre les deux bornes", () => {
    const m = cheminAuTemps(r, 0.5);
    expect(m).not.toMatch(/NaN|undefined|Infinity/);
    const lettres = (s: string) => s.replace(/[-\d.\s]/g, "");
    expect(lettres(m)).toBe(lettres(r.cheminDe));
    const nombres = (s: string) => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const [a, b, c] = [nombres(r.cheminDe), nombres(r.cheminVers), nombres(m)];
    expect(c).toHaveLength(a.length);
    c.forEach((x, i) => {
      expect(x).toBeGreaterThanOrEqual(Math.min(a[i]!, b[i]!) - 0.01);
      expect(x).toBeLessThanOrEqual(Math.max(a[i]!, b[i]!) + 0.01);
    });
  });
  it("déterministe : même entrée, même chemin", () => {
    expect(cheminAuTemps(r, 0.37)).toBe(cheminAuTemps(r, 0.37));
  });
  it("la durée du raccord est de 14 images", () => {
    expect(DUREE_RACCORD_IMAGES).toBe(14);
  });
});

describe("rendu : plan sans raccords = rendu identique", () => {
  it("un plan sans habillage et un plan avec habillage sans `raccords` rendent le même balisage", () => {
    const sans = { ...plan, habillageCommun: { version: "habillage-1", pleinCadrePermis: false } } as PlanHabille;
    for (const image of [0, debut0, debut0 + 5, debut0 + 20]) expect(rendre(sans, image), String(image)).toBe(rendre(plan, image));
    expect(rendre(plan, debut0)).not.toMatch(/data-raccord-forme/);
  });
});

describe("rendu : plan avec un raccord posé à la main", () => {
  const p = avecRaccord(plan);
  it("image 0 de la scène : un <path> de la couleur terracotta de la charte", () => {
    const html = rendre(p, debut0);
    expect(html).toMatch(/<svg data-raccord-forme="1"/);
    expect(html).toContain(`fill="${CHARTE_AXION.terracotta}"`);
    expect(html).toMatch(/<path d="M /);
  });
  it("après 14 images : plus aucun raccord", () => {
    expect(rendre(p, debut0 + DUREE_RACCORD_IMAGES - 1)).toMatch(/data-raccord-forme/);
    expect(rendre(p, debut0 + DUREE_RACCORD_IMAGES)).not.toMatch(/data-raccord-forme/);
  });
  it("la forme s'efface sur les 4 dernières images (opacité 1 jusqu'à la 10e, 0 à la 14e)", () => {
    const op = (i: number) => Number(/<path[^>]*opacity="([\d.]+)"/.exec(rendre(p, debut0 + i))?.[1]);
    expect(op(0)).toBe(1);
    expect(op(DUREE_RACCORD_IMAGES - 5)).toBe(1);
    expect(op(DUREE_RACCORD_IMAGES - 1)).toBe(0);
    expect(op(DUREE_RACCORD_IMAGES - 3)).toBeLessThan(op(DUREE_RACCORD_IMAGES - 4));
  });
  it("sous le contenu : sans le <svg>, le balisage est celui du plan sans raccord (texte de la scène identique)", () => {
    for (const image of [debut0, debut0 + 4, debut0 + 9, debut0 + 13]) expect(retirerRaccord(rendre(p, image)), String(image)).toBe(rendre(plan, image));
  });
  it("le <svg> précède le contenu de la scène (tracé dessous)", () => {
    const html = rendre(p, debut0);
    expect(html.indexOf("data-raccord-forme")).toBeLessThan(html.indexOf(scene0.piece === "legende" ? "legende" : "position:absolute", html.indexOf("data-raccord-forme") + 10));
  });
  it("le <svg> du raccord est le premier enfant de la scène (tracé SOUS le contenu)", () => {
    expect(rendre(p, debut0)).toMatch(/inset:0[^"]*"><svg data-raccord-forme="1"/);
  });
  it("le raccord est un morphing carré → carte : le chemin change d'une image à l'autre", () => {
    const d = (k: number) => /<path d="([^"]+)"/.exec(rendre(p, debut0 + k))?.[1];
    expect(d(0)).toBeDefined();
    expect(d(0)).not.toBe(d(DUREE_RACCORD_IMAGES - 1));
  });
  it("plan avec visage (facecam) : aucun raccord, balisage identique", () => {
    const pf = avecRaccord(planFacecam);
    for (const image of [debut0, debut0 + 6]) expect(rendre(pf, image), String(image)).toBe(rendre(planFacecam, image));
  });
  it("une scène sans raccord posé n'en reçoit pas", () => {
    const autre = plan.scenes[1];
    if (!autre) return;
    const debut = Math.round((autre.debutMs * fps) / 1000);
    expect(rendre(p, debut)).not.toMatch(/data-raccord-forme/);
  });
});
