/**
 * Variété IV · issue 124 : les axes ne doivent pas se figer sur un code. Mesure sur un grand nombre de graines (sans historique :
 * le tirage brut), et déterminisme. Les cartes A et B (pas de lien, pas de chiffre) n'ont qu'une variante sur plusieurs axes :
 * on ne les mesure que là où une vraie alternative existe (transitions).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AxeVariete } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { tirerVarieteIV } from "@/moteurs/montage-image-video/variete/tirage";

const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));
const GRAINES = 400;
const AXES_CINQ: AxeVariete[] = ["ouverture", "recit", "chiffres", "camera", "transitions"];

function part(nom: string, axe: AxeVariete) {
  const carte = carteDe(nom);
  const n: Record<string, number> = {};
  for (let i = 0; i < GRAINES; i++) {
    const c = tirerVarieteIV({ graine: `monotone-${nom}-${i}`, carte, format: "9:16" })[axe];
    n[c] = (n[c] ?? 0) + 1;
  }
  return Object.entries(n).map(([code, x]) => ({ code, part: x / GRAINES, nb: Object.keys(n).length }));
}

describe("répartition des codes sur 400 graines", () => {
  for (const nom of ["C", "D", "F"]) {
    for (const axe of ["recit", "chiffres", "camera", "transitions"] as const) {
      it(`carte ${nom} · ${axe} : aucun code au-delà de 40 %`, () => {
        const p = part(nom, axe);
        expect(p.length).toBeGreaterThanOrEqual(3);
        for (const x of p) expect(x.part, x.code).toBeLessThanOrEqual(0.4);
      });
    }
  }
  it("carte D · transitions : la référence TRA-A est tirée, TRA-D n'a plus 60 %", () => {
    const p = part("D", "transitions");
    expect(p.map((x) => x.code).sort()).toEqual(["TRA-A", "TRA-C", "TRA-D"]);
    expect(Math.max(...p.map((x) => x.part))).toBeLessThan(0.4);
  });
  it("carte E · récit, chiffres, caméra ne sont plus figés (au plus 65 % d'un code)", () => {
    for (const axe of ["recit", "chiffres", "camera"] as const) {
      const p = part("E", axe);
      expect(p.length, axe).toBeGreaterThanOrEqual(2);
      expect(Math.max(...p.map((x) => x.part)), axe).toBeLessThanOrEqual(0.65);
    }
  });
  it("cartes A et B · transitions : deux codes, aucun au-delà de 65 %", () => {
    for (const nom of ["A", "B"]) {
      const p = part(nom, "transitions");
      expect(p.length).toBe(2);
      expect(Math.max(...p.map((x) => x.part))).toBeLessThanOrEqual(0.65);
    }
  });
});

describe("sujets différents", () => {
  it("deux graines sur la même carte ont rarement les cinq mêmes axes (moins de 10 %)", () => {
    for (const nom of ["C", "D", "E", "F"]) {
      const carte = carteDe(nom);
      const cles = Array.from({ length: 200 }, (_, i) => {
        const r = tirerVarieteIV({ graine: `sujet-${nom}-${i}`, carte, format: "9:16" });
        return AXES_CINQ.map((a) => r[a]).join("/");
      });
      let paires = 0;
      let egales = 0;
      for (let i = 0; i < cles.length; i++) for (let j = i + 1; j < cles.length; j++) { paires++; if (cles[i] === cles[j]) egales++; }
      expect(egales / paires, nom).toBeLessThan(0.1);
    }
  });
});

describe("déterminisme", () => {
  it("même graine, même carte, même format → même recette, avec ou sans historique", () => {
    for (const nom of ["A", "C", "E"]) {
      const carte = carteDe(nom);
      for (let i = 0; i < 20; i++) {
        const o = { graine: `det-${i}`, carte, format: "9:16" as const };
        const a = tirerVarieteIV(o);
        expect(tirerVarieteIV(o)).toEqual(a);
        expect(tirerVarieteIV({ ...o, historique: [a] })).toEqual(tirerVarieteIV({ ...o, historique: [a] }));
      }
    }
  });
});
