import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImagePlan, sceneActive, dureeImagesPlan } from "@/briques/plan-scenes/rendu";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";

const plan = validerPlan(PLAN_DEMO).plan;
const html = (image: number) => renderToStaticMarkup(createElement(ImagePlan, { plan, image }));

describe("rendu d'un plan (composition PlanDeScenes)", () => {
  it("durée : 15 s à 25 i/s = 375 images", () => {
    expect(dureeImagesPlan(plan)).toBe(375);
  });

  it("à chaque instant, la bonne scène", () => {
    expect(sceneActive(plan, 10)?.id).toBe(plan.scenes[0]!.id);
    expect(sceneActive(plan, 7 * 25)?.id).toBe(plan.scenes[1]!.id);
    expect(sceneActive(plan, 13 * 25)?.id).toBe(plan.scenes[2]!.id);
  });

  it("déterministe : même image = même rendu ; Manrope ; fond de la charte", () => {
    expect(html(100)).toBe(html(100));
    expect(html(100)).not.toBe(html(200));
    expect(html(100)).toContain("Manrope");
    expect(html(100).toLowerCase()).toContain("#faf9f5");
  });

  it("face caméra : fond transparent, la vidéo passe dessous", () => {
    const fc = validerPlan({ ...structuredClone(PLAN_DEMO), facecam: true }).plan;
    const h = renderToStaticMarkup(createElement(ImagePlan, { plan: fc, image: 50 }));
    expect(h).toContain("transparent");
  });
});
