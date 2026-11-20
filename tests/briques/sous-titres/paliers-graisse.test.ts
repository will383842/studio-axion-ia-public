/** BR-POIDS-PALIERS-v19c : calcul pur des paliers de graisse du mot dit (rien de branché). */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { graisseAuTemps } from "@/briques/sous-titres/poids-variable";
import {
  DUREE_MIN_PROGRESSION_SEC,
  PALIERS_GRAISSE,
  PLAFOND_SURCOUT,
  changementsDuPlan,
  graisseAuPalier,
  paliersDuMot,
  planDesPaliers,
  type NombrePaliers,
} from "@/briques/sous-titres/paliers-graisse";

const mots = (n: number, duree: number, debut = 0) =>
  Array.from({ length: n }, (_, i) => ({ debutSec: debut + i * duree, finSec: debut + (i + 1) * duree }));

describe("graisseAuPalier", () => {
  it("4 paliers : valeurs permises, 500 avant, 800 après, jamais décroissant", () => {
    let prec = 0;
    for (let k = -50; k <= 300; k++) {
      const t = 1 + k / 100;
      const g = graisseAuPalier(t, 1.5, 2.1, 4);
      expect(PALIERS_GRAISSE as readonly number[]).toContain(g);
      expect(g).toBeGreaterThanOrEqual(prec);
      prec = g;
    }
    expect(graisseAuPalier(0.5, 1, 2, 4)).toBe(500);
    expect(graisseAuPalier(1, 1, 2, 4)).toBe(500);
    expect(graisseAuPalier(2, 1, 2, 4)).toBe(800);
    expect(graisseAuPalier(5, 1, 2, 4)).toBe(800);
  });
  it("2 paliers : 500 ou 800, passage au milieu", () => {
    expect(graisseAuPalier(1.4, 1, 2, 2)).toBe(500);
    expect(graisseAuPalier(1.6, 1, 2, 2)).toBe(800);
    for (let k = 0; k <= 300; k++) expect([500, 800]).toContain(graisseAuPalier(k / 100, 1, 2, 2));
  });
  it("1 palier : 500 partout", () => {
    for (const t of [0, 1, 1.5, 2, 9]) expect(graisseAuPalier(t, 1, 2, 1)).toBe(500);
  });
  it("à 25 images/s sur 0,4 s : 3, 1 et 0 changements", () => {
    const compte = (p: NombrePaliers) => {
      let c = 0;
      let prec = graisseAuPalier(1.0, 1.0, 1.4, p);
      for (let f = 26; f <= 35; f++) {
        const g = graisseAuPalier(f / 25, 1.0, 1.4, p);
        if (g !== prec) c++;
        prec = g;
      }
      return c;
    };
    expect(compte(4)).toBe(3);
    expect(compte(2)).toBe(1);
    expect(compte(1)).toBe(0);
  });
  it("durée nulle : comme graisseAuTemps", () => {
    for (const p of [2, 4] as const) {
      expect(graisseAuPalier(0.9, 1, 1, p)).toBe(500);
      expect(graisseAuPalier(1.1, 1, 1, p)).toBe(800);
      expect(graisseAuPalier(0.9, 1, 0.5, p)).toBe(graisseAuTemps(0.9, 1, 0.5));
    }
  });
});

describe("paliersDuMot", () => {
  it("seuil à 0,3 s", () => {
    expect(DUREE_MIN_PROGRESSION_SEC).toBe(0.3);
    expect(paliersDuMot(0, 0.29)).toBe(1);
    expect(paliersDuMot(0, 0.3)).toBe(4);
    expect(paliersDuMot(1, 1.6)).toBe(4);
  });
});

describe("planDesPaliers", () => {
  it("cas du journal : 101 mots de 0,26 s, tous à 1", () => {
    const plan = planDesPaliers(mots(101, 0.26), 264);
    expect(plan).toHaveLength(101);
    expect(plan.every((p) => p === 1)).toBe(true);
    expect(changementsDuPlan(plan)).toBe(0);
  });
  it("cas mixte : les 40 longs à 4, les courts à 1", () => {
    const m = [...mots(40, 0.26), ...mots(40, 0.45, 20)];
    const plan = planDesPaliers(m, 264);
    expect(plan.slice(0, 40).every((p) => p === 1)).toBe(true);
    expect(plan.slice(40).every((p) => p === 4)).toBe(true);
    expect(changementsDuPlan(plan)).toBe(120);
    expect(changementsDuPlan(plan)).toBeLessThanOrEqual(132);
  });
  it("cas serré : 132 exactement, aucun 4 avant que tous soient à 2", () => {
    const plan = planDesPaliers(mots(100, 0.5), 264);
    expect(changementsDuPlan(plan)).toBe(132);
    expect(plan.every((p) => p >= 2)).toBe(true);
    expect(changementsDuPlan(plan) / 264).toBeLessThanOrEqual(PLAFOND_SURCOUT);
    // budget plus petit que le nombre de mots : certains restent à 1, jamais de 4
    const peu = planDesPaliers(mots(100, 0.5), 100);
    expect(peu.filter((p) => p === 2)).toHaveLength(50);
    expect(peu.includes(4)).toBe(false);
  });
  it("garantie du budget sur des entrées variées", () => {
    for (const base of [0, 1, 7, 50, 264, 1000]) {
      const m = Array.from({ length: 60 }, (_, i) => ({ debutSec: i, finSec: i + 0.1 + ((i * 37) % 11) / 10 }));
      const plan = planDesPaliers(m, base);
      expect(changementsDuPlan(plan)).toBeLessThanOrEqual(Math.floor(base * 0.5));
    }
  });
  it("base 0, NaN, négatif, infini : tous à 1", () => {
    for (const b of [0, Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      expect(planDesPaliers(mots(10, 0.5), b).every((p) => p === 1)).toBe(true);
    }
  });
  it("déterminisme, ordre (plus long d'abord, indice le plus petit à égalité), entrée intacte", () => {
    const m = Object.freeze([
      Object.freeze({ debutSec: 0, finSec: 0.4 }),
      Object.freeze({ debutSec: 1, finSec: 1.8 }),
      Object.freeze({ debutSec: 2, finSec: 2.4 }),
    ]);
    const a = planDesPaliers(m, 4); // budget 2 : le plus long (indice 1) puis l'indice 0 (à égalité avec 2) passent à 2
    expect(a).toEqual([2, 2, 1]);
    expect(planDesPaliers(m, 12)).toEqual([2, 4, 2]); // budget 6 : tous à 2 (3), puis le plus long à 4 (2), reste 1 : plus de 4
    expect(planDesPaliers(m, 4)).toEqual(a);
    const b = planDesPaliers(m, 2); // budget 1 : un seul à 2, le plus long
    expect(b).toEqual([1, 2, 1]);
    const egal = planDesPaliers(mots(3, 0.5), 2); // budget 1 : indice 0 d'abord
    expect(egal).toEqual([2, 1, 1]);
  });
});

describe("éteint = identique", () => {
  const racine = process.cwd();
  const parcourir = (dir: string, sortie: string[] = []): string[] => {
    for (const nom of readdirSync(dir)) {
      if (nom === "node_modules" || nom === ".next" || nom.startsWith(".")) continue;
      const p = join(dir, nom);
      if (statSync(p).isDirectory()) parcourir(p, sortie);
      else if (/\.(ts|tsx|mts|js|mjs)$/.test(nom)) sortie.push(p);
    }
    return sortie;
  };
  it("rien dans src/** ni studio-rendu/** n'importe paliers-graisse", () => {
    const fichiers = [...parcourir(join(racine, "src")), ...parcourir(join(racine, "studio-rendu"))];
    const fautifs = fichiers.filter((f) => !f.endsWith("paliers-graisse.ts") && readFileSync(f, "utf8").includes("paliers-graisse"));
    expect(fautifs).toEqual([]);
  });
  it("poids-variable inchangé et module pur", () => {
    expect(graisseAuTemps(1.5, 1, 2)).toBe(650);
    const src = readFileSync(join(racine, "src/briques/sous-titres/paliers-graisse.ts"), "utf8");
    for (const interdit of ["@/", "Date", "Math.random", "react", "remotion"]) expect(src.includes(interdit)).toBe(false);
  });
});
