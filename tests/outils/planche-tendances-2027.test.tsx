/** X1-17a : planche « tendances 2027 » des pièces X1 déjà fusionnées (outil local). Rien n'est allumé, rien n'est lu. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { couleursMinimalDynamique } from "../../src/briques/sous-titres/minimal-dynamique";
import { FORMATS_PLANCHE, PIECES_X1_PLANCHE, PlancheTendances2027, casesDeLaPlanche } from "../../outils/tendances-2027/PlancheTendances2027";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}

describe("X1-17a planche tendances 2027", () => {
  it("liste les onze pièces X1 fusionnées (X1-14 exclue)", () => {
    expect([...PIECES_X1_PLANCHE]).toEqual(["X1-01", "X1-02", "X1-03", "X1-04", "X1-05", "X1-06", "X1-11", "X1-12", "X1-13", "X1-15", "X1-16"]);
    const ids = new Set(casesDeLaPlanche().map((c) => c.piece));
    for (const p of PIECES_X1_PLANCHE) expect(ids.has(p)).toBe(true);
    expect(ids.has("X1-14" as never)).toBe(false);
  });
  it("X1-02 : groupes de 1 à 3 mots, un seul mot marqué en terracotta, boîte fermée", () => {
    const h = renderToStaticMarkup(createElement(PlancheTendances2027, { format: "16x9" }));
    const case_ = (id: string): string => {
      const debut = h.indexOf(`data-case="${id}"`);
      expect(debut, id).toBeGreaterThanOrEqual(0);
      const suite = h.indexOf("data-case=", debut + 10);
      return h.slice(debut, suite < 0 ? undefined : suite);
    };
    const groupes = case_("x1-02-groupes");
    expect(groupes).toContain("relancer");
    const { fond } = couleursMinimalDynamique();
    expect(groupes.split(fond).length - 1).toBe(1);
    const lignes = [...groupes.matchAll(/data-groupe="([^"]*)"/g)].map((m) => m[1]);
    expect(lignes.length).toBeGreaterThan(1);
    for (const l of lignes) {
      const n = l.split(" ").filter(Boolean).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
    const d = /<path[^>]* d="([^"]+)"/.exec(case_("x1-02-boite"))?.[1] ?? "";
    expect(d.startsWith("M")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
  });
  it("quatre formats", () => {
    expect(Object.keys(FORMATS_PLANCHE)).toEqual(["9x16", "4x5", "1x1", "16x9"]);
  });
  for (const f of Object.keys(FORMATS_PLANCHE) as (keyof typeof FORMATS_PLANCHE)[]) {
    it(`rendu déterministe en ${f}`, () => {
      const a = renderToStaticMarkup(createElement(PlancheTendances2027, { format: f, graine: 7 }));
      const b = renderToStaticMarkup(createElement(PlancheTendances2027, { format: f, graine: 7 }));
      expect(a).toBe(b);
      expect(a.length).toBeGreaterThan(1000);
      expect(a).toContain("Manrope");
    });
    it(`aucune case ne chevauche une autre en ${f}`, () => {
      const c = casesDeLaPlanche(f);
      for (let i = 0; i < c.length; i++) {
        expect(c[i].x).toBeGreaterThanOrEqual(0);
        expect(c[i].y).toBeGreaterThanOrEqual(0);
        expect(c[i].x + c[i].l).toBeLessThanOrEqual(100.0001);
        expect(c[i].y + c[i].h).toBeLessThanOrEqual(100.0001);
        for (let j = i + 1; j < c.length; j++) {
          const sep = c[i].x + c[i].l <= c[j].x || c[j].x + c[j].l <= c[i].x || c[i].y + c[i].h <= c[j].y || c[j].y + c[j].h <= c[i].y;
          expect(sep, `${c[i].id} / ${c[j].id}`).toBe(true);
        }
      }
    });
  }
  it("les cases règles montrent une décision rendue", () => {
    const h = renderToStaticMarkup(createElement(PlancheTendances2027, { format: "16x9" }));
    for (const m of ["boucle", "aperçu", "mot-clé", "flash"]) expect(h.toLowerCase()).toContain(m);
  });
  it("garde : aucun fichier de src/ ni studio-rendu/ n'importe outils/tendances-2027", () => {
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) expect(lire(f), f).not.toMatch(/outils\/tendances-2027|PlancheTendances2027/);
  });
  it("garde statique : aucune lecture de réglage ni de depots, aucune pastille IA", () => {
    for (const f of ["outils/tendances-2027/PlancheTendances2027.tsx", "outils/tendances-2027/planche.mts"]) {
      const s = lire(f);
      expect(s, f).not.toMatch(/reglages|depots|process\.env|fetch\(|mention-ia|MentionIA/i);
    }
  });
  it("le script supprime son entrée temporaire (finally) et reste local", () => {
    const s = lire("outils/tendances-2027/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain('"captures", "tendances-2027"');
  });
});
