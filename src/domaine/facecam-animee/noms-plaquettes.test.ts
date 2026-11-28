/**
 * S-15-v19b : noms stables des plaquettes du plan v4 — le nom vient du contenu, jamais du rang.
 */
import { describe, expect, it } from "vitest";
import { graineDePlaquette, nommerPlaquettes, uidDePlaquette } from "./noms-plaquettes";
import type { ElementV4Plan } from "./plan";

const plaquette = (sur: Partial<ElementV4Plan> = {}): ElementV4Plan => ({
  id: "mot-claque",
  debut: 1.5,
  fin: 3,
  mots: ["trente", "clients"],
  ...sur,
});

const plan: ElementV4Plan[] = [
  plaquette(),
  plaquette({ id: "compteur-orange", debut: 4, fin: 6, mots: ["300"], nombre: 300 }),
  plaquette({ id: "bandeau-bas", debut: 8, fin: 10, mots: undefined, nombre: undefined, motIndex: 12 }),
];

describe("graineDePlaquette", () => {
  it("même contenu → même graine ; aucun rang n'entre en jeu", () => {
    expect(graineDePlaquette(plan[0])).toBe(graineDePlaquette(plaquette()));
  });

  it("la graine porte le type, le début, les mots, le nombre et l'indice du mot", () => {
    expect(graineDePlaquette(plan[0])).toBe("mot-claque|1.5|trente clients||");
    expect(graineDePlaquette(plan[1])).toBe("compteur-orange|4|300|300|");
    expect(graineDePlaquette(plan[2])).toBe("bandeau-bas|8|||12");
  });

  it("chaque champ du contenu change la graine", () => {
    const base = graineDePlaquette(plan[0]);
    expect(graineDePlaquette(plaquette({ id: "autre" }))).not.toBe(base);
    expect(graineDePlaquette(plaquette({ debut: 2 }))).not.toBe(base);
    expect(graineDePlaquette(plaquette({ mots: ["trente"] }))).not.toBe(base);
    expect(graineDePlaquette(plaquette({ nombre: 30 }))).not.toBe(base);
    expect(graineDePlaquette(plaquette({ motIndex: 5 }))).not.toBe(base);
  });
});

describe("nommerPlaquettes", () => {
  it("donne un uid à chaque plaquette, stable d'un appel à l'autre", () => {
    const a = nommerPlaquettes(plan);
    const b = nommerPlaquettes(plan);
    expect(a).toHaveLength(plan.length);
    expect(a.map((p) => p.uid)).toEqual(b.map((p) => p.uid));
    for (const p of a) expect(p.uid).toMatch(/^[0-9a-z]{8}(-\d+)?$/);
  });

  it("retirer une plaquette ne change pas le nom des autres (le nom vient du contenu, pas du rang)", () => {
    const avant = nommerPlaquettes(plan).map((p) => p.uid);
    const sansPremiere = nommerPlaquettes(plan.slice(1)).map((p) => p.uid);
    expect(sansPremiere).toEqual(avant.slice(1));
    const sansDerniere = nommerPlaquettes(plan.slice(0, 2)).map((p) => p.uid);
    expect(sansDerniere).toEqual(avant.slice(0, 2));
  });

  it("ne modifie pas les plaquettes reçues et garde la même référence d'élément", () => {
    const nommees = nommerPlaquettes(plan);
    expect(nommees[1].element).toBe(plan[1]);
    expect("uid" in plan[1]).toBe(false);
  });

  it("deux plaquettes au contenu identique reçoivent des noms distincts", () => {
    const jumelles = [plaquette(), plaquette()];
    const uids = nommerPlaquettes(jumelles).map((p) => p.uid);
    expect(new Set(uids).size).toBe(2);
  });
});

describe("uidDePlaquette", () => {
  it("rend le nom de la plaquette au rang demandé", () => {
    const nommees = nommerPlaquettes(plan);
    for (let i = 0; i < plan.length; i++) {
      expect(uidDePlaquette(plan, i)).toBe(nommees[i].uid);
    }
  });

  it("un index hors liste donne null", () => {
    expect(uidDePlaquette(plan, plan.length)).toBeNull();
    expect(uidDePlaquette(plan, 99)).toBeNull();
    expect(uidDePlaquette(plan, -1)).toBeNull();
    expect(uidDePlaquette([], 0)).toBeNull();
  });

  it("après retrait d'une plaquette, les rangs suivants gardent le même nom", () => {
    const nomAvant = uidDePlaquette(plan, 2);
    const reste = plan.filter((_, i) => i !== 0);
    expect(uidDePlaquette(reste, 1)).toBe(nomAvant);
  });
});
