import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { schemaElementV4, type ElementV4Plan } from "../../src/domaine/facecam-animee/plan";
import { graineDePlaquette, nommerPlaquettes, uidDePlaquette } from "../../src/domaine/facecam-animee/noms-plaquettes";

function plan(): ElementV4Plan[] {
  return [
    { id: "chiffre", debut: 1, fin: 3, nombre: 40 },
    { id: "chiffre", debut: 5, fin: 7, nombre: 12 },
    { id: "mots", debut: 8, fin: 10, mots: ["vite", "bien"], motIndex: 4 },
    { id: "bulles", debut: 12, fin: 14 },
  ];
}

describe("noms de plaquettes (S-15-v19b)", () => {
  it("a) 4 plaquettes, dont 2 de même id : 4 noms distincts", () => {
    const noms = nommerPlaquettes(plan()).map((n) => n.uid);
    expect(new Set(noms).size).toBe(4);
    for (const u of noms) expect(u).toMatch(/^[0-9a-z]{8}(-\d+)?$/);
  });
  it("b) retirer la 2e : les 3 autres gardent exactement leur nom", () => {
    const avant = nommerPlaquettes(plan()).map((n) => n.uid);
    const reste = plan().filter((_, i) => i !== 1);
    const apres = nommerPlaquettes(reste).map((n) => n.uid);
    expect(apres).toEqual([avant[0], avant[2], avant[3]]);
  });
  it("c) même plan relu deux fois : mêmes noms", () => {
    expect(nommerPlaquettes(plan()).map((n) => n.uid)).toEqual(nommerPlaquettes(plan()).map((n) => n.uid));
  });
  it("d) le plan passe schemaElementV4 à l'identique et la liste reçue ne bouge pas", () => {
    const liste = plan();
    const copie = structuredClone(liste);
    const sortie = nommerPlaquettes(liste);
    expect(liste).toEqual(copie);
    for (const { element } of sortie) {
      expect(Object.keys(element)).not.toContain("uid");
      expect(schemaElementV4.parse(element)).toEqual(element);
    }
  });
  it("graine : sans rang, avec id, début, mots, nombre, motIndex", () => {
    expect(graineDePlaquette({ id: "mots", debut: 8, fin: 10, mots: ["vite", "bien"], motIndex: 4 })).toBe("mots|8|vite bien||4");
    expect(graineDePlaquette({ id: "chiffre", debut: 1, fin: 3, nombre: 40 })).toBe("chiffre|1||40|");
  });
  it("deux plaquettes identiques reçoivent un suffixe -2", () => {
    const e: ElementV4Plan = { id: "chiffre", debut: 1, fin: 3, nombre: 5 };
    const [a, b] = nommerPlaquettes([e, { ...e }]);
    expect(b.uid).toBe(`${a.uid}-2`);
  });
  it("uidDePlaquette : nom par rang, null hors liste", () => {
    const liste = plan();
    expect(uidDePlaquette(liste, 2)).toBe(nommerPlaquettes(liste)[2].uid);
    expect(uidDePlaquette(liste, 9)).toBeNull();
    expect(uidDePlaquette(liste, -1)).toBeNull();
  });
  it("e) seules les pièces pures du domaine (operations-plaquettes, appliquer-plaquettes) importent noms-plaquettes", () => {
    const trouves: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(ts|tsx)$/.test(f) && f !== "noms-plaquettes.ts" && ![ "operations-plaquettes.ts", "appliquer-plaquettes.ts" ].some((n) => p.split("\\").join("/") === join(process.cwd(), "src", "domaine", "facecam-animee", n).split("\\").join("/")) && /noms-plaquettes/.test(readFileSync(p, "utf8"))) trouves.push(p);
      }
    };
    marche(join(process.cwd(), "src"));
    expect(trouves).toEqual([]);
  });
});
