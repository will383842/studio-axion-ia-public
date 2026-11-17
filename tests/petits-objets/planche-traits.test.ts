/** C9-39 — planche traits et marques : 2 fonds × 2 formats, silhouette témoin, garde statique. Aucun rendu Remotion. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlancheTraits, ENTREES_PLANCHE, zoneDeLEntree, seChevauchent } from "../../studio-rendu/compositions/petits-objets/planche/PlancheTraits";
import { EXEMPLES_FLECHES } from "../../src/briques/motion/petits-objets/fleches";
import { EXEMPLES_SOULIGNEMENTS } from "../../src/briques/motion/petits-objets/soulignements";
import { EXEMPLES_MARQUES } from "../../src/briques/motion/petits-objets/marques";
import { EXEMPLES_ENTOURAGES } from "../../src/briques/motion/petits-objets/entourages";
import { EXEMPLES_CADRES } from "../../src/briques/motion/petits-objets/cadres";
import { ZONE_VISAGE_OBJETS } from "../../src/briques/motion/petits-objets/zones";
import type { FondAxion } from "../../src/briques/jetons-motion";

const FONDS: FondAxion[] = ["ivoire", "noir"];
const FORMATS = ["9x16", "4x5"] as const;
const compter = (m: string, attr: string) => (m.match(new RegExp(`data-${attr}="`, "g")) ?? []).length;

const NB = { fleches: 4, soulignements: 4, marques: 3 };
const ATTENDU =
  NB.fleches * EXEMPLES_FLECHES.length +
  NB.soulignements * EXEMPLES_SOULIGNEMENTS.length +
  NB.marques * EXEMPLES_MARQUES.length +
  Object.values(EXEMPLES_ENTOURAGES).reduce((s, l) => s + l.length, 0) +
  Object.values(EXEMPLES_CADRES).reduce((s, l) => s + l.length, 0);

describe("C9-39 planche traits", () => {
  for (const fond of FONDS) for (const format of FORMATS) {
    it(`${fond} ${format} : chaque exemple est rendu une fois, avec la silhouette témoin`, () => {
      const m = renderToStaticMarkup(createElement(PlancheTraits, { fond, format }));
      expect(compter(m, "objet")).toBe(ATTENDU);
      expect(ENTREES_PLANCHE.length).toBe(ATTENDU);
      expect(compter(m, "silhouette-temoin")).toBe(ATTENDU);
      expect(m).not.toMatch(/<image|<img|href=/);
    });
  }

  it("la marque de chevauchement du visage dit vrai (géométrie)", () => {
    const m = renderToStaticMarkup(createElement(PlancheTraits, { fond: "ivoire", format: "4x5" }));
    const attendus = ENTREES_PLANCHE.filter((e) => seChevauchent(zoneDeLEntree(e), ZONE_VISAGE_OBJETS)).length;
    expect(compter(m, "chevauche-visage")).toBe(ENTREES_PLANCHE.length);
    expect((m.match(/data-chevauche-visage="oui"/g) ?? []).length).toBe(attendus);
  });

  it("les cadres et entourages (exemples sous le visage) ne touchent pas le visage", () => {
    for (const e of ENTREES_PLANCHE.filter((x) => x.famille === "cadres" || x.famille === "entourages")) {
      expect(seChevauchent(zoneDeLEntree(e), ZONE_VISAGE_OBJETS), e.id).toBe(false);
    }
  });

  it("seChevauchent : bords communs ne comptent pas", () => {
    expect(seChevauchent({ x: 0, y: 0, largeur: 10, hauteur: 10 }, { x: 10, y: 0, largeur: 5, hauteur: 5 })).toBe(false);
    expect(seChevauchent({ x: 0, y: 0, largeur: 11, hauteur: 10 }, { x: 10, y: 0, largeur: 5, hauteur: 5 })).toBe(true);
  });
});

describe("C9-39 garde statique", () => {
  const dossier = join(__dirname, "..", "..", "studio-rendu", "compositions", "petits-objets", "planche");
  const fichiers = existsSync(dossier) ? readdirSync(dossier) : [];
  it("les 3 fichiers de la planche existent", () => {
    expect(fichiers.sort()).toEqual(["PlancheEcrans.tsx", "PlancheEtiquettes.tsx", "PlancheManuscrit.tsx", "PlancheTraits.tsx", "RacinePlanches.tsx", "entree.ts"]);
  });
  for (const f of fichiers) {
    it(`${f} : aucun @/ ni src/services`, () => {
      const t = readFileSync(join(dossier, f), "utf8");
      expect(t).not.toMatch(/@\//);
      expect(t).not.toMatch(/src\/services|\/services\//);
    });
  }
  it("l'entrée n'importe ni Racine.tsx ni compositions/index.ts", () => {
    const imports = readFileSync(join(dossier, "entree.ts"), "utf8").split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
    expect(imports).not.toMatch(/Racine["'.]|compositions\/index|\/index["']/);
  });
});
