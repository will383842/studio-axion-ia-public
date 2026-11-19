/** C11-T7-PLANCHE-v19c : planche locale du « mode carte » (3 fonds, 2 formats, 3 groupes, 4 instants). */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { geometrieCarteGroupe, MODE_CARTE_ACTIF, type FondCarte } from "../../src/briques/sous-titres/mode-carte";
import {
  ECHELLE_PLANCHE,
  FORMATS_CARTE,
  GROUPES_CARTE,
  INSTANTS_CARTE,
  PlancheModeCarte,
  VignetteCarte,
} from "../../outils/planche-mode-carte/PlancheModeCarte";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FONDS: FondCarte[] = ["ivoire", "noir", "terracotta"];
const html = () => renderToStaticMarkup(<PlancheModeCarte />);
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}
const geo = (fond: FondCarte, f: number, g: number, t: number) =>
  geometrieCarteGroupe({ mots: GROUPES_CARTE[g].mots.map((mot) => ({ mot })), debutSec: GROUPES_CARTE[g].debutSec, finSec: GROUPES_CARTE[g].finSec, fond }, FORMATS_CARTE[f].largeur, FORMATS_CARTE[f].hauteur, t);
/** Balise ouvrante + corps de la vignette `cle` (jusqu'à la vignette suivante). */
function vignettes(h: string): { cle: string; ouvrante: string; corps: string }[] {
  const trouves = [...h.matchAll(/<div[^>]*data-carte="([^"]+)"[^>]*>/g)];
  return trouves.map((m, i) => ({ cle: m[1], ouvrante: m[0], corps: h.slice(m.index!, trouves[i + 1]?.index ?? h.length) }));
}
const virgule = (n: number) => n.toFixed(2).replace(".", ",");

describe("C11-T7-PLANCHE-v19c planche du mode carte", () => {
  it("a) 72 vignettes ; lignes et opacité = geometrieCarteGroupe", () => {
    const vs = vignettes(html());
    expect(vs).toHaveLength(72);
    for (const fond of FONDS)
      FORMATS_CARTE.forEach((F, f) =>
        GROUPES_CARTE.forEach((_, g) =>
          INSTANTS_CARTE.forEach((t) => {
            const cle = `${fond}-${F.nom}-${g}-${t}`;
            const v = vs.find((x) => x.cle === cle);
            expect(v, cle).toBeDefined();
            const G = geo(fond, f, g, t)!;
            const lignes = [...v!.corps.matchAll(/data-ligne[^>]*>([^<]*)</g)].map((m) => m[1].replaceAll("&#x27;", "'"));
            expect(lignes).toEqual(G.lignes);
            expect(Number(v!.ouvrante.match(/opacity:([0-9.e-]+)/)![1])).toBeCloseTo(G.opacite, 5);
            expect(v!.corps).toContain(`opacité ${virgule(G.opacite)}`);
            expect(v!.ouvrante).toContain(`width:${F.largeur * ECHELLE_PLANCHE}px`);
            expect(v!.ouvrante).toContain(`height:${F.hauteur * ECHELLE_PLANCHE}px`);
          }),
        ),
      );
  });
  it("b) nombre de lignes, opacité 1 à 0,8 s, couleurs de la charte", () => {
    expect(GROUPES_CARTE.map((g) => g.mots.length)).toEqual([1, 4, 9]);
    for (const fond of FONDS)
      GROUPES_CARTE.forEach((_, g) => {
        const G = geo(fond, 0, g, 0.8)!;
        expect(G.opacite).toBe(1);
        if (g === 0) expect(G.lignes).toHaveLength(1);
        else {
          expect(G.lignes.length).toBeGreaterThanOrEqual(2);
          expect(G.lignes.length).toBeLessThanOrEqual(4);
        }
        const attendu = { ivoire: [PALETTE.ivoire, PALETTE.noir], noir: [PALETTE.noir, PALETTE.ivoire], terracotta: [PALETTE.terracotta, PALETTE.blanc] }[fond];
        expect([G.couleurs.fond, G.couleurs.texte]).toEqual(attendu);
        const v = vignettes(html()).find((x) => x.cle === `${fond}-9:16-${g}-0.8`)!;
        expect(v.ouvrante).toContain(`background:${attendu[0]}`);
        expect(v.ouvrante).toContain(`color:${attendu[1]}`);
      });
  });
  it("c) instant hors de [0 ; 1,6] : vignette vide", () => {
    expect(geo("ivoire", 0, 0, 2)).toBeNull();
    const h = renderToStaticMarkup(<VignetteCarte fond="ivoire" format={FORMATS_CARTE[0]} groupe={GROUPES_CARTE[1]} indexGroupe={1} instant={2} />);
    expect(h).toContain('data-vide="1"');
    expect(h).not.toContain("data-ligne");
  });
  it("d) même rendu = même balisage ; aucune image ni lien ; graisse 800 ; en-tête", () => {
    const h = html();
    expect(html()).toBe(h);
    expect(h).not.toMatch(/<img|href=/);
    expect(h).toContain("font-weight:800");
    expect(h).toContain("Manrope");
    expect(h).toContain("Planche d&#x27;attente C11-T7 : rien n&#x27;est branché ; jamais sur un plan où l&#x27;on voit la personne");
  });
  it("e) éteint = identique : interrupteur, aucun importeur de la planche, importeurs de mode-carte inchangés", () => {
    expect(MODE_CARTE_ACTIF).toBe(false);
    const importeurs: string[] = [];
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) {
      const t = lire(f);
      expect(t, f).not.toMatch(/planche-mode-carte|PlancheModeCarte/);
      if (/from\s+["'][^"']*sous-titres\/mode-carte["']|from\s+["']\.\/mode-carte["']/.test(t)) importeurs.push(f);
    }
    expect(importeurs).toEqual(["studio-rendu/compositions/sous-titres/CarteGroupe.tsx"]);
  });
  it("f) gardes statiques", () => {
    for (const f of ["outils/planche-mode-carte/PlancheModeCarte.tsx", "outils/planche-mode-carte/planche.mts"])
      expect(lire(f), f).not.toMatch(/from\s+["']@\/|remotion|studio-rendu\/compositions|useCurrentFrame/);
    expect(lire("outils/planche-mode-carte/PlancheModeCarte.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
