import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as commun from "@/services/_commun";
import { fabriquerEntreesDemoFacecam, CLE_REGLAGE_DEMO_REEL } from "@/services/entrees-demo-facecam";
import { lireEntreesDemo } from "@/moteurs/montage-demo-facecam/entrees";
import { aligneurReelDemande } from "@/moteurs/montage-facecam/dependances";

const deuxFichiers = { facecam: { cle: "videos/f.mp4", dureeSec: 60 }, ecran: { cle: "videos/e.mp4", dureeSec: 60 } };

const lire = vi.fn();
beforeEach(() => {
  lire.mockReset();
  vi.spyOn(commun, "lireParametre").mockImplementation(lire as never);
});
afterEach(() => vi.restoreAllMocks());

describe("fabriquerEntreesDemoFacecam", () => {
  it("la clé du réglage", () => expect(CLE_REGLAGE_DEMO_REEL).toBe("demoFacecam.reel"));

  it.each([
    ["absent", undefined],
    ["false", false],
    ['"true" (texte)', "true"],
    ["1", 1],
    ["null", null],
  ])("réglage %s : pas de facecamAligneurReel (éteint = identique)", async (_n, valeur) => {
    lire.mockImplementation(async (_id: string, defaut: unknown) => valeur ?? defaut);
    const e = await fabriquerEntreesDemoFacecam(deuxFichiers);
    expect(e).toEqual({ demoFacecam: deuxFichiers });
    expect("facecamAligneurReel" in e).toBe(false);
    expect(aligneurReelDemande({ entrees: e })).toBe(false);
  });

  it("lecture du réglage en échec : pas de facecamAligneurReel", async () => {
    lire.mockRejectedValue(new Error("base indisponible"));
    const e = await fabriquerEntreesDemoFacecam(deuxFichiers);
    expect("facecamAligneurReel" in e).toBe(false);
  });

  it("true : facecamAligneurReel: true, lu par aligneurReelDemande", async () => {
    lire.mockResolvedValue(true);
    const e = await fabriquerEntreesDemoFacecam(deuxFichiers);
    expect(lire).toHaveBeenCalledWith("demoFacecam.reel", false);
    expect(e.facecamAligneurReel).toBe(true);
    expect(aligneurReelDemande({ entrees: e })).toBe(true);
  });

  it("demoFacecam relu par lireEntreesDemo sans remarque (deux fichiers)", async () => {
    lire.mockResolvedValue(false);
    const e = await fabriquerEntreesDemoFacecam(deuxFichiers);
    const r = lireEntreesDemo({ entrees: e, prises: [] });
    expect(r.remarques).toEqual([]);
    expect(r.facecam?.cle).toBe("videos/f.mp4");
    expect(r.ecran?.cle).toBe("videos/e.mp4");
    expect(r.synchro).toEqual({ mode: "audio" });
  });

  it("une seule vidéo en écran partagé : sans remarque", async () => {
    lire.mockResolvedValue(false);
    const e = await fabriquerEntreesDemoFacecam({ facecam: { cle: "videos/u.mp4" }, ecranPartage: { ecran: "gauche" } });
    const r = lireEntreesDemo({ entrees: e, prises: [] });
    expect(r.remarques).toEqual([]);
    expect(r.ecran).toBeNull();
    expect(r.partieEcran).toBe("gauche");
  });

  it("ne modifie pas l'objet reçu", async () => {
    lire.mockResolvedValue(true);
    const entree = structuredClone(deuxFichiers);
    await fabriquerEntreesDemoFacecam(entree);
    expect(entree).toEqual(deuxFichiers);
  });

  it("garde statique : aucun import de fabrication, reglages, argent", () => {
    const src = readFileSync("src/services/entrees-demo-facecam.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export .* from)\b/.test(l)).join("\n");
    expect(imports).not.toMatch(/fabrication|reglages|argent|plafond|budget|cout|prix|zernio|publications/i);
  });
});
