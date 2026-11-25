/** C11-T2-PLANCHE-v19c : planche d'attente (outil local) des sous-titres sélectifs. */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { filtrerSelectif, SELECTIF_ACTIF } from "../../src/briques/sous-titres/selectif";
import { colonnesSelectif, GROUPES_SELECTIF, MOTS_CLES_SELECTIF, PlancheSelectif } from "../../outils/planche-selectif/PlancheSelectif";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FONDS = ["ivoire", "noir"] as const;
const rendre = (fond: (typeof FONDS)[number]) => renderToStaticMarkup(<PlancheSelectif fond={fond} />);
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}
const attr = (s: string, n: string): string | null => s.match(new RegExp(`(?:^|[\\s<])${n}="([^"]*)"`))?.[1] ?? null;
/** Blocs data-groupe d'une colonne (« tous » ou « gardes »). */
function blocs(h: string, colonne: "tous" | "gardes"): { id: string; debut: number; fin: number; html: string }[] {
  const d = h.indexOf(`data-colonne="${colonne}"`);
  const f = colonne === "tous" ? h.indexOf('data-colonne="gardes"') : h.length;
  const zone = h.slice(d, f);
  return zone.split('data-groupe="').slice(1).map((morceau) => {
    const html = `data-groupe="${morceau}`;
    return { id: attr(html, "data-groupe")!, debut: Number(attr(html, "data-debut")), fin: Number(attr(html, "data-fin")), html };
  });
}
const virgule = (n: number) => n.toFixed(1).replace(".", ",");
const motsDe = (id: string) => GROUPES_SELECTIF.find((g) => g.id === id)!.mots.map((m) => m.mot);

describe("C11-T2-PLANCHE-v19c planche des sous-titres sélectifs", () => {
  it("8 groupes contigus de 3 à 5 mots, minutage croissant", () => {
    expect(GROUPES_SELECTIF).toHaveLength(8);
    GROUPES_SELECTIF.forEach((g, i) => {
      expect(g.mots.length).toBeGreaterThanOrEqual(3);
      expect(g.mots.length).toBeLessThanOrEqual(5);
      expect(g.finSec).toBeGreaterThan(g.debutSec);
      if (i > 0) expect(g.debutSec).toBeCloseTo(GROUPES_SELECTIF[i - 1].finSec, 6);
    });
  });
  for (const fond of FONDS) {
    it(`${fond} : 8 groupes à gauche, 8 à droite, mêmes id et mêmes heures`, () => {
      const h = rendre(fond);
      const g = blocs(h, "tous");
      const d = blocs(h, "gardes");
      expect(g).toHaveLength(8);
      expect(d).toHaveLength(8);
      g.forEach((b, i) => {
        expect(d[i].id).toBe(b.id);
        expect(d[i].debut).toBe(b.debut);
        expect(d[i].fin).toBe(b.fin);
        expect(b.debut).toBe(GROUPES_SELECTIF[i].debutSec);
        expect(b.fin).toBe(GROUPES_SELECTIF[i].finSec);
        for (const x of [b, d[i]]) expect(x.html).toContain(`${virgule(b.debut)} – ${virgule(b.fin)} s`);
      });
    });
    it(`${fond} : les groupes masqués à droite sont ceux que filtrerSelectif vide ; limites connues visibles`, () => {
      const h = rendre(fond);
      const rendus = filtrerSelectif(GROUPES_SELECTIF, MOTS_CLES_SELECTIF, true);
      const d = blocs(h, "gardes");
      const g = blocs(h, "tous");
      rendus.forEach((r, i) => {
        const masque = r.mots.length === 0;
        expect(attr(d[i].html, "data-masque") === "1", r.id).toBe(masque);
        if (masque) expect(d[i].html).toContain("sans texte à l&#x27;écran");
        else for (const m of r.mots) expect(d[i].html).toContain(m.mot);
        expect(attr(g[i].html, "data-masque")).toBeNull();
        for (const m of GROUPES_SELECTIF[i].mots) expect(g[i].html).toContain(m.mot);
      });
      const idDe = (mot: string) => GROUPES_SELECTIF.find((x) => x.mots.some((m) => m.mot === mot))!.id;
      const masqueDe = (id: string) => rendus.find((r) => r.id === id)!.mots.length === 0;
      expect(masqueDe(idDe("fiscal"))).toBe(true); // « droit fiscal » n'est jamais trouvé
      expect(masqueDe(idDe("neuf"))).toBe(false); // « neuf » adjectif compte comme nombre
      expect(masqueDe(idDe("30"))).toBe(false);
      expect(masqueDe(idDe("trois"))).toBe(false);
      expect(MOTS_CLES_SELECTIF).toContain("droit fiscal");
      expect(rendus.filter((r) => r.mots.length === 0).length).toBeGreaterThanOrEqual(4);
      expect(motsDe(idDe("fiscal"))).toContain("droit");
    });
    it(`${fond} : le bilan égale le nombre de groupes non vides`, () => {
      const h = rendre(fond);
      const n = colonnesSelectif().gardes.filter((x) => x.mots.length > 0).length;
      expect(n).toBeGreaterThan(0);
      expect(h).toContain(`${n} groupes gardés sur 8 ; le fichier de sous-titres reste complet`);
    });
    it(`${fond} : aucune image ni lien, même entrée = même balisage, titre, Manrope`, () => {
      const h = rendre(fond);
      expect(h).not.toMatch(/<img|<image|href=/);
      expect(rendre(fond)).toBe(h);
      expect(h).toContain("Planche d&#x27;attente C11-T2 : rien n&#x27;est branché");
      expect(h).toContain("Manrope");
    });
  }
  it("éteint = identique : interrupteur éteint, appel sans 3e argument = copie égale, personne n'importe la planche ni selectif", () => {
    expect(SELECTIF_ACTIF).toBe(false);
    expect(filtrerSelectif(GROUPES_SELECTIF, MOTS_CLES_SELECTIF)).toEqual(GROUPES_SELECTIF);
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) {
      const t = lire(f);
      expect(t, f).not.toMatch(/planche-selectif|PlancheSelectif/);
      if (!f.endsWith("sous-titres/selectif.ts") && !f.endsWith("briques/composition/selectif-calque.ts")) expect(t, f).not.toMatch(/from\s+["'][^"']*\/selectif["']/);
    }
  });
  it("gardes statiques du composant et du script", () => {
    for (const f of ["outils/planche-selectif/PlancheSelectif.tsx", "outils/planche-selectif/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/from\s+["']@\/|@\/services|fournisseurs|remotion/);
    }
    expect(lire("outils/planche-selectif/PlancheSelectif.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
