/**
 * Variété IV · lot 1 (socle) : diversité des tirages enchaînés, recette effective après replis, recettes anciennes.
 * Les cartes A et B (une seule ouverture, récit / chiffres / caméra imposés) ne sont pas mesurées ici ; la carte E (récit, chiffres et
 * caméra imposés) n'est mesurée que sur la distinction des recettes : son taux sous le seuil attend les variantes des lots suivants.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AXES_VARIETE, REFERENCES, codeDe, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { recetteEffectiveIV } from "@/moteurs/montage-image-video/variete/historique";
import { SEUIL_RESSEMBLANCE, ressemblanceRecette } from "@/moteurs/montage-image-video/variete/ressemblance";
import { RECETTE_REFERENCE_IV, tirerVarieteIV } from "@/moteurs/montage-image-video/variete/tirage";

const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));

describe("30 tirages enchaînés (historique nourri à chaque tour)", () => {
  for (const nom of ["C", "D", "E", "F"]) {
    it(`carte ${nom} : 30 recettes distinctes${nom === "E" ? "" : ", au moins 90 % sous le seuil avec chacune des 10 précédentes"}`, () => {
      const carte = carteDe(nom);
      const historique: RecetteVarieteIV[] = []; // la plus récente d'abord
      let paires = 0;
      let sous = 0;
      for (let i = 0; i < 30; i++) {
        const r = tirerVarieteIV({ graine: `diversite-${nom}-${i}`, carte, format: "9:16", historique });
        for (const p of historique.slice(0, 10)) {
          paires++;
          if (ressemblanceRecette(r, p) < SEUIL_RESSEMBLANCE) sous++;
        }
        historique.unshift(r);
      }
      expect(new Set(historique.map((r) => JSON.stringify(r))).size).toBe(30);
      if (nom !== "E") expect(sous / paires).toBeGreaterThanOrEqual(0.9);
    });
  }
  it("le tirage reste déterministe", () => {
    const carte = carteDe("C");
    expect(tirerVarieteIV({ graine: "d", carte, format: "9:16" })).toEqual(tirerVarieteIV({ graine: "d", carte, format: "9:16" }));
  });
});

describe("recetteEffectiveIV", () => {
  const R: RecetteVarieteIV = { ...RECETTE_REFERENCE_IV, ouverture: "OUV-A", recit: "REC-B", chiffres: "CHI-D", texte: "TYP-B", fin: "FIN-C", camera: "CAM-B" };
  it("sans repli : la recette telle quelle", () => expect(recetteEffectiveIV(R, [])).toEqual(R));
  it("repli typo : TYP-C", () => expect(recetteEffectiveIV(R, [{ axe: "texte" }]).texte).toBe("TYP-C"));
  it("repli fin : la référence de la fin", () => expect(recetteEffectiveIV(R, [{ axe: "fin" }]).fin).toBe(REFERENCES.fin));
  it("repli chiffres : la référence des chiffres, le reste ne bouge pas", () => {
    expect(recetteEffectiveIV(R, [{ axe: "chiffres" }])).toEqual({ ...R, chiffres: "CHI-A" });
  });
  it("repli d'ouverture : OUV-D", () => expect(recetteEffectiveIV(R, [{ axe: "ouverture" }]).ouverture).toBe("OUV-D"));
  it("ne modifie pas la recette reçue", () => {
    recetteEffectiveIV(R, [{ axe: "texte" }]);
    expect(R.texte).toBe("TYP-B");
  });
});

describe("recette ancienne (sans les axes ajoutés)", () => {
  const ancienne = Object.fromEntries(AXES_VARIETE.filter((a) => !["fond", "rail", "objets", "entete"].includes(a)).map((a) => [a, RECETTE_REFERENCE_IV[a]])) as Partial<RecetteVarieteIV>;
  it("codeDe rend la référence de l'axe absent", () => {
    expect(codeDe(ancienne, "fond")).toBe("FON-A");
    expect(codeDe(ancienne, "entete")).toBe("ENT-A");
    expect(codeDe(undefined, "rail")).toBe("RAI-A");
    expect(codeDe({ ...ancienne, camera: "CAM-C" }, "camera")).toBe("CAM-C");
  });
  it("se compare sans erreur, dans les deux sens, et sans recevoir de nouveau champ", () => {
    const nouvelle = tirerVarieteIV({ graine: "x", carte: carteDe("C"), format: "9:16", historique: [ancienne as RecetteVarieteIV] });
    expect(() => ressemblanceRecette(nouvelle, ancienne as RecetteVarieteIV)).not.toThrow();
    expect(ressemblanceRecette(nouvelle, ancienne as RecetteVarieteIV)).toBe(ressemblanceRecette(ancienne as RecetteVarieteIV, nouvelle));
    expect(Object.keys(ancienne)).not.toContain("fond");
  });
});
