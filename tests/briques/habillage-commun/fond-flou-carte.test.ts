import { describe, expect, it } from "vitest";
import { fondFlouPendantCartes } from "@/briques/motion/habillage-commun/fond-flou-carte";
import type { PlanScene } from "@/briques/composition/scene";

const cadrage = { valeur: "large", zoom: 1, zoomFin: 1.06, pointX: 0.5, pointY: 0.4 } as const;
const plan = (debutSec: number, finSec: number, extra: Partial<PlanScene> = {}): PlanScene => ({
  debutSec, finSec, type: "double", angle: "principal", cadrage: { ...cadrage }, ...extra,
});
const partage = { carte: "entree:c", hauteurHaut: 960, sourceY: 0, entreeImages: 8, carteDebutSec: 0 };
const miseEnPage = { mode: "cote", cote: "gauche", carte: "entree:c", entreeImages: 8, carteDebutSec: 0, geometrie: {} } as const;

describe("fondFlouPendantCartes", () => {
  it("aucun plan carte : []", () => {
    expect(fondFlouPendantCartes([plan(0, 3), plan(3, 6)])).toEqual([]);
    expect(fondFlouPendantCartes([])).toEqual([]);
  });
  it("une fenêtre par plan carte, cible decor", () => {
    const r = fondFlouPendantCartes([plan(0, 3), plan(3, 6, { ecranPartage: partage }), plan(8, 9, { miseEnPage })]);
    expect(r).toHaveLength(2);
    expect(r.every((f) => f.cible === "decor")).toBe(true);
    expect(r[0]).toMatchObject({ debutSec: 3, finSec: 6 });
  });
  it("2 cartes voisines : 1 fenêtre", () => {
    const r = fondFlouPendantCartes([plan(0, 3, { ecranPartage: partage }), plan(3, 6, { miseEnPage })]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ debutSec: 0, finSec: 6 });
  });
  it("plan d'illustration ou sans décor séparé : rien", () => {
    expect(fondFlouPendantCartes([plan(0, 3, { type: "illustration", ecranPartage: partage })])).toEqual([]);
    expect(fondFlouPendantCartes([plan(0, 3, { ecranPartage: partage })], { decorSepare: false })).toEqual([]);
  });
  it("bornes respectées sur entrées extrêmes", () => {
    const p = [plan(0, 3, { ecranPartage: partage })];
    const haut = fondFlouPendantCartes(p, { flouPx: 999, assombrir: 9, fonduSec: 99 })[0];
    expect([haut.flouPx, haut.assombrir, haut.fonduSec]).toEqual([24, 0.6, 0.4]);
    const bas = fondFlouPendantCartes(p, { flouPx: -5, assombrir: -1, fonduSec: -1 })[0];
    expect([bas.flouPx, bas.assombrir, bas.fonduSec]).toEqual([0, 0, 0.2]);
    const nan = fondFlouPendantCartes(p, { flouPx: NaN })[0];
    expect(Number.isFinite(nan.flouPx)).toBe(true);
  });
  it("même entrée, même sortie, entrée non modifiée", () => {
    const p = [plan(0, 3, { ecranPartage: partage }), plan(5, 7, { miseEnPage })];
    const copie = JSON.stringify(p);
    expect(fondFlouPendantCartes(p)).toEqual(fondFlouPendantCartes(p));
    expect(JSON.stringify(p)).toBe(copie);
  });
  it("plans désordonnés, durée nulle ignorée", () => {
    const r = fondFlouPendantCartes([plan(5, 7, { miseEnPage }), plan(0, 3, { ecranPartage: partage }), plan(9, 9, { ecranPartage: partage })]);
    expect(r.map((f) => f.debutSec)).toEqual([0, 5]);
  });
});
