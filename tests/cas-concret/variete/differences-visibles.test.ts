/**
 * GV2-52 · variété du cas concret : on ne compte que les différences qui se dessinent. La mise en page de L2 et la
 * transition « raccord-objet » ne sont jamais rendues : elles ne comptent pas.
 */
import { describe, expect, it } from "vitest";
import { differences, DIFFERENCES_MIN, DIMENSIONS_COMPAREES, MISES_EN_PAGE, TIRAGE_V4, TYPES_MIS_EN_PAGE, valeurDimension, type Tirage } from "@/moteurs/montage-cas-concret/variete";

const base: Tirage = { ...TIRAGE_V4 };
const mise = (v: (typeof MISES_EN_PAGE)[number]) => Object.fromEntries(TYPES_MIS_EN_PAGE.map((t) => [t, v])) as Tirage["miseEnPage"];

describe("GV2-52 · différences visibles du cas concret", () => {
  it("deux tirages qui ne diffèrent que par la mise en page de L2 et « raccord-objet » : 0 différence", () => {
    const a: Tirage = { ...base, miseEnPage: mise("v4-centree"), transitions: [{ moment: "bascule", type: "raccord-objet" }] };
    const b: Tirage = { ...base, miseEnPage: mise("plein-cadre"), transitions: [{ moment: "bascule", type: "raccord-objet" }, { moment: "fin", type: "raccord-objet" }].slice(0, 1) };
    expect(differences(a, b)).toBe(0);
    const c: Tirage = { ...base, miseEnPage: mise("gauche"), transitions: [{ moment: "bascule", type: "raccord-objet" }] };
    expect(differences(a, c)).toBe(0);
  });

  it("une transition dessinée compte toujours", () => {
    const a: Tirage = { ...base, transitions: [{ moment: "bascule", type: "poussee" }] };
    const b: Tirage = { ...base, transitions: [{ moment: "bascule", type: "eclair" }] };
    expect(differences(a, b)).toBe(1);
    expect(differences(a, { ...base, transitions: [{ moment: "bascule", type: "raccord-objet" }] })).toBe(1);
  });

  it("4 dimensions rendues différentes : la règle est tenue", () => {
    const b: Tirage = { ...base, ouverture: "chiffre-choc", structure: "resultat-d-abord", jeuAnimation: "zoom", fondFort: !base.fondFort } as Tirage;
    expect(differences(base, b)).toBeGreaterThanOrEqual(DIFFERENCES_MIN);
  });

  it("la valeur d'une dimension non rendue est stable (un tirage hérité reste identique)", () => {
    expect(valeurDimension(base, "miseEnPage")).toBe(valeurDimension({ ...base }, "miseEnPage"));
    expect(DIMENSIONS_COMPAREES).toContain("miseEnPage");
    expect(differences(base, { ...base })).toBe(0);
  });
});
