import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELAI_DELAYRENDER_MS, DELAI_POLICE_MS } from "../../studio-rendu/compositions/visuels/commun/attente-police";

const remotion = vi.hoisted(() => ({ cancelRender: vi.fn(), continueRender: vi.fn(), delayRender: vi.fn(() => 7) }));
// Chemin ESM réel de remotion (installé dans studio-rendu) : c'est celui que vitest charge, un simple vi.mock("remotion") ne l'atteint pas.
// Sans les dépendances de studio-rendu (CI ciblée des visuels), le module n'est pas installé : on simule alors « remotion » lui-même.
const cheminRemotion = (() => {
  try {
    return createRequire(new URL("../../studio-rendu/package.json", import.meta.url)).resolve("remotion").replace("/cjs/index.js", "/esm/index.mjs");
  } catch {
    return "remotion";
  }
})();
vi.mock("../../studio-rendu/compositions/commune/polices/Manrope-Variable.ttf", () => ({ default: "manrope-variable.ttf" }));

describe("police des titres (Manrope) : comportement sans navigateur", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock(cheminRemotion, () => remotion);
    remotion.cancelRender.mockClear();
    remotion.continueRender.mockClear();
    remotion.delayRender.mockClear();
    vi.stubGlobal("document", { fonts: { add: vi.fn() } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("un FontFace qui rejette : le rejet se propage et cancelRender est appelé une seule fois", async () => {
    vi.stubGlobal("FontFace", class { load() { return Promise.reject(new Error("404")); } });
    const { policeTitrePrete } = await import("../../studio-rendu/compositions/visuels/polices");
    await expect(policeTitrePrete()).rejects.toThrow(/Police Manrope illisible : 404/);
    await expect(policeTitrePrete()).rejects.toThrow(/illisible/);
    expect(remotion.cancelRender).toHaveBeenCalledTimes(1);
    expect(remotion.continueRender).not.toHaveBeenCalled();
  });

  it("un FontFace qui charge : continueRender, et delayRender garde un délai explicite de 30 s (> 20 s)", async () => {
    vi.stubGlobal("FontFace", class { load() { return Promise.resolve(this); } });
    const { policeTitrePrete } = await import("../../studio-rendu/compositions/visuels/polices");
    await policeTitrePrete();
    expect(remotion.continueRender).toHaveBeenCalledWith(7);
    expect(remotion.delayRender).toHaveBeenCalledWith("Police Manrope", { timeoutInMilliseconds: 30_000 });
    expect(DELAI_DELAYRENDER_MS).toBe(30_000);
    expect(DELAI_DELAYRENDER_MS).toBeGreaterThan(DELAI_POLICE_MS);
  });

  it("texte courant : un FontFace qui rejette fait échouer le rendu une seule fois, même si titres et texte sont demandés", async () => {
    vi.stubGlobal("FontFace", class { load() { return Promise.reject(new Error("404")); } });
    const { policeInterPrete, policeTitrePrete } = await import("../../studio-rendu/compositions/visuels/polices");
    await expect(policeTitrePrete()).rejects.toThrow(/illisible/);
    await expect(policeInterPrete()).rejects.toThrow(/Police Manrope illisible : 404/);
    expect(remotion.cancelRender).toHaveBeenCalledTimes(1);
    expect(remotion.continueRender).not.toHaveBeenCalled();
  });

  it("texte courant : une seule face variable (200 à 800), sans face de repli, continueRender une fois, delayRender explicite de 30 s", async () => {
    const faces: string[] = [];
    vi.stubGlobal("FontFace", class { constructor(_f: string, _u: string, d: { weight: string; unicodeRange?: string }) { faces.push(d.unicodeRange ? `${d.weight} ${d.unicodeRange}` : d.weight); } load() { return Promise.resolve(this); } });
    const { policeInterPrete, policeTitrePrete } = await import("../../studio-rendu/compositions/visuels/polices");
    await policeInterPrete();
    await policeTitrePrete();
    expect(faces).toEqual(["200 800"]);
    expect(remotion.continueRender).toHaveBeenCalledTimes(1);
    expect(remotion.delayRender).toHaveBeenCalledWith("Police Manrope", { timeoutInMilliseconds: 30_000 });
  });
});
