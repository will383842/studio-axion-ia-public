/** C10-07-PLANCHE-v19c : planche d'attente (outil local) « quel contour sous le sous-titre selon le fond ». */
import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { contourPourFond } from "../../src/briques/sous-titres/fond-clair";
import { casesFondClair, PlancheFondClair, TEXTES_PLANCHE } from "../../outils/planche-fond-clair/PlancheFondClair";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const rendre = () => renderToStaticMarkup(<PlancheFondClair />);
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}
/** Balise ouvrante de la case (fond, texte) et son contenu jusqu'à la fin de la case. */
function caseHtml(h: string, fond: string, texte: string): string {
  const debut = h.indexOf(`data-fond="${fond}" data-texte="${texte}"`);
  if (debut < 0) throw new Error(`case ${fond}/${texte} absente`);
  const fin = h.indexOf("data-cellule-fin", debut);
  return h.slice(debut, fin < 0 ? undefined : fin);
}
const virgule = (n: number) => n.toFixed(2).replace(".", ",");
const FONDS = Object.keys(PALETTE) as (keyof typeof PALETTE)[];

describe("C10-07-PLANCHE-v19c planche fond clair", () => {
  it("11 couleurs × 3 textes = 33 cases, chacune égale à contourPourFond", () => {
    expect(FONDS).toHaveLength(11);
    expect(TEXTES_PLANCHE).toHaveLength(3);
    const cases = casesFondClair();
    expect(cases).toHaveLength(33);
    const h = rendre();
    expect(h.match(/data-fond="/g)).toHaveLength(33);
    for (const fond of FONDS) {
      for (const texte of TEXTES_PLANCHE) {
        const attendu = contourPourFond(PALETTE[fond], PALETTE[texte]);
        const c = caseHtml(h, fond, texte);
        expect(c, `${fond}/${texte}`).toContain(`data-reserve="${attendu.reserve}"`);
        expect(c).toContain(`data-contour="${attendu.contour !== null ? "oui" : "non"}"`);
        expect(c).toContain(`contraste ${virgule(attendu.contraste)}`);
      }
    }
  });
  it("le trait de contour n'est présent que si contour !== null, et en noir de la charte", () => {
    const h = rendre();
    const avec = casesFondClair().filter((c) => c.resultat.contour !== null).length;
    expect(avec).toBeGreaterThan(0);
    expect(avec).toBeLessThan(33);
    expect(h.match(/-webkit-text-stroke/g) ?? []).toHaveLength(avec);
    for (const fond of FONDS) {
      for (const texte of TEXTES_PLANCHE) {
        const c = caseHtml(h, fond, texte);
        const r = contourPourFond(PALETTE[fond], PALETTE[texte]);
        if (r.contour === null) expect(c).not.toContain("-webkit-text-stroke");
        else {
          expect(r.contour).toBe(PALETTE.noir);
          expect(c.toLowerCase()).toContain(`-webkit-text-stroke:2px ${PALETTE.noir.toLowerCase()}`);
        }
      }
    }
  });
  it("cas témoins lus dans la fonction", () => {
    const h = rendre();
    const a = contourPourFond(PALETTE.noir, PALETTE.ivoire);
    expect(a.contour).toBeNull();
    expect(a.reserve).toBe("aucune");
    expect(caseHtml(h, "noir", "ivoire")).toContain('data-contour="non"');
    const b = contourPourFond(PALETTE.ivoire, PALETTE.blanc);
    expect(b.contour).toBe(PALETTE.noir);
    expect(b.reserve).toBe("contraste-faible");
    const cb = caseHtml(h, "ivoire", "blanc");
    expect(cb).toContain('data-contour="oui"');
    expect(cb).toContain('data-reserve="contraste-faible"');
  });
  it("même rendu deux fois = même balisage ; aucune image ni lien ; Manrope", () => {
    const h = rendre();
    expect(h).not.toMatch(/<img|<image|href=/);
    expect(rendre()).toBe(h);
    expect(h).toContain("Manrope");
    expect(h).toContain("Planche d&#x27;attente C10-07 : rien n&#x27;est branché");
  });
  it("éteint = identique : aucun fichier de src/ ni de studio-rendu/ ne cite la planche ni n'importe fond-clair par elle", () => {
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) {
      const t = lire(f);
      expect(t, f).not.toMatch(/planche-fond-clair|PlancheFondClair/);
    }
    // la pièce reste sans importeur : seuls fond-clair.ts lui-même et les tests le citent
    const importeurs = [...fichiers("src"), ...fichiers("studio-rendu")].filter((f) =>
      /from\s+["'][^"']*sous-titres\/fond-clair["']|from\s+["']\.\/fond-clair["']/.test(lire(f)),
    );
    expect(importeurs).toEqual([]);
  });
  it("gardes statiques du composant et du script", () => {
    for (const f of ["outils/planche-fond-clair/PlancheFondClair.tsx", "outils/planche-fond-clair/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/from\s+["']@\/|@\/services|fournisseurs|remotion/);
    }
    expect(lire("outils/planche-fond-clair/PlancheFondClair.tsx")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
