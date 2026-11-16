import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ImagePlan, effet } from "@/briques/plan-scenes/rendu";
import { TRANSITIONS_COMMUNES } from "@/briques/motion/habillage-commun/transitions";
import type { PlanHabille } from "@/briques/motion/habillage-commun/types";
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

const rendre = (p: unknown, image: number) => renderToStaticMarkup(createElement(ImagePlan, { plan: p as never, image }));
const avec = (habillageCommun: PlanHabille["habillageCommun"]) => ({ ...plan, habillageCommun }) as PlanHabille;
const scene0 = plan.scenes[0]!;
const dT = Math.max(1, Math.round((scene0.transition.dureeMs * fps) / 1000));
const finScene0 = Math.round((scene0.finMs * fps) / 1000);
const attenduFixture = () => JSON.parse(readFileSync(CHEMIN_FIXTURE, "utf8")) as Record<string, string>;

describe("habillage commun des transitions (C6-H3)", () => {
  it("sans habillageCommun : égal à la fixture, plan normal et facecam (AM-13)", () => {
    const f = attenduFixture();
    for (const k of Object.keys(f)) {
      const [v, i] = k.split(":");
      expect(rendre(v === "facecam" ? planFacecam : plan, Number(i)), k).toBe(f[k]);
    }
  });

  it("habillageCommun sans transitions : identique à la fixture", () => {
    const f = attenduFixture();
    for (const [v, base] of [["normal", plan], ["facecam", planFacecam]] as const)
      for (const i of images()) expect(rendre({ ...base, habillageCommun: { version: "habillage-1", pleinCadrePermis: false } }, i)).toBe(f[`${v}:${i}`]);
  });

  it("entrée « iris » sur la scène 0 : ne diffère que dans la fenêtre d'entrée", () => {
    const p = avec({ version: "habillage-1", pleinCadrePermis: false, transitions: { [scene0.id]: { entree: "iris" } } });
    for (let i = 0; i < finScene0; i++) {
      expect(rendre(p, i) !== rendre(plan, i), `image ${i}`).toBe(i < dT);
    }
    expect(rendre(p, 2)).toContain("clip-path");
  });

  it("identifiant inconnu : retombée sur effet()", () => {
    const p = avec({ version: "habillage-1", pleinCadrePermis: false, transitions: { [scene0.id]: { entree: "cube", sortie: "cube" } } });
    for (let i = 0; i < finScene0; i++) expect(rendre(p, i)).toBe(rendre(plan, i));
  });

  it("volet-terracotta (plein cadre) : ignoré sans pleinCadrePermis, appliqué avec", () => {
    const t = { [scene0.id]: { entree: "volet-terracotta" } };
    const non = avec({ version: "habillage-1", pleinCadrePermis: false, transitions: t });
    const oui = avec({ version: "habillage-1", pleinCadrePermis: true, transitions: t });
    expect(rendre(non, 2)).toBe(rendre(plan, 2));
    expect(rendre(oui, 2)).not.toBe(rendre(plan, 2));
    expect(rendre(oui, 2)).toContain("clip-path");
  });

  it("égalité H1 ↔ effet()", () => {
    const b = { largeur: 1080, hauteur: 1920 };
    for (const id of ["fondu", "glisse-haut", "glisse-gauche", "zoom-doux"] as const)
      for (let k = 0; k <= 10; k++) expect(TRANSITIONS_COMMUNES[id].style(k / 10, "entree", b), `${id} ${k}`).toEqual(effet(id, k / 10));
  });

  it("garde : rendu.tsx n'importe ni @/, ni remotion, ni zod", () => {
    const src = readFileSync(join(__dirname, "../../../src/briques/plan-scenes/rendu.tsx"), "utf8");
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/from\s+["']remotion/);
    expect(src).not.toMatch(/from\s+["']zod/);
  });
});
