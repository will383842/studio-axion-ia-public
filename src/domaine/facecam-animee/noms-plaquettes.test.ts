import { describe, expect, it } from "vitest";
import { graineDePlaquette, nommerPlaquettes, uidDePlaquette } from "./noms-plaquettes";
import type { ElementV4Plan } from "./plan";

const carte: ElementV4Plan = { id: "carte", debut: 1, fin: 3, mots: ["gain", "temps"], nombre: 12, motIndex: 4 };
const barres: ElementV4Plan = { id: "barres", debut: 5, fin: 8, nombre: 40 };
const liste: ElementV4Plan = { id: "liste", debut: 9, fin: 12, mots: ["un", "deux"] };

describe("graineDePlaquette", () => {
  it("assemble type, début, mots, nombre et indice du mot", () => {
    expect(graineDePlaquette(carte)).toBe("carte|1|gain temps|12|4");
  });

  it("laisse vides les champs absents", () => {
    expect(graineDePlaquette({ id: "vide", debut: 2, fin: 4 })).toBe("vide|2|||");
  });
});

describe("nommerPlaquettes", () => {
  it("donne un nom unique à chaque plaquette et garde l'ordre et les éléments reçus", () => {
    const res = nommerPlaquettes([carte, barres, liste]);
    expect(res.map((r) => r.element)).toEqual([carte, barres, liste]);
    expect(new Set(res.map((r) => r.uid)).size).toBe(3);
    for (const r of res) expect(r.uid).toMatch(/\S/);
  });

  it("donne les mêmes noms à deux appels identiques", () => {
    expect(nommerPlaquettes([carte, barres, liste]).map((r) => r.uid)).toEqual(nommerPlaquettes([carte, barres, liste]).map((r) => r.uid));
  });

  it("retirer une plaquette au milieu ne change pas le nom des autres", () => {
    const avant = nommerPlaquettes([carte, barres, liste]);
    const apres = nommerPlaquettes([carte, liste]);
    expect(apres[0].uid).toBe(avant[0].uid);
    expect(apres[1].uid).toBe(avant[2].uid);
  });

  it("retirer la première plaquette ne change pas le nom des suivantes", () => {
    const avant = nommerPlaquettes([carte, barres, liste]);
    const apres = nommerPlaquettes([barres, liste]);
    expect(apres.map((r) => r.uid)).toEqual([avant[1].uid, avant[2].uid]);
  });

  it("ne modifie pas les plaquettes reçues", () => {
    const copie = structuredClone(carte);
    nommerPlaquettes([carte]);
    expect(carte).toEqual(copie);
    expect("uid" in carte).toBe(false);
  });

  it("distingue deux plaquettes de même contenu", () => {
    const res = nommerPlaquettes([barres, { ...barres }]);
    expect(res[0].uid).not.toBe(res[1].uid);
  });

  it("renvoie une liste vide pour aucune plaquette", () => {
    expect(nommerPlaquettes([])).toEqual([]);
  });
});

describe("uidDePlaquette", () => {
  it("renvoie le nom de la plaquette au rang donné", () => {
    const noms = nommerPlaquettes([carte, barres, liste]).map((r) => r.uid);
    expect(uidDePlaquette([carte, barres, liste], 0)).toBe(noms[0]);
    expect(uidDePlaquette([carte, barres, liste], 2)).toBe(noms[2]);
  });

  it("renvoie null pour un rang hors liste", () => {
    expect(uidDePlaquette([carte, barres], 2)).toBeNull();
    expect(uidDePlaquette([carte, barres], -1)).toBeNull();
    expect(uidDePlaquette([], 0)).toBeNull();
  });
});
