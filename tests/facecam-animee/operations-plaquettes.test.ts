import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "../../src/domaine/facecam-animee/plan";
import { nommerPlaquettes } from "../../src/domaine/facecam-animee/noms-plaquettes";
import { changerTextePlaquette, choisirVariantePlaquette, decalerPlaquette, retirerPlaquette, trouverPlaquette } from "../../src/domaine/facecam-animee/operations-plaquettes";

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

describe("S-15-a-v20l : changer le texte, décaler, variante en données", () => {
  const uidDe = (liste: readonly ElementV4Plan[], i: number) => nommerPlaquettes(liste)[i].uid;

  it("a) changer le texte : un plan NEUF, la plaquette porte les nouveaux mots, les autres sont les mêmes objets", () => {
    const liste = plan();
    Object.freeze(liste);
    const copie = structuredClone(liste);
    const r = changerTextePlaquette(liste, uidDe(liste, 2), ["vite", "mieux"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(liste).toEqual(copie);
    expect(r.elements).not.toBe(liste);
    expect(r.element.mots).toEqual(["vite", "mieux"]);
    expect(r.elements[2]).toBe(r.element);
    expect(r.elements[0]).toBe(liste[0]);
    expect(r.elements[3]).toBe(liste[3]);
    expect(r.uid).toBe(uidDe(r.elements, 2));
    expect(liste[2].mots).toEqual(["vite", "bien"]);
  });

  it("b) texte : plaquette inconnue, plaquette sans texte, mots vides ou trop longs ou trop nombreux : refus en phrase simple, rien ne lève", () => {
    const liste = plan();
    expect(changerTextePlaquette(liste, "zzz", ["a"])).toEqual({ ok: false, raison: "Cette plaquette n'existe plus dans le plan." });
    expect(changerTextePlaquette(liste, uidDe(liste, 0), ["a"])).toEqual({ ok: false, raison: "Cette plaquette n'a pas de texte à changer." });
    for (const mots of [[], [""], ["x".repeat(41)], Array.from({ length: 9 }, () => "a")]) {
      const r = changerTextePlaquette(liste, uidDe(liste, 2), mots);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.raison).toMatch(/^[A-ZÀ-Ý]/);
    }
  });

  it("c) décaler : début et fin glissent du même temps, la durée reste ; avant 0 s ou valeur absurde : refus", () => {
    const liste = plan();
    const r = decalerPlaquette(liste, uidDe(liste, 3), 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.element).toMatchObject({ id: "bulles", debut: 14, fin: 16 });
    expect(liste[3]).toMatchObject({ debut: 12, fin: 14 });
    expect(r.uid).toBe(uidDe(r.elements, 3));
    const avant0 = decalerPlaquette(liste, uidDe(liste, 0), -5);
    expect(avant0.ok).toBe(false);
    for (const d of [Number.NaN, Number.POSITIVE_INFINITY, 0]) expect(decalerPlaquette(liste, uidDe(liste, 0), d).ok).toBe(false);
    expect(decalerPlaquette(liste, "zzz", 1)).toEqual({ ok: false, raison: "Cette plaquette n'existe plus dans le plan." });
  });

  it("c2) décaler : les instants INTERNES (lignes[].a, instants[], verdict.a) suivent du même temps et restent dans [debut, fin]", () => {
    const e: ElementV4Plan = { id: "duel", debut: 12, fin: 14, lignes: [{ texte: "a", a: 12.5 }, { texte: "b", a: 13.5 }], instants: [13], verdict: { gagnant: "A", a: 13.8 } };
    const liste: ElementV4Plan[] = [{ id: "chiffre", debut: 1, fin: 3, nombre: 40 }, e];
    for (const d of [-5, 2, 0.5]) {
      const r = decalerPlaquette(liste, uidDe(liste, 1), d);
      expect(r.ok, String(d)).toBe(true);
      if (!r.ok) continue;
      const n = r.element;
      expect(n.debut).toBeCloseTo(12 + d);
      expect(n.fin).toBeCloseTo(14 + d);
      expect(n.lignes?.map((l) => l.a)).toEqual([12.5 + d, 13.5 + d]);
      expect(n.instants).toEqual([13 + d]);
      expect(n.verdict).toEqual({ gagnant: "A", a: 13.8 + d });
      for (const t of [...(n.lignes ?? []).map((l) => l.a), ...(n.instants ?? []), n.verdict?.a ?? n.debut]) {
        expect(t).toBeGreaterThanOrEqual(n.debut);
        expect(t).toBeLessThanOrEqual(n.fin);
      }
    }
    expect(e.lignes?.map((l) => l.a)).toEqual([12.5, 13.5]);
    expect(e.instants).toEqual([13]);
    expect(e.verdict?.a).toBe(13.8);
  });

  it("d) décaler sur une plaquette identique à une autre : refus (deux noms identiques)", () => {
    const e: ElementV4Plan = { id: "chiffre", debut: 1, fin: 3, nombre: 5 };
    const f: ElementV4Plan = { id: "chiffre", debut: 4, fin: 6, nombre: 5 };
    const liste = [e, f];
    const r = decalerPlaquette(liste, uidDe(liste, 0), 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe("Deux plaquettes identiques : dites laquelle par son moment.");
  });

  it("e) variante : tenue dans une table à part (uid → variante), le plan n'est pas touché", () => {
    const liste = plan();
    const copie = structuredClone(liste);
    const table = Object.freeze({ autre: "b" });
    const r = choisirVariantePlaquette(liste, table, uidDe(liste, 1), "bleue");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.variantes).toEqual({ autre: "b", [uidDe(liste, 1)]: "bleue" });
    expect(r.variantes).not.toBe(table);
    expect(table).toEqual({ autre: "b" });
    expect(liste).toEqual(copie);
    expect(choisirVariantePlaquette(liste, table, "zzz", "bleue")).toEqual({ ok: false, raison: "Cette plaquette n'existe plus dans le plan." });
    for (const v of ["", "Bleue !", "x".repeat(41)]) expect(choisirVariantePlaquette(liste, table, uidDe(liste, 1), v).ok).toBe(false);
  });

  it("f) rien ne lève, même sur une liste vide ; aucune opération n'ajoute de champ au plan", () => {
    expect(() => changerTextePlaquette([], "x", ["a"])).not.toThrow();
    expect(() => decalerPlaquette([], "x", 1)).not.toThrow();
    expect(() => choisirVariantePlaquette([], {}, "x", "a")).not.toThrow();
    const liste = plan();
    const r = decalerPlaquette(liste, uidDe(liste, 3), 1);
    if (r.ok) expect(Object.keys(r.element).sort()).toEqual(Object.keys(liste[3]).sort());
  });
});
