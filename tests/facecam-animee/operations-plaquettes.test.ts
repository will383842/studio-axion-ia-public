import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "../../src/domaine/facecam-animee/plan";
import { nommerPlaquettes } from "../../src/domaine/facecam-animee/noms-plaquettes";
import { retirerPlaquette, trouverPlaquette } from "../../src/domaine/facecam-animee/operations-plaquettes";

function plan(): ElementV4Plan[] {
  return [
    { id: "chiffre", debut: 1, fin: 3, nombre: 40 },
    { id: "chiffre", debut: 5, fin: 7, nombre: 12 },
    { id: "mots", debut: 8, fin: 10, mots: ["vite", "bien"], motIndex: 4 },
    { id: "bulles", debut: 12, fin: 14 },
  ];
}

describe("opérations sur les plaquettes (S-15-OPERATIONS-v19c)", () => {
  it("a) trouverPlaquette : le nom du 3e donne l'index 2 ; nom inconnu : null", () => {
    const liste = plan();
    const uid = nommerPlaquettes(liste)[2].uid;
    const r = trouverPlaquette(liste, uid);
    expect(r?.index).toBe(2);
    expect(r?.element).toBe(liste[2]);
    expect(trouverPlaquette(liste, "inconnu")).toBeNull();
  });

  it("b) retirer la 2e : un de moins, les autres sont les mêmes objets, noms inchangés", () => {
    const liste = plan();
    const noms = nommerPlaquettes(liste).map((n) => n.uid);
    const r = retirerPlaquette(liste, noms[1]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.elements).toHaveLength(3);
    expect(r.retiree).toBe(liste[1]);
    expect(r.elements[0]).toBe(liste[0]);
    expect(r.elements[1]).toBe(liste[2]);
    expect(r.elements[2]).toBe(liste[3]);
    expect(nommerPlaquettes(r.elements).map((n) => n.uid)).toEqual([noms[0], noms[2], noms[3]]);
  });

  it("c) nom inconnu : refus avec la phrase exacte", () => {
    expect(retirerPlaquette(plan(), "zzz")).toEqual({ ok: false, raison: "Cette plaquette n'existe plus dans le plan." });
  });

  it("d) deux plaquettes identiques : retirer la 1re refusé, retirer la 2e (-2) accepté", () => {
    const e: ElementV4Plan = { id: "chiffre", debut: 1, fin: 3, nombre: 5 };
    const liste: ElementV4Plan[] = [e, { ...e }];
    const [a, b] = nommerPlaquettes(liste);
    expect(retirerPlaquette(liste, a.uid)).toEqual({ ok: false, raison: "Deux plaquettes identiques : dites laquelle par son moment." });
    const r = retirerPlaquette(liste, b.uid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.elements).toEqual([e]);
  });

  it("e) la liste reçue n'est jamais modifiée", () => {
    const liste = plan();
    const copie = structuredClone(liste);
    const noms = nommerPlaquettes(liste).map((n) => n.uid);
    Object.freeze(liste);
    expect(() => retirerPlaquette(liste, noms[0])).not.toThrow();
    expect(() => retirerPlaquette(liste, "zzz")).not.toThrow();
    expect(() => trouverPlaquette(liste, noms[0])).not.toThrow();
    expect(liste).toEqual(copie);
  });

  it("f) éteint = identique : aucun fichier de src n'importe operations-plaquettes", () => {
    const trouves: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(ts|tsx)$/.test(f) && f !== "operations-plaquettes.ts" && /operations-plaquettes/.test(readFileSync(p, "utf8"))) trouves.push(p);
      }
    };
    marche(join(process.cwd(), "src"));
    expect(trouves).toEqual([]);
  });
});
