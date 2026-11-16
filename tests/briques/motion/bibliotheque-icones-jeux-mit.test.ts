import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ICONES_BIBLIOTHEQUE, jeuDe } from "../../../src/briques/motion/bibliotheque-icones";
import { harmoniser, nomPermis } from "../../../src/briques/motion/bibliotheque-icones/harmoniser";
import { DROITS } from "../../../src/briques/droits/registre";
import { admissibleEnAutomatique } from "../../../src/briques/droits/licences";

const DOSSIER = "src/briques/motion/bibliotheque-icones";
const MARQUES = ["facebook", "instagram", "linkedin", "youtube", "twitter", "x", "tiktok", "github", "google"];
const COULEUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(red|blue|green|black|white|yellow|orange|purple|pink|gray|grey)\b/i;
const JEUX = ["tabler", "heroicons", "iconoir"] as const;
const NOMS_LUCIDE = Object.keys(ICONES_BIBLIOTHEQUE).filter((n) => n.startsWith("lucide:")).map((n) => n.slice(7));
const AUTORISES = new Set([...NOMS_LUCIDE, "globe", "ajout-personne", "lecture"]);
const MAJ = (j: string) => j.charAt(0).toUpperCase() + j.slice(1);

describe("jeux Tabler, Heroicons et Iconoir (C9-29)", () => {
  for (const jeu of JEUX) {
    describe(jeu, () => {
      const noms = Object.keys(ICONES_BIBLIOTHEQUE).filter((n) => n.startsWith(`${jeu}:`));
      const licence = `LICENCE-${MAJ(jeu)}-MIT.txt`;

      it("fichier de licence présent, texte MIT entier, daté", () => {
        const t = readFileSync(join(DOSSIER, licence), "utf8");
        expect(t).toMatch(/^MIT License/);
        expect(t).toContain("Permission is hereby granted");
        expect(t).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
        expect(t).toMatch(/\d{4}-\d{2}-\d{2}/);
        expect(t).toMatch(/sha256 de l archive : [0-9a-f]{64}/);
      });

      it("entrée de droits admissible, MIT, sans crédit", () => {
        const d = DROITS.find((e) => e.id === `icones-bibliotheque-${jeu}`);
        expect(d).toBeDefined();
        expect(admissibleEnAutomatique(d!)).toBe(true);
        expect(d!.spdx).toBe("MIT");
        expect(d!.creditRequis).toBe(false);
        expect(d!.fichierLicence).toBe(`${DOSSIER}/${licence}`);
        expect(d!.versionFigee).toMatch(/^\d+\.\d+\.\d+$/);
        expect(d!.preuve).toMatch(/sha256 de l'archive [0-9a-f]{64}/);
        expect(d!.nbElements).toBe(noms.length);
      });

      it("noms, nœuds, couleurs, tailles, visages, marques", () => {
        expect(noms.length).toBeGreaterThan(30);
        for (const nom of noms) {
          const ic = ICONES_BIBLIOTHEQUE[nom]!;
          expect(jeuDe(nom)).toBe(jeu);
          expect(ic.jeu).toBe(jeu);
          expect(ic.viewBox, nom).toBe("0 0 24 24");
          expect(ic.noeuds.length, nom).toBeGreaterThan(0);
          const json = JSON.stringify(ic.noeuds);
          expect(json.length, nom).toBeLessThan(4096);
          expect(COULEUR.test(json), nom).toBe(false);
          expect(json, nom).not.toContain("M0 0h24v24H0z");
          for (const [, a] of ic.noeuds) {
            expect(["currentColor", "none"], nom).toContain(a.fill);
            if (a.stroke !== undefined) expect(["currentColor", "none"], nom).toContain(a.stroke);
          }
          const court = nom.slice(jeu.length + 1);
          expect(AUTORISES.has(court), nom).toBe(true);
          expect(MARQUES).not.toContain(court);
          expect(nomPermis(court), nom).toBe(true);
          const h = harmoniser(ic);
          expect(h.viewBox, nom).toBe("0 0 24 24");
        }
      });

      it("fichier généré, sans alias « @/ », manifeste cohérent", () => {
        const s = readFileSync(join(DOSSIER, `${jeu}.ts`), "utf8");
        expect(s).toContain("FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs");
        expect(s).not.toMatch(/from\s+["']@\//);
        const man = JSON.parse(readFileSync(join(DOSSIER, "manifestes", `${jeu}.json`), "utf8")) as Record<string, string>;
        expect(Object.keys(man).sort()).toEqual(noms.map((n) => n.slice(jeu.length + 1)).sort());
        for (const [fr, origine] of Object.entries(man)) expect(nomPermis(origine), `${fr} → ${origine}`).toBe(true);
      });
    });
  }

  it("aucune collision de noms entre jeux", () => {
    const tous = Object.keys(ICONES_BIBLIOTHEQUE);
    expect(new Set(tous).size).toBe(tous.length);
  });

  it("trait : pas de remplissage ajouté (fill none, stroke currentColor) pour les trois jeux au trait", () => {
    for (const jeu of JEUX) {
      const ic = ICONES_BIBLIOTHEQUE[`${jeu}:coche`]!;
      for (const [, a] of ic.noeuds) {
        expect(a.fill).toBe("none");
        expect(a.stroke).toBe("currentColor");
      }
    }
  });
});
