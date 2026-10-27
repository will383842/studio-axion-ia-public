/** Lot 3 · rail d'étapes : géométrie pure de RAI-B, RAI-C, RAI-D (bornes x 60-1020, hauteur du rail, 84 px en 4:5, aucun texte). */
import { describe, expect, it } from "vitest";
import { VARIANTES_GARDEES } from "@/briques/schema-motion/variete";
import { RAIL_45, RAIL_IV, placeRail } from "../../../studio-rendu/compositions/image-video/plan";
import { geometrieRail, type CarteGeo, type CodeRail } from "../../../studio-rendu/compositions/image-video/variete/rail/geometrie";

const largeur = (RAIL_IV.droite - RAIL_IV.gauche - 2 * RAIL_IV.ecart) / 3;
const pas = largeur + RAIL_IV.ecart;
const cartes = (f: number): CarteGeo[] =>
  [0, 1, 2, 3, 4].map((i) => ({ id: `n${i}`, x: RAIL_IV.gauche + (i - f) * pas, largeur, opacite: 1, etat: i < 2 ? "vu" : i === 2 ? "actif" : "absent", remplissage: i === 2 ? 0.5 : undefined }));
const places = { "9:16": { haut: RAIL_IV.haut, hauteur: RAIL_IV.hauteur }, "4:5": { haut: RAIL_45.haut, hauteur: RAIL_45.hauteur } };
const codes: CodeRail[] = ["RAI-B", "RAI-C", "RAI-D"];

describe("geometrieRail", () => {
  it("garde RAI-B, RAI-C, RAI-D", () => expect(VARIANTES_GARDEES.rail).toEqual(["RAI-B", "RAI-C", "RAI-D"]));
  it("RAI-A n'a aucun élément propre", () => expect(geometrieRail("RAI-A", cartes(0), places["9:16"])).toEqual([]));
  for (const [nom, place] of Object.entries(places))
    for (const code of codes)
      it(`${code} en ${nom} : tout reste dans x 60-1020 et dans la hauteur du rail`, () => {
        for (const f of [0, 0.3, 1, 1.7, 2]) {
          const els = geometrieRail(code, cartes(f), place);
          expect(els.length).toBeGreaterThan(0);
          for (const e of els) {
            expect(e.x).toBeGreaterThanOrEqual(RAIL_IV.gauche);
            expect(e.x + e.largeur).toBeLessThanOrEqual(RAIL_IV.droite);
            expect(e.y).toBeGreaterThanOrEqual(0);
            expect(e.y + e.hauteur).toBeLessThanOrEqual(place.hauteur);
            expect(e).not.toHaveProperty("texte");
          }
        }
      });
  it("en 4:5 le rail tient dans 84 px", () => {
    expect(RAIL_45.hauteur).toBe(84);
    for (const code of codes) for (const e of geometrieRail(code, cartes(0), places["4:5"])) expect(e.y + e.hauteur).toBeLessThanOrEqual(84);
  });
  it("RAI-B : un point de 18 px par carte visible", () => {
    const pts = geometrieRail("RAI-B", cartes(0), places["9:16"]).filter((e) => e.genre === "point");
    expect(pts).toHaveLength(RAIL_IV.cartes);
    for (const p of pts) expect([p.largeur, p.hauteur]).toEqual([18, 18]);
  });
});
