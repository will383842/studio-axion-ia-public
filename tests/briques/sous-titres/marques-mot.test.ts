/** C11-T3 : variantes de la plaque d'un mot. Pures, tirées à la graine, éteintes. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { autoriserTexte } from "@/briques/charte/axion-2026";
import {
  MARQUES_MOT, MARQUES_MOT_ACTIF, couleursMarque, geometrieMarque, tirerMarqueMot, type MarqueMot,
} from "@/briques/sous-titres/marques-mot";
import { PAVE_ANIM, geometriePave } from "@/briques/sous-titres/pave";

const boite = { xPx: 100, yPx: 200, largeurPx: 150, hauteurPx: 60 };
const taille = 50;
const T_FIN = PAVE_ANIM.dureeEntreeS + 0.1;

describe("C11-T3 : constantes et tirage", () => {
  it("éteint", () => expect(MARQUES_MOT_ACTIF).toBe(false));
  it("déterministe, 4 marques sur 200 graines, liste vide = null", () => {
    const vues = new Set<MarqueMot>();
    for (let i = 0; i < 200; i++) {
      const m = tirerMarqueMot(`g${i}`);
      expect(tirerMarqueMot(`g${i}`)).toBe(m);
      vues.add(m!);
    }
    expect([...vues].sort()).toEqual([...MARQUES_MOT].sort());
    expect(tirerMarqueMot("x", [])).toBeNull();
    expect(tirerMarqueMot("x", ["evide"])).toBe("evide");
  });
});

const nombres = (d: string): number[] => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const sommets = (d: string): number => (d.match(/[ML]/g) ?? []).length;

describe("C11-T3 : géométrie", () => {
  it("null avant le mot, base recopiée ensuite", () => {
    for (const m of MARQUES_MOT) {
      expect(geometrieMarque(m, geometriePave(boite, taille, -0.01), taille, "a")).toBeNull();
      const base = geometriePave(boite, taille, T_FIN);
      expect(geometrieMarque(m, base, taille, "a")!.base).toEqual(geometriePave(boite, taille, T_FIN));
    }
  });
  it("chemins reproductibles et dans la boîte élargie de 10 %", () => {
    const base = geometriePave(boite, taille, T_FIN)!;
    for (const m of ["pinceau", "papier"] as const) {
      for (let i = 0; i < 50; i++) {
        const g = geometrieMarque(m, base, taille, `s${i}`)!;
        expect(geometrieMarque(m, base, taille, `s${i}`)!.chemin).toBe(g.chemin);
        const n = nombres(g.chemin!);
        const xs = n.filter((_, k) => k % 2 === 0);
        const ys = n.filter((_, k) => k % 2 === 1);
        const mx = 0.05 * base.largeur + 0.02;
        const my = 0.05 * base.hauteur + 0.02;
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(base.x - mx);
        expect(Math.max(...xs)).toBeLessThanOrEqual(base.x + base.largeur + mx);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(base.y - my);
        expect(Math.max(...ys)).toBeLessThanOrEqual(base.y + base.hauteur + my);
      }
    }
  });
  it("papier : 6 à 14 dents (2 sommets par dent)", () => {
    const base = geometriePave(boite, taille, T_FIN)!;
    const vues = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const s = sommets(geometrieMarque("papier", base, taille, `p${i}`)!.chemin!);
      expect(s % 2).toBe(0);
      expect(s / 2).toBeGreaterThanOrEqual(6);
      expect(s / 2).toBeLessThanOrEqual(14);
      vues.add(s / 2);
    }
    expect(vues.size).toBeGreaterThan(1);
  });
  it("chevauche dans les bornes, évidé en contour seul", () => {
    const base = geometriePave(boite, taille, T_FIN)!;
    for (let i = 0; i < 100; i++) {
      const d = geometrieMarque("chevauche", base, taille, `c${i}`)!.decalageYPx!;
      expect(d).toBeGreaterThanOrEqual(-0.35 * taille - 0.01);
      expect(d).toBeLessThanOrEqual(-0.2 * taille + 0.01);
    }
    expect(geometrieMarque("evide", base, taille, "e")!.contourSeul).toBe(true);
  });
  it("nombres arrondis à 0,01", () => {
    const base = geometriePave(boite, taille, T_FIN)!;
    for (const m of ["pinceau", "papier"] as const)
      for (const n of nombres(geometrieMarque(m, base, taille, "r")!.chemin!)) expect(Math.abs(n * 100 - Math.round(n * 100))).toBeLessThan(1e-6);
  });
});

describe("C11-T3 : couleurs", () => {
  it("chaque paire passe autoriserTexte", () => {
    for (const m of MARQUES_MOT) for (const t of ["terracotta", "ivoire"] as const) {
      const c = couleursMarque(m, t);
      expect(autoriserTexte(c.texte, c.fond)).toBe(true);
    }
  });
});

const sources = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (n === "node_modules") return [];
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe("C11-T3 : gardes statiques", () => {
  const pur = readFileSync("src/briques/sous-titres/marques-mot.ts", "utf8");
  const piece = readFileSync("studio-rendu/compositions/sous-titres/MarqueMot.tsx", "utf8");
  it("marques-mot.ts pur", () => {
    expect(pur).not.toMatch(/from\s+["']@\//);
    expect(pur).not.toMatch(/from\s+["'](react|remotion)/);
    expect(pur).not.toMatch(/Math\.random|Date/);
  });
  it("MarqueMot.tsx sans couleur écrite en dur", () => {
    expect(piece).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(piece).not.toMatch(/rgba?\(/);
  });
  it("personne n'importe marques-mot ni MarqueMot", () => {
    const fichiers = [...sources("src"), ...sources("studio-rendu")].filter(
      (f) => !f.endsWith("marques-mot.ts") && !f.endsWith("MarqueMot.tsx"),
    );
    for (const f of fichiers) expect(readFileSync(f, "utf8"), f).not.toMatch(/marques-mot|MarqueMot/);
  });
});
