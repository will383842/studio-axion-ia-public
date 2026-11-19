/** C11-T4-v19b : planche d'attente (outil local) de l'apparition au mot et du gabarit « contexte + mot-clé ». */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPARITION_ACTIVE, etatMotApparition, gabaritContexteMotCle } from "../../src/briques/sous-titres/apparition";
import { MOTS_FORTS } from "../../src/briques/sous-titres/typographie";
import { INSTANTS_PLANCHE, PHRASES_PLANCHE, PlancheApparition } from "../../outils/planche-apparition/PlancheApparition";

type Fond = "ivoire" | "noir";
const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FONDS: Fond[] = ["ivoire", "noir"];
const rendre = (fond: Fond) => renderToStaticMarkup(<PlancheApparition fond={fond} />);
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}
/** Instant absolu (s) du k-ième instant relatif du groupe g. */
function instant(g: number, k: number): number {
  const m = PHRASES_PLANCHE[g].mots;
  return INSTANTS_PLANCHE[k](m[0].debut, m[m.length - 1].debut);
}
/** Balise (ouvrante) du mot : attributs lus dans le HTML. */
function balise(h: string, id: string): string {
  const m = h.match(new RegExp(`<[^>]*data-mot="${id}"[^>]*>`));
  if (!m) throw new Error(`mot ${id} absent`);
  return m[0];
}
const style = (b: string, cle: string): string | null => b.match(new RegExp(`${cle}:([^;"]+)`))?.[1] ?? null;

describe("C11-T4-v19b planche d'apparition", () => {
  it("3 groupes de 4 à 6 mots, un mot fort chacun, débuts tous les 0,3 s ; 4 instants", () => {
    expect(PHRASES_PLANCHE).toHaveLength(3);
    for (const p of PHRASES_PLANCHE) {
      expect(p.mots.length).toBeGreaterThanOrEqual(4);
      expect(p.mots.length).toBeLessThanOrEqual(6);
      expect(gabaritContexteMotCle(p)).not.toBeNull();
      expect(p.mots.some((m) => MOTS_FORTS.has(m.mot.toLowerCase()))).toBe(true);
      p.mots.forEach((m, i) => expect(m.debut).toBeCloseTo(i * 0.3, 6));
    }
    expect(INSTANTS_PLANCHE).toHaveLength(4);
  });
  for (const fond of FONDS) {
    it(`${fond} : avant le 1er mot tout est caché ; 1er mot + 0,1 s ; après le dernier mot tout est net`, () => {
      const h = rendre(fond);
      PHRASES_PLANCHE.forEach((p, g) => {
        p.mots.forEach((m, j) => {
          const b0 = balise(h, `${g}-0-${j}`);
          expect(style(b0, "visibility")).toBe("hidden");
          const e1 = etatMotApparition(instant(g, 1), m.debut);
          const b1 = balise(h, `${g}-1-${j}`);
          if (j === 0) {
            expect(e1.opacite).toBeCloseTo(0.5, 5);
            expect(e1.flouPx).toBeCloseTo(3, 5);
            expect(style(b1, "visibility")).toBeNull();
            expect(Number(style(b1, "opacity"))).toBeCloseTo(e1.opacite, 5);
            expect(style(b1, "filter")).toBe(`blur(${e1.flouPx}px)`);
          } else expect(style(b1, "visibility")).toBe("hidden");
          const b3 = balise(h, `${g}-3-${j}`);
          const e3 = etatMotApparition(instant(g, 3), m.debut);
          expect(e3).toEqual({ visible: true, opacite: 1, flouPx: 0 });
          expect(Number(style(b3, "opacity"))).toBe(1);
          expect(style(b3, "filter")).toBeNull();
          expect(style(b3, "visibility")).toBeNull();
        });
      });
    });
    it(`${fond} : le gabarit nomme le bon mot-clé`, () => {
      const h = rendre(fond);
      PHRASES_PLANCHE.forEach((p, g) => {
        const gab = gabaritContexteMotCle(p);
        expect(gab).not.toBeNull();
        const m = h.match(new RegExp(`data-gabarit="${g}"[^>]*>[\\s\\S]*?data-cle="${g}"[^>]*>([^<]*)<`));
        expect(m?.[1]).toBe(p.mots[gab!.cle].mot);
      });
      expect(h).toContain("Planche d&#x27;attente C11-T4 : rien n&#x27;est branché (C11-T4-b)");
      expect(h).toContain("Manrope");
    });
    it(`${fond} : aucune image extérieure, même entrée = même balisage`, () => {
      const h = rendre(fond);
      expect(h).not.toMatch(/<img|<image|href=/);
      expect(rendre(fond)).toBe(h);
    });
  }
  it("éteint = identique : interrupteur éteint, personne n'importe la planche", () => {
    expect(APPARITION_ACTIVE).toBe(false);
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) {
      expect(lire(f), f).not.toMatch(/outils\/planche-apparition|PlancheApparition/);
    }
  });
  it("gardes statiques du composant et du script", () => {
    for (const f of ["outils/planche-apparition/PlancheApparition.tsx", "outils/planche-apparition/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/from\s+["']@\/|@\/services|fournisseurs|remotion|useCurrentFrame/);
    }
    expect(lire("outils/planche-apparition/PlancheApparition.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
