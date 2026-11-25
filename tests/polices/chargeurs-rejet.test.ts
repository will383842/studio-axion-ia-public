import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POLICES-RENDU-v20l : plus aucun chargeur muet. Pour chaque chargeur de police de `commune/polices.ts` (5),
 * `sous-titres/polices.ts` (2) et `petits-objets/polices.ts` (1) : un fichier illisible arrête le rendu (`cancelRender`)
 * avec le nom de la famille ; un fichier lisible garde le comportement d'avant (un delayRender, un continueRender).
 */
const remotion = vi.hoisted(() => ({ cancelRender: vi.fn(), continueRender: vi.fn(), delayRender: vi.fn(() => 7) }));
const cheminRemotion = (() => {
  try {
    return createRequire(new URL("../../studio-rendu/package.json", import.meta.url)).resolve("remotion").replace("/cjs/index.js", "/esm/index.mjs");
  } catch {
    return "remotion";
  }
})();

const base = (...p: string[]) => ["../../studio-rendu", "compositions", ...p].join("/");
type Module = Record<string, unknown>;
const charger = async (chemin: string): Promise<Module> => (await import(/* @vite-ignore */ chemin)) as Module;

const CAS: { module: string; fonction: string; famille: string; appels?: string[] }[] = [
  { module: base("commune", "polices"), fonction: "chargerPoliceTitre", famille: "Axion Inter Bold" },
  { module: base("commune", "polices"), fonction: "chargerPoliceMontserrat", famille: "Axion Montserrat ExtraBold" },
  { module: base("commune", "polices"), fonction: "chargerPoliceAnton", famille: "Axion Anton" },
  { module: base("commune", "polices"), fonction: "chargerPoliceInterMedium", famille: "Axion Inter Medium" },
  { module: base("commune", "polices"), fonction: "chargerPoliceInterSemiBold", famille: "Axion Inter SemiBold" },
  { module: base("sous-titres", "polices"), fonction: "chargerPolices", famille: "Axion Manrope Medium" },
  { module: base("sous-titres", "polices"), fonction: "chargerPoliceVariable", famille: "Axion Manrope Variable" },
  { module: base("petits-objets", "polices"), fonction: "chargerJetBrainsMono", famille: "JetBrains Mono" },
];

describe("chargeurs de polices : un fichier illisible arrête le rendu", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock(cheminRemotion, () => remotion);
    remotion.cancelRender.mockClear();
    remotion.continueRender.mockClear();
    remotion.delayRender.mockClear();
    vi.stubGlobal("document", { fonts: { add: vi.fn() } });
  });
  afterEach(() => vi.unstubAllGlobals());

  for (const cas of CAS) {
    it(`${cas.fonction} : fichier illisible → cancelRender avec « ${cas.famille} », jamais continueRender`, async () => {
      vi.stubGlobal("FontFace", class { family: string; constructor(f: string) { this.family = f; } load() { return Promise.reject(new Error("404")); } });
      const mod = await charger(cas.module);
      const erreurs: unknown[] = [];
      const ecouteur = (e: unknown) => erreurs.push(e);
      process.on("unhandledRejection", ecouteur);
      (mod[cas.fonction] as () => void)();
      await new Promise((r) => setTimeout(r, 20));
      process.off("unhandledRejection", ecouteur);
      expect(remotion.cancelRender).toHaveBeenCalledTimes(cas.fonction === "chargerPolices" ? 2 : 1); // chargerPolices : Medium + ExtraBold
      const message = (remotion.cancelRender.mock.calls[0] as unknown as [Error])[0].message;
      expect(message).toContain(cas.famille);
      expect(message).toContain("404");
      expect(remotion.continueRender).not.toHaveBeenCalled();
    });

    it(`${cas.fonction} : fichier lisible → un delayRender, un continueRender, aucun cancelRender, 2e appel sans rechargement`, async () => {
      vi.stubGlobal("FontFace", class { family: string; constructor(f: string) { this.family = f; } load() { return Promise.resolve(this); } });
      const mod = await charger(cas.module);
      const appeler = mod[cas.fonction] as () => void;
      appeler();
      appeler();
      await new Promise((r) => setTimeout(r, 20));
      const attendus = cas.fonction === "chargerPolices" ? 2 : 1; // chargerPolices : Medium + ExtraBold par défaut
      expect(remotion.delayRender).toHaveBeenCalledTimes(attendus);
      expect(remotion.continueRender).toHaveBeenCalledTimes(attendus);
      expect(remotion.cancelRender).not.toHaveBeenCalled();
    });
  }
});
