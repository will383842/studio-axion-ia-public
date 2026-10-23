import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELAI_DELAYRENDER_MS, DELAI_POLICE_MS } from "../../studio-rendu/compositions/visuels/commun/attente-police";

const remotion = vi.hoisted(() => ({ cancelRender: vi.fn(), continueRender: vi.fn(), delayRender: vi.fn(() => 7) }));
// Chemin ESM réel de remotion (installé dans studio-rendu) : c'est celui que vitest charge, un simple vi.mock("remotion") ne l'atteint pas.
const cheminRemotion = createRequire(new URL("../../studio-rendu/package.json", import.meta.url)).resolve("remotion").replace("/cjs/index.js", "/esm/index.mjs");
vi.mock("../../studio-rendu/compositions/commune/polices/ArchivoBlack-Regular.ttf", () => ({ default: "archivo.ttf" }));
vi.mock("../../studio-rendu/compositions/commune/polices/JetBrainsMono-Variable.ttf", () => ({ default: "jetbrains.ttf" }));

describe("police Archivo Black : comportement sans navigateur", () => {
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
    const { policeArchivoBlackPrete } = await import("../../studio-rendu/compositions/visuels/polices");
    await expect(policeArchivoBlackPrete()).rejects.toThrow(/Police Archivo Black illisible : 404/);
    await expect(policeArchivoBlackPrete()).rejects.toThrow(/illisible/);
    expect(remotion.cancelRender).toHaveBeenCalledTimes(1);
    expect(remotion.continueRender).not.toHaveBeenCalled();
  });

  it("un FontFace qui charge : continueRender, et delayRender garde un délai explicite de 30 s (> 20 s)", async () => {
    vi.stubGlobal("FontFace", class { load() { return Promise.resolve(this); } });
    const { policeArchivoBlackPrete } = await import("../../studio-rendu/compositions/visuels/polices");
    await policeArchivoBlackPrete();
    expect(remotion.continueRender).toHaveBeenCalledWith(7);
    expect(remotion.delayRender).toHaveBeenCalledWith("Police Archivo Black", { timeoutInMilliseconds: 30_000 });
    expect(DELAI_DELAYRENDER_MS).toBe(30_000);
    expect(DELAI_DELAYRENDER_MS).toBeGreaterThan(DELAI_POLICE_MS);
  });
});
