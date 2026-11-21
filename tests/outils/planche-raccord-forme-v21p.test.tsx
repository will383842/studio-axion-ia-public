/**
 * PLANCHE-RACCORD-FORME-v21p : le raccord par forme (carré → carte) dans une vraie tranche du cas concret, issue de la
 * chaîne réelle (adaptateur sans appel à Claude, tranche, habillage). Outil local, 0 €, rien allumé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanHabille } from "../../src/briques/motion/habillage-commun/types";
import { ImagePlan } from "../../src/briques/plan-scenes/rendu";
import { DUREE_RACCORD_IMAGES } from "../../src/briques/motion/habillage-commun/raccord-forme";
import { RACCORD_FORME_ACTIF } from "../../src/moteurs/montage-cas-concret/habillage-plan";
import { trancheRaccordForme } from "../../outils/raccord-forme/tranche";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const html = (plan: Parameters<typeof ImagePlan>[0]["plan"], image: number) => renderToStaticMarkup(createElement(ImagePlan, { plan, image }));

describe("planche raccord par forme : la tranche vient de la chaîne réelle", () => {
  it("exactement 1 raccord carré → carte, sur une scène de la tranche, sans visage", async () => {
    const t = await trancheRaccordForme();
    const raccords = t.tranche.habillageCommun?.raccords ?? {};
    expect(Object.keys(raccords)).toEqual([t.sceneId]);
    expect(raccords[t.sceneId]).toEqual({ de: "carre", vers: "carte" });
    expect(t.tranche.facecam).not.toBe(true);
    expect(t.tranche.scenes.some((s) => s.id === t.sceneId)).toBe(true);
    expect(t.tranche.habillageCommun?.transitions?.[t.sceneId]?.entree).toBeTruthy();
  });
  it("la forme est là au début, absente 14 images plus tard ; le témoin n'en a jamais", async () => {
    const t = await trancheRaccordForme();
    expect(html(t.tranche, t.premiereImage)).toContain('data-raccord-forme="1"');
    expect(html(t.tranche, t.imageDebut + 12)).toContain('data-raccord-forme="1"');
    expect(html(t.tranche, t.imageDebut + 10)).toContain('data-raccord-forme="1"');
    expect(html(t.tranche, t.imageDebut + DUREE_RACCORD_IMAGES)).not.toContain("data-raccord-forme");
    expect((t.temoin as PlanHabille).habillageCommun).toBeUndefined();
    for (const k of [1, 5, 10, 12]) expect(html(t.temoin, t.imageDebut + k)).not.toContain("data-raccord-forme");
  });
  it("déterministe : même appel, même tranche", async () => {
    expect(JSON.stringify(await trancheRaccordForme())).toBe(JSON.stringify(await trancheRaccordForme()));
  });
  it("la porte de production reste éteinte", () => {
    expect(RACCORD_FORME_ACTIF).toBe(false);
  });
});

describe("planche raccord par forme : gardes de l'outil", () => {
  it("aucune lecture de réglage ni de depots, aucun process.env, aucun fetch, aucune pastille IA", () => {
    for (const f of ["outils/raccord-forme/tranche.ts", "outils/raccord-forme/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/reglages|depots|process\.env|fetch\(|mention-ia|MentionIA/i);
    }
  });
  it("le script supprime son entrée temporaire (finally) et reste local", () => {
    const s = lire("outils/raccord-forme/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain('"captures", "raccord-forme"');
  });
  it("aucun fichier de src/ ni de studio-rendu/ n'importe outils/raccord-forme", () => {
    for (const f of ["src/moteurs/montage-cas-concret/habillage-plan.ts", "src/moteurs/montage-cas-concret/plan-scenes.ts", "src/briques/plan-scenes/rendu.tsx", "studio-rendu/compositions/plan-scenes/PlanDeScenes.tsx"]) {
      expect(lire(f), f).not.toMatch(/outils\/raccord-forme/);
    }
  });
});
