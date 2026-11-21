/**
 * PLANCHE-MOT-CLE-v21n : le mot-clé « étiquette » (taille 40) ou « bandeau » (taille 58) tient en haut, mot entier, sans toucher
 * la bande des sous-titres ni la zone du visage. Outil local, 0 €, rien allumé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BANDE_SOUS_TITRES, controlesMotCle, geometrieMotCle, MOT_CLE, PlancheMotCle, STYLES_MOT_CLE, TAILLE_MOT_CLE } from "../../outils/mot-cle/PlancheMotCle";
import { seChevauchent, ZONE_VISAGE, ZONES } from "../../src/briques/plan-scenes/zones";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("planche mot-clé : géométrie de la pièce legende en haut", () => {
  it("les deux styles ont les tailles de la pièce : étiquette 40, bandeau 58 (comme controles.ts)", () => {
    expect(TAILLE_MOT_CLE).toEqual({ etiquette: 40, bandeau: 58 });
    const s = lire("src/briques/plan-scenes/controles.ts");
    expect(s).toContain('p.style === "titre" ? 84 : p.style === "bandeau" ? 58 : 40');
  });
  for (const style of STYLES_MOT_CLE) {
    it(`${style} : mot entier, en haut, hors bande des sous-titres, hors zone du visage`, () => {
      const c = controlesMotCle(style);
      expect(c).toEqual({ horsSousTitres: true, horsVisage: true, motEntier: true, enHaut: true });
      const g = geometrieMotCle(style);
      expect(seChevauchent(g.boite, ZONE_VISAGE)).toBe(false);
      expect(seChevauchent(g.boite, BANDE_SOUS_TITRES)).toBe(false);
      expect(g.boite.y).toBeGreaterThanOrEqual(ZONES.haut.y);
      expect(g.boite.x).toBeGreaterThan(0);
      expect(g.boite.x + g.boite.largeur).toBeLessThan(100);
    });
  }
  it("un mot trop long n'est PAS déclaré entier (la mesure mord)", () => {
    expect(geometrieMotCle("bandeau", "Anticonstitutionnellement-et-bien-plus").motEntier).toBe(false);
  });
  it("le bandeau est plus grand que l'étiquette", () => {
    expect(geometrieMotCle("bandeau").tailleTexte).toBeGreaterThan(geometrieMotCle("etiquette").tailleTexte);
  });
});

describe("planche mot-clé : rendu", () => {
  for (const style of STYLES_MOT_CLE) {
    it(`${style} : le mot est écrit une fois, en Manrope, avec les sous-titres en bas`, () => {
      const h = renderToStaticMarkup(createElement(PlancheMotCle, { style }));
      expect(h.split(MOT_CLE).length - 1).toBe(1); // « Devis » avec majuscule : le mot-clé seul (la phrase des sous-titres écrit « devis » en minuscule)
      expect(h).toContain(`data-style="${style}"`);
      expect(h).toContain("Manrope");
      expect(h).toContain("Le devis part tout seul");
    });
  }
  it("même entrée, même sortie", () => {
    expect(renderToStaticMarkup(createElement(PlancheMotCle, { style: "bandeau" }))).toBe(renderToStaticMarkup(createElement(PlancheMotCle, { style: "bandeau" })));
  });
});

describe("planche mot-clé : gardes de l'outil", () => {
  it("aucune lecture de réglage ni de depots, aucun process.env, aucune pastille IA", () => {
    for (const f of ["outils/mot-cle/PlancheMotCle.tsx", "outils/mot-cle/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/reglages|depots|process\.env|fetch\(|mention-ia|MentionIA/i);
    }
  });
  it("le script supprime son entrée temporaire (finally) et reste local", () => {
    const s = lire("outils/mot-cle/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain('"captures", "mot-cle"');
  });
  it("aucun fichier de src/ ni de studio-rendu/ n'importe outils/mot-cle", () => {
    for (const f of ["src/briques/plan-scenes/zones.ts", "src/briques/plan-scenes/catalogue.ts", "studio-rendu/compositions/plan-scenes/PlanDeScenes.tsx"]) {
      expect(lire(f), f).not.toMatch(/outils\/mot-cle|PlancheMotCle/);
    }
  });
});
