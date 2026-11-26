/**
 * Constat du 15/11 (fiche C8-Z02) : ce test DÉCRIT l'état des zooms aujourd'hui, il ne corrige rien.
 * Toute fiche zoom qui change une de ces valeurs doit le dire et mettre à jour ce test dans sa PR,
 * avec l'accord du relecteur.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { ZOOM_TAILLE } from "@/briques/realisation/zooms";
import { FACTEUR_ZOOM_MAX } from "@/moteurs/montage-demo-facecam/mise-en-page";

const lire = (chemin: string) => readFileSync(resolve(__dirname, "../..", chemin), "utf8");

describe("constat des zooms existants (15/11)", () => {
  it("v4 : zooms coupés, echelle 1, le contrôle V2 refuse un plan qui bouge", () => {
    const cadrage = lire("studio-rendu/compositions/interface-claire/cadrage.ts");
    expect(cadrage).toMatch(/export const ZOOMS_AUTORISES = false;/);
    expect(cadrage).toMatch(/if \(!ZOOMS_AUTORISES\) return \{ echelle: 1, visageX:/);
    const regles = lire("src/moteurs/montage-facecam-animee/realisateur/regles-v4.ts");
    expect(regles).toMatch(/if \(ctx\.prisBougee\) erreurs\.push\("V2 /);
    expect(regles).toMatch(/prisBougee: plan\.zooms\.length > 0 \|\| \(plan\.mouvements\?\.length \?\? 0\) > 0/);
  });

  it("avocat : poitrine 118-122 %, zoom lent 100 → 106 %", () => {
    expect(RECETTE_MONTAGE_AVOCAT.cadrages.poitrinePct).toEqual([118, 122]);
    expect(RECETTE_MONTAGE_AVOCAT.cadrages.zoomLentPct).toEqual([100, 106]);
    const decoupage = lire("src/moteurs/montage-avocat/decoupage.ts");
    expect(decoupage).toContain("R8  angle principal : large 100 % / poitrine 118-122 %");
    expect(decoupage).toContain("R9  zoom lent 100 → 106 %");
  });

  it("face caméra classique : plan serré 115 % (plafond du pilote, ZOOM-PLAFOND-115-v21u)", () => {
    expect(ZOOM_TAILLE).toBe(115);
  });

  it("démo : facteur de zoom maximal 2,5", () => {
    expect(FACTEUR_ZOOM_MAX).toBe(2.5);
  });

  it("cas concret : échelle de caméra maximale 1,035", () => {
    expect(lire("studio-rendu/compositions/cas-concret/plans/habillage.ts")).toMatch(/export const ECHELLE_CAMERA_MAX = 1\.035;/);
  });
});
