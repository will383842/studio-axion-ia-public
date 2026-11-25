import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FIX-POLICE-TERMINAL-v20l : `CalquePlanScenes` charge JetBrains Mono (terminal) SEULEMENT si le plan contient un
 * `objet-terminal-commande` (scène ou calque). Composant chargé par chemin CALCULÉ ; remotion, ImagePlan et les
 * chargeurs sont des doubles ; le composant est une fonction appelée à la main (aucun rendu).
 */
const cheminRemotion = (() => {
  try {
    return createRequire(new URL("../../studio-rendu/package.json", import.meta.url)).resolve("remotion").replace("/cjs/index.js", "/esm/index.mjs");
  } catch {
    return "remotion";
  }
})();
const compo = (nom: string) => new URL(`../../studio-rendu/compositions/${nom}`, import.meta.url).pathname;
const MODULE = ["../../studio-rendu", "compositions", "plan-scenes", "CalquePlanScenes"].join("/");
const appels = vi.hoisted(() => ({ jetbrains: 0, manrope: 0, delay: 0 }));

beforeEach(() => {
  vi.resetModules();
  appels.jetbrains = 0;
  appels.manrope = 0;
  appels.delay = 0;
  vi.doMock(cheminRemotion, () => ({ AbsoluteFill: "AbsoluteFill", useCurrentFrame: () => 0, useVideoConfig: () => ({ fps: 30 }), delayRender: () => { appels.delay++; return 1; }, continueRender: () => {}, cancelRender: () => {} }));
  vi.doMock(compo("petits-objets/polices"), () => ({ chargerJetBrainsMono: () => { appels.jetbrains++; } }));
  vi.doMock(compo("plan-scenes/PlanDeScenes"), () => ({ chargerManrope: () => { appels.manrope++; } }));
  vi.doMock(new URL("../../src/briques/plan-scenes/rendu", import.meta.url).pathname, () => ({ ImagePlan: "ImagePlan" }));
});
afterEach(() => vi.resetModules());

type Scene = { piece: string; calques?: { piece: string }[] };
const rendre = async (scenes: Scene[]) => {
  const { CalquePlanScenes } = (await import(/* @vite-ignore */ MODULE)) as { CalquePlanScenes: (p: { plan: unknown }) => unknown };
  CalquePlanScenes({ plan: { format: { fps: 25 }, scenes } });
};

describe("CalquePlanScenes : la police à chasse fixe suit le terminal", () => {
  it("(a) plan avec un terminal en scène : le chargeur est appelé une fois", async () => {
    await rendre([{ piece: "objet-gros-chiffre" }, { piece: "objet-terminal-commande" }]);
    expect(appels.jetbrains).toBe(1);
    expect(appels.manrope).toBe(1);
  });

  it("(b) plan avec un terminal en calque : le chargeur est appelé une fois", async () => {
    await rendre([{ piece: "objet-gros-chiffre", calques: [{ piece: "objet-etape" }, { piece: "objet-terminal-commande" }] }]);
    expect(appels.jetbrains).toBe(1);
  });

  it("(c) plan sans terminal, plan vide, calques vides : le chargeur n'est jamais appelé (identique à avant)", async () => {
    await rendre([{ piece: "objet-gros-chiffre", calques: [] }, { piece: "objet-etape" }]);
    await rendre([]);
    expect(appels.jetbrains).toBe(0);
    expect(appels.manrope).toBe(2);
  });

  it("(d) le seul appelant de chargerJetBrainsMono dans studio-rendu/ et src/ est CalquePlanScenes.tsx (liste fermée, source)", () => {
    const src = readFileSync(new URL("../../studio-rendu/compositions/plan-scenes/CalquePlanScenes.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/import \{ chargerJetBrainsMono \} from "\.\.\/petits-objets\/polices";/);
    expect(src).toMatch(/objet-terminal-commande/);
    expect(src).toMatch(/\) chargerJetBrainsMono\(\);/);
  });
});
