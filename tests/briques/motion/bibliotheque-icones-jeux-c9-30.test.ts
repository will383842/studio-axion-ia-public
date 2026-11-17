import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ICONES_BIBLIOTHEQUE, jeuDe } from "../../../src/briques/motion/bibliotheque-icones";
import { harmoniser, nomPermis } from "../../../src/briques/motion/bibliotheque-icones/harmoniser";
import { DROITS } from "../../../src/briques/droits/registre";
import { admissibleEnAutomatique } from "../../../src/briques/droits/licences";
import { NOMS_ICONES } from "../../../src/briques/motion/icones";

const DOSSIER = "src/briques/motion/bibliotheque-icones";
const MARQUES = ["facebook", "instagram", "linkedin", "youtube", "twitter", "x", "tiktok", "github", "google"];
const MOTS_MARQUE = ["logo", "brand", "ibm", "bootstrap", "github", "twitter", "facebook", "google", "apple", "microsoft"];
const COULEUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(red|blue|green|black|white|yellow|orange|purple|pink|gray|grey)\b/i;
const NOMS_LUCIDE = Object.keys(ICONES_BIBLIOTHEQUE).filter((n) => n.startsWith("lucide:")).map((n) => n.slice(7));
const AUTORISES = new Set([...NOMS_LUCIDE, "globe", "ajout-personne", "lecture"]);
const SANTE = ["stethoscope", "seringue", "medicament", "pansement", "hopital", "ambulance", "pouls", "tension", "vaccin", "microscope", "adn", "dossier-medical", "eau-potable", "masque-chirurgical"];
const JEUX = [
  { jeu: "carbon", licence: "LICENCE-Carbon-Apache2.txt", spdx: "Apache-2.0", min: 30, max: 1000, noms: AUTORISES },
  { jeu: "bootstrap", licence: "LICENCE-Bootstrap-MIT.txt", spdx: "MIT", min: 30, max: 1000, noms: AUTORISES },
  { jeu: "health-icons", licence: "LICENCE-HealthIcons-CC0.txt", spdx: "CC0-1.0", min: 10, max: 14, noms: new Set(SANTE) },
] as const;

describe("jeux Carbon, Bootstrap Icons et Health Icons (C9-30)", () => {
  for (const { jeu, licence, spdx, min, max, noms: permis } of JEUX) {
    describe(jeu, () => {
      const noms = Object.keys(ICONES_BIBLIOTHEQUE).filter((n) => n.startsWith(`${jeu}:`));

      it("fichier de licence présent, entier, daté, avec le sha256", () => {
        const t = readFileSync(join(DOSSIER, licence), "utf8");
        expect(t).toMatch(/\d{4}-\d{2}-\d{2}/);
        expect(t).toMatch(/sha256 de l archive : [0-9a-f]{64}/);
        if (jeu === "carbon") {
          expect(t.trim()).toMatch(/^Apache License/);
          expect(t).toContain("Aucun fichier NOTICE");
          expect(t).toContain("limitations under the License.");
        } else if (jeu === "bootstrap") {
          expect(t).toMatch(/^MIT License/);
          expect(t).toContain("Permission is hereby granted");
          expect(t).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
        } else expect(t).toContain("CC0 1.0 Universal");
      });

      it("entrée de droits admissible, sans crédit, preuve et nombre exacts", () => {
        const d = DROITS.find((e) => e.id === `icones-bibliotheque-${jeu}`);
        expect(d).toBeDefined();
        expect(admissibleEnAutomatique(d!)).toBe(true);
        expect(d!.spdx).toBe(spdx);
        expect(d!.creditRequis).toBe(false);
        expect(d!.fichierLicence).toBe(`${DOSSIER}/${licence}`);
        expect(d!.versionFigee).toMatch(/^\d+\.\d+\.\d+$/);
        expect(d!.preuve).toMatch(/sha256 de l'archive [0-9a-f]{64}/);
        expect(d!.nbElements).toBe(noms.length);
      });

      it("volume, noms, nœuds, couleurs, tailles, marques", () => {
        expect(noms.length).toBeGreaterThanOrEqual(min);
        expect(noms.length).toBeLessThanOrEqual(max);
        for (const nom of noms) {
          const ic = ICONES_BIBLIOTHEQUE[nom]!;
          expect(jeuDe(nom)).toBe(jeu);
          expect(ic.jeu).toBe(jeu);
          expect(ic.viewBox, nom).toMatch(/^0 0 \d+ \d+$/);
          expect(ic.noeuds.length, nom).toBeGreaterThan(0);
          const json = JSON.stringify(ic.noeuds);
          expect(json.length, nom).toBeLessThan(4096);
          expect(COULEUR.test(json), nom).toBe(false);
          for (const [, a] of ic.noeuds) {
            expect(["currentColor", "none"], nom).toContain(a.fill);
            if (a.stroke !== undefined) expect(["currentColor", "none"], nom).toContain(a.stroke);
          }
          const court = nom.slice(jeu.length + 1);
          expect(permis.has(court), nom).toBe(true);
          expect(nomPermis(court), nom).toBe(true);
          expect(MARQUES).not.toContain(court);
          for (const m of MOTS_MARQUE) expect(court, nom).not.toContain(m);
          expect(harmoniser(ic).viewBox, nom).toBe("0 0 24 24");
        }
      });

      it("fichier généré, sans alias « @/ », manifeste cohérent, sans marque ni personne", () => {
        const s = readFileSync(join(DOSSIER, `${jeu}.ts`), "utf8");
        expect(s).toContain("FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs");
        expect(s).not.toMatch(/from\s+["']@\//);
        const man = JSON.parse(readFileSync(join(DOSSIER, "manifestes", `${jeu}.json`), "utf8")) as Record<string, string>;
        expect(Object.keys(man).sort()).toEqual(noms.map((n) => n.slice(jeu.length + 1)).sort());
        for (const [fr, origine] of Object.entries(man)) {
          expect(nomPermis(origine), `${fr} → ${origine}`).toBe(true);
          for (const m of MOTS_MARQUE) expect(origine.toLowerCase(), `${fr} → ${origine}`).not.toContain(m);
          if (jeu === "health-icons") expect(origine, origine).not.toMatch(/^people\/|cross|crescent|red-?cross/i);
        }
      });
    });
  }

  it("aucune collision de noms entre les 9 jeux, et NOMS_ICONES reste figé", () => {
    const tous = Object.keys(ICONES_BIBLIOTHEQUE);
    expect(new Set(tous).size).toBe(tous.length);
    expect(new Set(tous.map((n) => n.slice(0, n.indexOf(":")))).size).toBe(9);
    expect(NOMS_ICONES).toHaveLength(39);
  });
});
