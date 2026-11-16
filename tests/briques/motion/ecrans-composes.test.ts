/** C11-E4 — géométries et gardes des six écrans composés (pièces neuves, non branchées). */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  diapoAuTemps,
  ECRANS_COMPOSES_ACTIFS,
  entreeEcranCompose,
  geometrieDuel,
  geometrieEcranHaut,
  geometrieFil,
  geometrieMacro,
  geometrieTablette,
  geometrieTelephoneRecadre,
} from "../../../src/briques/motion/ecrans-couverture/ecrans-composes";
import { MARQUES_INTERDITES } from "../../../src/briques/motion/ecrans-couverture/textes-generiques";

type R = { x: number; y: number; w: number; h: number };
const CADRES: [number, number][] = [[1080, 1920], [1080, 1350]];
const tient = (r: R, L: number, H: number) => r.x >= 0.06 * L - 1e-6 && r.y >= 0.06 * H - 1e-6 && r.x + r.w <= 0.94 * L + 1e-6 && r.y + r.h <= 0.94 * H + 1e-6;

describe("C11-E4 · géométries", () => {
  it("éteint par défaut", () => expect(ECRANS_COMPOSES_ACTIFS).toBe(false));

  it("écran en haut / intervenant en bas : dans la zone sûre, sans chevauchement", () => {
    for (const [L, H] of CADRES) {
      const g = geometrieEcranHaut({ largeur: L, hauteur: H });
      expect(tient(g.ecran, L, H) && tient(g.intervenant, L, H)).toBe(true);
      expect(g.ecran.y + g.ecran.h).toBeLessThanOrEqual(g.intervenant.y + 1e-6);
      expect(g.ecran.y).toBeLessThan(g.intervenant.y);
      expect(g.separation).toBeGreaterThan(0);
      expect(geometrieEcranHaut({ largeur: L, hauteur: H, partEcran: 9 }).ecran.h).toBeLessThan(H);
    }
  });

  it("téléphone : 9:16, centré, dans la zone sûre", () => {
    for (const [L, H] of CADRES) {
      const g = geometrieTelephoneRecadre({ largeur: L, hauteur: H });
      expect(Math.abs(g.cadre.w / g.cadre.h - 9 / 16)).toBeLessThan(1e-6);
      expect(tient(g.cadre, L, H)).toBe(true);
      expect(g.cadre.x + g.cadre.w / 2).toBeCloseTo(L / 2, 5);
      expect(g.video.w).toBeLessThan(g.cadre.w);
      expect(tient(geometrieTelephoneRecadre({ largeur: L, hauteur: H, echelle: 5 }).cadre, L, H)).toBe(true);
    }
  });

  it("macro : zoom borné, foyer borné, flou borné", () => {
    for (const f of [{ x: 0.5, y: 0.5 }, { x: -3, y: 9 }, { x: NaN, y: Infinity }]) {
      const g = geometrieMacro({ largeur: 1080, hauteur: 1920, foyer: f });
      expect(g.zoom).toBeGreaterThanOrEqual(1.6);
      expect(g.zoom).toBeLessThanOrEqual(2.4);
      expect(g.flouMaxPx).toBeLessThanOrEqual(14);
      expect(g.origine.x).toBeGreaterThanOrEqual(0);
      expect(g.origine.x).toBeLessThanOrEqual(1080);
      expect(g.origine.y).toBeGreaterThanOrEqual(0);
      expect(g.origine.y).toBeLessThanOrEqual(1920);
    }
  });

  it("diapo au temps", () => {
    const i = [1, 2.5, 4];
    expect(diapoAuTemps(i, 0)).toBe(-1);
    expect(diapoAuTemps(i, 1)).toBe(0);
    expect(diapoAuTemps(i, 2.4)).toBe(0);
    expect(diapoAuTemps(i, 2.5)).toBe(1);
    expect(diapoAuTemps(i, 99)).toBe(2);
    expect(diapoAuTemps([], 5)).toBe(-1);
    expect(diapoAuTemps([3, 1, 2], 5)).toBe(-1);
  });

  it("tablette : paysage, dans la zone sûre", () => {
    for (const [L, H] of CADRES) {
      const g = geometrieTablette({ largeur: L, hauteur: H });
      expect(g.cadre.w).toBeGreaterThan(g.cadre.h);
      expect(tient(g.cadre, L, H)).toBe(true);
    }
    expect(tient(geometrieTablette({ largeur: 1920, hauteur: 1080 }).cadre, 1920, 1080)).toBe(true);
  });

  it("duel : colonnes identiques, au plus 4 critères", () => {
    for (const [L, H] of CADRES) {
      for (const n of [0, 1, 4, 9]) {
        const g = geometrieDuel({ largeur: L, hauteur: H, criteres: n });
        const [a, b] = g.colonnes;
        expect(a.w).toBe(b.w);
        expect(a.h).toBe(b.h);
        expect(g.lignes.length).toBe(Math.min(n, 4));
        expect(tient(a, L, H) && tient(b, L, H)).toBe(true);
        expect(a.x + a.w).toBeLessThanOrEqual(b.x);
        for (const l of g.lignes) expect(l.gauche.w).toBe(l.droite.w);
      }
    }
  });

  it("fil : au plus 6 cartes, défilement monotone vers le haut", () => {
    expect(geometrieFil({ largeur: 1080, hauteur: 1920, cartes: 20, t: 0 }).cartes).toHaveLength(6);
    let prec = Infinity;
    for (const t of [0, 1, 2, 3.5, 8]) {
      const g = geometrieFil({ largeur: 1080, hauteur: 1920, cartes: 4, t });
      expect(g.cartes[0].y).toBeLessThanOrEqual(prec);
      prec = g.cartes[0].y;
      expect(tient(g.zone, 1080, 1920)).toBe(true);
      for (const c of g.cartes) expect(c.x >= g.zone.x - 1e-6 && c.x + c.w <= g.zone.x + g.zone.w + 1e-6).toBe(true);
    }
    const a = geometrieFil({ largeur: 1080, hauteur: 1920, cartes: 3, t: 1 }).cartes[0].y;
    const b = geometrieFil({ largeur: 1080, hauteur: 1920, cartes: 3, t: 2 }).cartes[0].y;
    const c = geometrieFil({ largeur: 1080, hauteur: 1920, cartes: 3, t: 3 }).cartes[0].y;
    expect(a - b).toBeCloseTo(b - c, 6);
  });

  it("entrée : 0 avant, 1 après, monotone", () => {
    expect(entreeEcranCompose(0, 1).opacite).toBe(0);
    expect(entreeEcranCompose(5, 1).opacite).toBe(1);
    expect(entreeEcranCompose(5, 1).echelle).toBe(1);
    let p = -1;
    for (let t = 0.9; t < 2; t += 0.05) { const o = entreeEcranCompose(t, 1).opacite; expect(o).toBeGreaterThanOrEqual(p); p = o; }
  });

  it("déterministe", () => {
    const a = [geometrieEcranHaut({ largeur: 1080, hauteur: 1920 }), geometrieDuel({ largeur: 1080, hauteur: 1920, criteres: 3 }), geometrieFil({ largeur: 1080, hauteur: 1920, cartes: 3, t: 1.3 })];
    const b = [geometrieEcranHaut({ largeur: 1080, hauteur: 1920 }), geometrieDuel({ largeur: 1080, hauteur: 1920, criteres: 3 }), geometrieFil({ largeur: 1080, hauteur: 1920, cartes: 3, t: 1.3 })];
    expect(a).toEqual(b);
  });
});

const DOSSIER_PIECES = join(__dirname, "../../../studio-rendu/compositions/commune/ecrans-couverture");
const PIECES = ["EcranHaut", "TelephoneRecadre", "MacroInterface", "TabletteDiaporama", "Duel", "FilSocialGenerique"];
const src = (p: string) => readFileSync(join(DOSSIER_PIECES, `${p}.tsx`), "utf8");

describe("C11-E4 · gardes des six pièces", () => {
  it("fichiers présents, éteints par défaut, sans alias, sans bézier, sans son", () => {
    for (const p of PIECES) {
      const s = src(p);
      expect(s).toMatch(/_ACTIVE = false/);
      expect(s).not.toMatch(/from\s+["']@\//);
      expect(s).not.toContain("cubic-bezier(");
      expect(s).not.toContain("Easing.bezier(");
      expect(s).not.toMatch(/<Audio/);
      expect(s).not.toMatch(/volume\s*[=:]\s*\{?\s*[1-9.]/);
      const nb = (s.match(/<OffthreadVideo/g) ?? []).length;
      const muets = (s.match(/<OffthreadVideo[^>]*\bmuted\b/g) ?? []).length;
      expect(muets).toBe(nb);
    }
  });

  it("aucun mot d'interface de réseau, aucun nom de marque dans le code", () => {
    for (const p of PIECES) {
      const s = src(p).toLowerCase();
      for (const m of ["avatar", "like", "abonn", "partag", "coeur", "heart", "verified", "encoche", "notch"]) expect(s).not.toContain(m);
      for (const m of MARQUES_INTERDITES) expect(new RegExp(`(^|[^a-z0-9])${m}($|[^a-z0-9])`).test(s)).toBe(false);
    }
  });

  it("la macro n'accepte qu'une image et les pièces n'ont pas de filtre sur une vidéo de personne", () => {
    expect(src("MacroInterface")).not.toContain("OffthreadVideo");
    for (const p of ["EcranHaut", "TelephoneRecadre"]) expect(src(p)).not.toMatch(/filter|backdropFilter|mask/);
  });

  it("aucun fichier de src/ ni de studio-rendu/ n'importe une des six pièces", () => {
    const racine = join(__dirname, "../../..");
    const parcourir = (d: string, sortie: string[] = []): string[] => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        const c = join(d, e.name);
        if (e.isDirectory()) parcourir(c, sortie);
        else if (/\.(tsx?|mts|js|mjs)$/.test(e.name)) sortie.push(c);
      }
      return sortie;
    };
    for (const f of [...parcourir(join(racine, "src")), ...parcourir(join(racine, "studio-rendu"))]) {
      if (f.startsWith(DOSSIER_PIECES) || f.includes("ecrans-composes")) continue;
      const s = readFileSync(f, "utf8");
      for (const p of PIECES) expect(s, `${f} importe ${p}`).not.toMatch(new RegExp(`from\\s+["'][^"']*/${p}["']`));
    }
  });
});
