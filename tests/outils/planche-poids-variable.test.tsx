/** BR-POIDS-PLANCHE-v19c : planche d'attente (outil local) du mot qui s'épaissit à 7, 4 et 2 graisses. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { graisseAuTemps } from "../../src/briques/sous-titres/poids-variable";
import { INSTANTS_MOT, PAS_GRAISSE, PHRASES_POIDS, PlanchePoidsVariable, graisseArrondie, imagesEnPlus } from "../../outils/planche-poids-variable/PlanchePoidsVariable";

type Fond = "ivoire" | "noir";
const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FAMILLE = "Famille Essai";
const rendre = (fond: Fond) => renderToStaticMarkup(<PlanchePoidsVariable fond={fond} famille={FAMILLE} />);
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}
function balise(h: string, id: string): string {
  const m = h.match(new RegExp(`<[^>]*data-mot="${id}"[^>]*>`));
  if (!m) throw new Error(`mot ${id} absent`);
  return m[0];
}
const style = (b: string, cle: string): string | null => b.match(new RegExp(`(?:^|[;"\\s])${cle}:([^;"]+)`))?.[1] ?? null;

describe("BR-POIDS-PLANCHE-v19c planche du poids variable", () => {
  it("3 phrases de 4 à 6 mots, un mot < 0,3 s et un > 0,5 s, mots contigus", () => {
    expect(PHRASES_POIDS).toHaveLength(3);
    for (const p of PHRASES_POIDS) {
      expect(p.length).toBeGreaterThanOrEqual(4);
      expect(p.length).toBeLessThanOrEqual(6);
      expect(p.some((m) => m.fin - m.debut < 0.3)).toBe(true);
      expect(p.some((m) => m.fin - m.debut > 0.5)).toBe(true);
      for (let j = 1; j < p.length; j++) expect(p[j].debut).toBeCloseTo(p[j - 1].fin, 6);
    }
  });

  for (const fond of ["ivoire", "noir"] as const) {
    it(`${fond} : graisses par colonne, largeur fixe, 500 avant et 800 après`, () => {
      const h = rendre(fond);
      for (const pas of PAS_GRAISSE) {
        const permises = new Set<number>();
        for (let g = 500; g <= 800; g += pas) permises.add(g);
        PHRASES_POIDS.forEach((p, g) =>
          p.forEach((m, j) => {
            const largeurs = new Set<string | null>();
            INSTANTS_MOT.forEach((_, i) => {
              const b = balise(h, `${g}-${pas}-${i}-${j}`);
              const w = Number(style(b, "font-weight"));
              expect(permises.has(w), `${pas} ${w}`).toBe(true);
              largeurs.add(style(b, "width"));
              if (i === 0) expect(w).toBe(500);
              if (i >= 4) expect(w).toBe(800);
              expect(style(b, "font-family")).toContain(FAMILLE);
            });
            expect(largeurs.size).toBe(1);
            expect([...largeurs][0]).not.toBeNull();
          }),
        );
      }
    });
    it(`${fond} : aucune image extérieure, même entrée = même balisage`, () => {
      const h = rendre(fond);
      expect(h).not.toMatch(/<img|<image|href=/);
      expect(rendre(fond)).toBe(h);
      expect(h).toContain("Planche d&#x27;attente : rien n&#x27;est branché (BR-POIDS-VARIABLE-IV-b)");
    });
  }

  it("images en plus : moins de graisses = pas plus d'images ; pas 300 = 1 par mot de plus de 2 images ; affichage = fonction", () => {
    const n50 = imagesEnPlus(PHRASES_POIDS, 50);
    const n100 = imagesEnPlus(PHRASES_POIDS, 100);
    const n300 = imagesEnPlus(PHRASES_POIDS, 300);
    expect(n100).toBeLessThanOrEqual(n50);
    expect(n300).toBeLessThanOrEqual(n100);
    for (const p of PHRASES_POIDS) {
      for (const m of p) {
        if ((m.fin - m.debut) * 25 > 2) expect(imagesEnPlus([[m]], 300)).toBe(1);
      }
    }
    const h = rendre("ivoire");
    for (const [pas, n] of [[50, n50], [100, n100], [300, n300]] as const) {
      expect(h).toMatch(new RegExp(`data-surcout="${pas}"[^>]*>${n} images en plus<`));
    }
  });

  it("arrondi : même ligne que le palier, 500 avant / 800 après", () => {
    expect(graisseArrondie(0, 1, 2, 100)).toBe(500);
    expect(graisseArrondie(5, 1, 2, 300)).toBe(800);
    expect(graisseArrondie(1.5, 1, 2, 50)).toBe(650);
  });

  it("éteint = identique : personne n'importe la planche, poids-variable intact", () => {
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) {
      expect(lire(f), f).not.toMatch(/planche-poids-variable|PlanchePoidsVariable/);
    }
    expect(graisseAuTemps(1.5, 1, 2)).toBe(650);
  });

  it("gardes statiques des deux fichiers de l'outil", () => {
    for (const f of ["outils/planche-poids-variable/PlanchePoidsVariable.tsx", "outils/planche-poids-variable/planche.mts"]) {
      const s = lire(f);
      expect(s, f).not.toMatch(/from\s+["']@\/|@\/services|fournisseurs|remotion|useCurrentFrame/i);
      expect(s, f).not.toMatch(/studio-rendu\/compositions/);
    }
    expect(lire("outils/planche-poids-variable/PlanchePoidsVariable.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
