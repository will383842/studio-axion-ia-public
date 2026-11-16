import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ICONES_BIBLIOTHEQUE, jeuDe } from "../../../src/briques/motion/bibliotheque-icones";
import { NOMS_ICONES } from "../../../src/briques/motion/icones";
import { DROITS } from "../../../src/briques/droits/registre";
import { admissibleEnAutomatique } from "../../../src/briques/droits/licences";

const DOSSIER = "src/briques/motion/bibliotheque-icones";
const MARQUES = ["facebook", "instagram", "linkedin", "youtube", "twitter", "x", "tiktok", "github", "google"];
const COULEUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(red|blue|green|black|white|yellow|orange|purple|pink|gray|grey)\b/i;

const JEUX = [
  { jeu: "phosphor", licence: "LICENCE-Phosphor-MIT.txt", droit: "icones-bibliotheque-phosphor", spdx: "MIT", texte: "Permission is hereby granted", attendus: 86 },
  { jeu: "material", licence: "LICENCE-MaterialSymbols-Apache2.txt", droit: "icones-bibliotheque-material", spdx: "Apache-2.0", texte: "Apache License", attendus: 43 },
] as const;

describe("jeux Phosphor et Material (C6-H17b)", () => {
  for (const j of JEUX) {
    describe(j.jeu, () => {
      const noms = Object.keys(ICONES_BIBLIOTHEQUE).filter((n) => n.startsWith(`${j.jeu}:`));

      it("fichier de licence présent, texte complet, daté", () => {
        const t = readFileSync(join(DOSSIER, j.licence), "utf8");
        expect(t).toContain(j.texte);
        if (j.jeu === "phosphor") {
          expect(t).toMatch(/^MIT License/);
          expect(t).toContain("THE SOFTWARE IS PROVIDED \"AS IS\"");
          expect(t).toContain("Phosphor Icons");
        } else {
          expect(t).toMatch(/Apache License\s+Version 2\.0/);
          expect(t).toContain("END OF TERMS AND CONDITIONS");
        }
        expect(t).toMatch(/\d{4}-\d{2}-\d{2}/);
        expect(t).toMatch(/sha256 de l archive : [0-9a-f]{64}/);
      });

      it("entrée de droits admissible, sans crédit, preuve = fichier de licence", () => {
        const d = DROITS.find((e) => e.id === j.droit);
        expect(d).toBeDefined();
        expect(admissibleEnAutomatique(d!)).toBe(true);
        expect(d!.spdx).toBe(j.spdx);
        expect(d!.creditRequis).toBe(false);
        expect(d!.fichierLicence).toBe(`${DOSSIER}/${j.licence}`);
        expect(d!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(d!.preuve).toMatch(/sha256 de l'archive [0-9a-f]{64}/);
        expect(d!.versionFigee).toMatch(/^\d+\.\d+\.\d+$/);
        expect(d!.nbElements).toBe(noms.length);
      });

      it("tous les noms sont préfixés, sans marque, sans couleur en dur, légers", () => {
        expect(noms).toHaveLength(j.attendus);
        for (const nom of noms) {
          const ic = ICONES_BIBLIOTHEQUE[nom]!;
          expect(jeuDe(nom)).toBe(j.jeu);
          expect(ic.jeu).toBe(j.jeu);
          expect(MARQUES).not.toContain(nom.slice(j.jeu.length + 1).replace(/~duotone$/, ""));
          expect(ic.viewBox, nom).toMatch(/^0 0 \d+ \d+$/);
          const json = JSON.stringify(ic.noeuds);
          expect(json.length, nom).toBeLessThan(4096);
          expect(COULEUR.test(json), nom).toBe(false);
          for (const [, attrs] of ic.noeuds) {
            expect(attrs.fill, nom).toBe("currentColor");
            if (attrs.stroke !== undefined) expect(["currentColor", "none"], nom).toContain(attrs.stroke);
          }
        }
      });
    });
  }

  it("Phosphor duotone : 2e couche en currentColor avec opacité fixe, pas de couleur", () => {
    const duos = Object.entries(ICONES_BIBLIOTHEQUE).filter(([n]) => n.startsWith("phosphor:") && n.endsWith("~duotone"));
    expect(duos).toHaveLength(43);
    for (const [nom, ic] of duos) {
      expect(ic.noeuds.length, nom).toBeGreaterThanOrEqual(2);
      expect(ic.noeuds.some(([, a]) => a.opacity !== undefined && a.fill === "currentColor"), nom).toBe(true);
      expect(ICONES_BIBLIOTHEQUE[nom.replace("~duotone", "")], nom).toBeDefined();
    }
  });

  it("Material : grille ramenée à l'origine par un translate, un seul jeu outlined", () => {
    for (const [nom, ic] of Object.entries(ICONES_BIBLIOTHEQUE).filter(([n]) => n.startsWith("material:"))) {
      expect(ic.viewBox, nom).toBe("0 0 960 960");
      for (const [, a] of ic.noeuds) expect(a.transform, nom).toBe("translate(0 960)");
    }
  });

  it("aucune collision de noms entre jeux, mêmes noms français dans chaque jeu", () => {
    const tous = Object.keys(ICONES_BIBLIOTHEQUE);
    expect(new Set(tous).size).toBe(tous.length);
    const base = (jeu: string) => tous.filter((n) => n.startsWith(`${jeu}:`) && !n.endsWith("~duotone")).map((n) => n.slice(jeu.length + 1)).sort();
    expect(base("phosphor")).toEqual(base("lucide"));
    expect(base("material")).toEqual(base("lucide"));
  });

  it("NOMS_ICONES inchangé et aucun import « @/ » dans les fichiers générés", () => {
    expect(NOMS_ICONES).toHaveLength(39);
    for (const f of ["phosphor.ts", "material.ts"]) {
      const s = readFileSync(join(DOSSIER, f), "utf8");
      expect(s, f).not.toMatch(/from\s+["']@\//);
      expect(s, f).toContain("FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs");
    }
  });
});
