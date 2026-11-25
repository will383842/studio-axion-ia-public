import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { FAMILLE_CSS, POLICE } from "@/briques/charte/axion-2026";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POLICES-RENDU-v20l : un seul chargeur de la police de marque (`commune/police-marque.ts`), sous ses deux noms.
 * Environnement node : `document` et `FontFace` sont posés par `vi.stubGlobal`, le module est chargé par chemin CALCULÉ.
 */
const remotion = vi.hoisted(() => ({ cancelRender: vi.fn(), continueRender: vi.fn(), delayRender: vi.fn(() => 7) }));
const cheminRemotion = (() => {
  try {
    return createRequire(new URL("../../studio-rendu/package.json", import.meta.url)).resolve("remotion").replace("/cjs/index.js", "/esm/index.mjs");
  } catch {
    return "remotion";
  }
})();
vi.mock("../../studio-rendu/compositions/commune/polices/Manrope-Variable.ttf", () => ({ default: "manrope-variable.ttf" }));

const MODULE = ["../../studio-rendu", "compositions", "commune", "police-marque"].join("/");
type Marque = { chargerPoliceMarque: () => void; policeMarquePrete: () => Promise<void> };
const charger = async (): Promise<Marque> => (await import(/* @vite-ignore */ MODULE)) as Marque;

describe("police de marque : un chargeur, deux noms, jamais muet", () => {
  const ajoutees: string[] = [];
  beforeEach(() => {
    vi.resetModules();
    vi.doMock(cheminRemotion, () => remotion);
    remotion.cancelRender.mockClear();
    remotion.continueRender.mockClear();
    remotion.delayRender.mockClear();
    ajoutees.length = 0;
    vi.stubGlobal("document", { fonts: { add: (f: { famille: string }) => ajoutees.push(f.famille) } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("(a) les deux familles « Axion Manrope » et « Manrope » sont ajoutées à document.fonts, en 200 à 800", async () => {
    const poids: string[] = [];
    vi.stubGlobal("FontFace", class { famille: string; constructor(f: string, _u: string, d: { weight: string }) { this.famille = f; poids.push(d.weight); } load() { return Promise.resolve(this); } });
    const { policeMarquePrete } = await charger();
    await policeMarquePrete();
    expect(ajoutees.sort()).toEqual([FAMILLE_CSS, POLICE].sort());
    expect(ajoutees.sort()).toEqual(["Axion Manrope", "Manrope"]);
    expect(poids).toEqual(["200 800", "200 800"]);
  });

  it("(b) un seul delayRender (30 s), levé après le succès des deux familles", async () => {
    vi.stubGlobal("FontFace", class { famille = "x"; load() { return Promise.resolve(this); } });
    const { chargerPoliceMarque, policeMarquePrete } = await charger();
    chargerPoliceMarque();
    await policeMarquePrete();
    expect(remotion.delayRender).toHaveBeenCalledTimes(1);
    expect(remotion.delayRender).toHaveBeenCalledWith("Police Manrope", { timeoutInMilliseconds: 30_000 });
    expect(remotion.continueRender).toHaveBeenCalledTimes(1);
    expect(remotion.continueRender).toHaveBeenCalledWith(7);
  });

  it("(c) un fichier illisible : cancelRender avec « Manrope » dans le message, jamais continueRender, le rejet se propage", async () => {
    vi.stubGlobal("FontFace", class { load() { return Promise.reject(new Error("404")); } });
    const { policeMarquePrete } = await charger();
    await expect(policeMarquePrete()).rejects.toThrow(/Police Manrope illisible : 404/);
    expect(remotion.cancelRender).toHaveBeenCalledTimes(1);
    expect((remotion.cancelRender.mock.calls[0] as unknown as [Error])[0].message).toContain("Manrope");
    expect(remotion.continueRender).not.toHaveBeenCalled();
  });

  it("(d) deux appels, un seul chargement ; sans document (node) rien n'est chargé", async () => {
    let constructions = 0;
    vi.stubGlobal("FontFace", class { famille = "x"; constructor() { constructions += 1; } load() { return Promise.resolve(this); } });
    const { chargerPoliceMarque, policeMarquePrete } = await charger();
    chargerPoliceMarque();
    chargerPoliceMarque();
    await policeMarquePrete();
    expect(constructions).toBe(2);
    expect(remotion.delayRender).toHaveBeenCalledTimes(1);

    vi.resetModules();
    vi.stubGlobal("document", undefined);
    remotion.delayRender.mockClear();
    const seul = await charger();
    seul.chargerPoliceMarque();
    await seul.policeMarquePrete();
    expect(remotion.delayRender).not.toHaveBeenCalled();
  });
});

describe("(e) l'APPEL au chargeur unique, pas seulement l'import : chaque hôte de la fiche", () => {
  const lire = (rel: string): string => readFileSync(new URL(`../../studio-rendu/compositions/${rel}`, import.meta.url), "utf8");
  const sansCommentaires = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("PlanDeScenes : chargerManrope() n'est plus qu'un appel à chargerPoliceMarque()", () => {
    expect(sansCommentaires(lire("plan-scenes/PlanDeScenes.tsx"))).toMatch(/export function chargerManrope\(\): void \{\s*chargerPoliceMarque\(\);\s*\}/);
  });

  it.each(["tableau/ObjetsTableau.tsx", "commune/fin/CarteFinAxion.tsx", "petits-objets/planche/RacinePlanches.tsx", "demo-facecam/DemoFacecam.tsx"])(
    "%s appelle chargerPoliceMarque() dans le corps du composant (pas seulement l'import)",
    (rel) => {
      const code = sansCommentaires(lire(rel));
      const sansImport = code.replace(/^import .*$/gm, "");
      expect(sansImport).toMatch(/(^|[^\w.])chargerPoliceMarque\(\);/m);
    },
  );

  it.each([
    ["commune/ecrans-couverture/CarteVideoArrondie.tsx", "chargerManropeCarte"],
    ["commune/ecrans-couverture/Duel.tsx", "chargerManropeDuel"],
    ["commune/ecrans-couverture/FilSocialGenerique.tsx", "chargerManropeFil"],
  ])("%s : le chargeur local %s EST chargerPoliceMarque et il est appelé", (rel, nom) => {
    const code = sansCommentaires(lire(rel));
    expect(code).toMatch(new RegExp(`const ${nom} = chargerPoliceMarque;`));
    expect(code.replace(/^const .*$/gm, "")).toMatch(new RegExp(`${nom}\\(\\);`));
  });
});
