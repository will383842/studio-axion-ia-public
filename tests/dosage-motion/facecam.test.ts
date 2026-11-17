/** X3-05 : face caméra, cartes automatiques selon le cran. Tout éteint : sans cran, rien ne change. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { habillageFacecam } from "@/moteurs/montage-facecam/habillage";
import { cartePosee } from "@/moteurs/montage-facecam/raccords";
import { cartesAutoSelonDosage, retireesAvecDosage } from "@/moteurs/montage-facecam/dosage";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
const MOTS: MotHorodate[] = reel.mots.filter((m) => m.finSec <= 100);
const DUREE = 100;
const base = { pisteMonteeCle: "facecam/v-05/montage.mov", dureeSec: DUREE, mots: MOTS, prefixeCartes: "facecam/v-05/cartes" };

function posees(retirees: string[], cartes?: (ReturnType<typeof cartePosee>)[]) {
  const c = (cartes ?? []).flatMap((x) => (x ? [x] : []));
  return habillageFacecam({ ...base, ...(c.length ? { cartes: c } : {}), cartesAutoRetirees: retirees });
}

describe("X3-05 · dosage et cartes automatiques du face caméra", () => {
  const eteint = posees([]);
  const vues = eteint.cartesAutoVues;
  const nbPosees = vues.filter((v) => v.etat === "posee").length;

  it("la vidéo témoin porte assez de cartes automatiques", () => {
    expect(nbPosees).toBeGreaterThanOrEqual(2);
  });

  it("cartesAutoSelonDosage : tout en aucun, une sur deux en sobre, rien sinon", () => {
    const l = ["a", "b", "c", "d", "e"].map((idStable) => ({ idStable, etat: "posee" as const }));
    expect(cartesAutoSelonDosage("aucun", l)).toEqual(["a", "b", "c", "d", "e"]);
    expect(cartesAutoSelonDosage("sobre", l)).toEqual(["b", "d"]);
    expect(cartesAutoSelonDosage("equilibre", l)).toEqual([]);
    expect(cartesAutoSelonDosage("dynamique", l)).toEqual([]);
  });

  it("une carte déjà retirée ou masquée ne compte pas dans la moitié", () => {
    const l = [
      { idStable: "a", etat: "posee" as const },
      { idStable: "x", etat: "retiree" as const },
      { idStable: "b", etat: "posee" as const },
    ];
    expect(cartesAutoSelonDosage("sobre", l)).toEqual(["b"]);
  });

  it("éteint = identique : sans cran ou en équilibre/dynamique, la liste est la même (même objet)", () => {
    const r = ["auto-x"];
    for (const cran of [undefined, "equilibre", "dynamique"] as const) {
      expect(retireesAvecDosage(cran, r, { ...base })).toBe(r);
    }
    const sans = posees(retireesAvecDosage(undefined, [], base));
    expect(sans).toEqual(eteint);
  });

  it("aucun : 0 carte auto posée, sous-titres identiques à l'éteint", () => {
    const h = posees(retireesAvecDosage("aucun", [], base));
    expect(h.cartesAuto).toHaveLength(0);
    expect(h.cartes).toHaveLength(0);
    expect(h.entree.segments).toEqual(eteint.entree.segments);
    expect(h.segments.length).toBeGreaterThan(0);
  });

  it("aucun : une carte du monteur (consigne de Williams) passe", () => {
    const monteur = cartePosee({ id: "m1", debutSec: 3, finSec: 6, disposition: "plein-ecran", modele: null, textes: [], description: "carte demandée" } as never);
    expect(monteur).not.toBeNull();
    const h = posees(retireesAvecDosage("aucun", [], base), [monteur]);
    expect(h.cartesAuto).toHaveLength(0);
    expect(h.cartes.length).toBe(1);
  });

  it("sobre : au plus la moitié (arrondie en haut) des cartes de l'éteint", () => {
    const h = posees(retireesAvecDosage("sobre", [], base));
    expect(h.cartesAuto.length).toBeGreaterThan(0);
    expect(h.cartesAuto.length).toBeLessThanOrEqual(Math.ceil(nbPosees / 2));
  });

  it("les retraits du cran s'ajoutent à ceux de Williams, sans doublon", () => {
    const retirees = [vues[0].idStable];
    const r = retireesAvecDosage("aucun", retirees, base);
    expect(r).toContain(vues[0].idStable);
    expect(new Set(r).size).toBe(r.length);
  });
});
