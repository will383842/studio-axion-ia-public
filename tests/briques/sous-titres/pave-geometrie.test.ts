/** C2-U7b : géométrie du pavé, instants d'animation, pièce MotPave non branchée. Aucune voix. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAVE, PAVE_ANIM, PAVE_ANIME_ACTIF, geometriePave, instantsPaves } from "@/briques/sous-titres/pave";

const boite = { xPx: 100, yPx: 200, largeurPx: 150, hauteurPx: 60 };
const taille = 50;

const sources = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (n === "node_modules") return [];
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe("C2-U7b : valeurs figées", () => {
  it("éteint par défaut, PAVE inchangé", () => {
    expect(PAVE_ANIME_ACTIF).toBe(false);
    expect(PAVE).toEqual({ margeXEm: 0.18, margeYEm: 0.04, rayonEm: 0.16 });
    expect(Math.abs(PAVE_ANIM.inclinaisonDeg)).toBeLessThanOrEqual(4);
  });
});

describe("C2-U7b : geometriePave", () => {
  it("rien avant le mot", () => {
    expect(geometriePave(boite, taille, -0.01)).toBeNull();
  });
  it("après l'entrée : état final", () => {
    const g = geometriePave(boite, taille, PAVE_ANIM.dureeEntreeS)!;
    expect(g.echelle).toBe(1);
    expect(g.opacite).toBe(1);
    expect(g.largeur).toBeCloseTo(150 + 2 * 0.18 * 50);
    expect(g.hauteur).toBeCloseTo(60 + 2 * 0.04 * 50);
    expect(g.x).toBeCloseTo(100 - 0.18 * 50);
    expect(g.y).toBeCloseTo(200 - 0.04 * 50);
    expect(g.rayon).toBeCloseTo(0.16 * 50);
    expect(Math.abs(g.inclinaisonDeg)).toBeLessThanOrEqual(4);
    expect(geometriePave(boite, taille, 5)).toEqual(g);
  });
  it("à mi-entrée : strictement entre départ et fin", () => {
    const g = geometriePave(boite, taille, PAVE_ANIM.dureeEntreeS / 2)!;
    expect(g.echelle).toBeGreaterThan(PAVE_ANIM.echelleDepart);
    expect(g.echelle).toBeLessThan(1);
    expect(g.opacite).toBeGreaterThan(0);
    expect(g.opacite).toBeLessThan(1);
  });
  it("au début du mot : départ", () => {
    const g = geometriePave(boite, taille, 0)!;
    expect(g.echelle).toBeCloseTo(PAVE_ANIM.echelleDepart);
    expect(g.opacite).toBe(0);
  });
});

describe("C2-U7b : instantsPaves", () => {
  it("vide pour aucun pavé", () => expect(instantsPaves([], 30)).toEqual([]));
  it("trié, sans doublon, dans la fenêtre", () => {
    const r = instantsPaves([{ debutS: 2 }, { debutS: 1 }, { debutS: 1 }], 30);
    expect(r).toEqual([...new Set(r)].sort((a, b) => a - b));
    expect(r.length).toBeGreaterThan(0);
    // borne basse stricte (jamais avant le mot) ; borne haute : première image ≥ debutS + dureeEntreeS (au plus une image au-delà)
    for (const t of r) {
      const ok = [1, 2].some((d) => t >= d - 1e-6 && t <= d + PAVE_ANIM.dureeEntreeS + 1 / 30 + 1e-6);
      expect(ok).toBe(true);
    }
    expect(Math.min(...r)).toBeCloseTo(1);
  });
});

describe("C2-U7b : instantsPaves, état final et début", () => {
  for (const debutS of [1, 1.01]) {
    it(`debutS=${debutS} à 30 i/s : premier instant ≥ debutS, dernier = état final`, () => {
      const r = instantsPaves([{ debutS }], 30);
      expect(r[0]).toBeGreaterThanOrEqual(debutS - 1e-6);
      const dernier = r[r.length - 1]!;
      const g = geometriePave(boite, taille, dernier - debutS)!;
      expect(g.opacite).toBe(1);
      expect(g.echelle).toBe(1);
      expect(dernier).toBeLessThanOrEqual(debutS + PAVE_ANIM.dureeEntreeS + 1 / 30 + 1e-6);
    });
  }
});

describe("C2-U7b : gardes statiques", () => {
  const pave = readFileSync("src/briques/sous-titres/pave.ts", "utf8");
  it("pave.ts pur", () => {
    expect(pave).not.toMatch(/from\s+["']@\//);
    expect(pave).not.toMatch(/from\s+["'](react|remotion)/);
  });
  it("seuls CalqueSousTitres.tsx et texte-instants.ts citent geometriePave ; personne n'importe MotPave ni instantsPaves", () => {
    // BR-PAVE-MARQUES-a 18/11 (voulue, seconde lecture du pilote) : le branchement cite `geometriePave` à EXACTEMENT 2 endroits.
    // Garde aussi stricte : égalité exacte de la liste, et aucun de ces fichiers ne cite `MotPave` ni `instantsPaves`.
    const fichiers = [...sources("src"), ...sources("studio-rendu")].filter(
      (f) => !f.endsWith("pave.ts") && !f.endsWith("MotPave.tsx") && !f.includes(`${"studio-rendu"}/node_modules`),
    );
    const citeurs = fichiers.filter((f) => /MotPave|geometriePave|instantsPaves/.test(readFileSync(f, "utf8"))).map((f) => f.replace(/\\/g, "/")).sort();
    expect(citeurs).toEqual(["studio-rendu/compositions/sous-titres/CalqueSousTitres.tsx", "studio-rendu/src/composition/texte-instants.ts"]);
    for (const f of citeurs) expect(readFileSync(f, "utf8"), f).not.toMatch(/MotPave|instantsPaves/);
  });
  it("MotPave.tsx sans couleur écrite en dur", () => {
    const s = readFileSync("studio-rendu/compositions/sous-titres/MotPave.tsx", "utf8");
    expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(s).not.toMatch(/rgba?\(/);
  });
});
