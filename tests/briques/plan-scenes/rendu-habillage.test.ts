import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ImagePlan } from "@/briques/plan-scenes/rendu";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";

const CHEMIN_FIXTURE = join(__dirname, "__fixtures__", "rendu-sans-habillage.json");

const plan = validerPlan(PLAN_DEMO).plan;
const planFacecam = validerPlan({ ...structuredClone(PLAN_DEMO), facecam: true }).plan;
const fps = plan.format.fps;

/** Images 0, 3, 7, 12, puis première, milieu et dernière image de chaque scène. */
function images(): number[] {
  const s = new Set<number>([0, 3, 7, 12]);
  for (const sc of plan.scenes) {
    const d = Math.round((sc.debutMs * fps) / 1000);
    const f = Math.round((sc.finMs * fps) / 1000) - 1;
    s.add(d);
    s.add(Math.floor((d + f) / 2));
    s.add(f);
  }
  return [...s].sort((a, b) => a - b);
}

function balisages(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [variante, p] of [["normal", plan], ["facecam", planFacecam]] as const) {
    for (const image of images()) out[`${variante}:${image}`] = renderToStaticMarkup(createElement(ImagePlan, { plan: p, image }));
  }
  return out;
}

describe("rendu d'un plan sans habillage commun (fixture produite par le code d'avant C6-H3)", () => {
  it("fixture : balisage identique octet pour octet (plan normal et facecam)", () => {
    // La fixture a été écrite une seule fois, par le code de master avant C6-H3 (FIXTURE_ECRIRE=1). Jamais régénérée ensuite.
    if (process.env.FIXTURE_ECRIRE === "1" && !existsSync(CHEMIN_FIXTURE)) writeFileSync(CHEMIN_FIXTURE, JSON.stringify(balisages(), null, 1) + "\n");
    const attendu = JSON.parse(readFileSync(CHEMIN_FIXTURE, "utf8")) as Record<string, string>;
    const obtenu = balisages();
    expect(Object.keys(obtenu).sort()).toEqual(Object.keys(attendu).sort());
    expect(Object.keys(attendu).some((k) => k.startsWith("facecam:"))).toBe(true);
    for (const k of Object.keys(attendu)) expect(obtenu[k], k).toBe(attendu[k]);
  });
});
