import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { TYPES_AUTOMATISATION } from "@/domaine/ciblage/types";
import {
  VERSION_NOTE_EXTRAITS,
  type Moment,
  type NoteMoment,
  type ResultatTri,
  type SujetExtrait,
  type UsageExtrait,
} from "@/briques/note-extraits";

const DOSSIER = join(process.cwd(), "src/briques/note-extraits");

describe("note-extraits : types (X4-01)", () => {
  it("version", () => {
    expect(VERSION_NOTE_EXTRAITS).toBe("note-extraits/1");
  });

  it("les 4 usages et les 3 décisions existent", () => {
    const usages = ["telephone", "ecran", "fond", "preuve-chiffree"] as const satisfies readonly UsageExtrait[];
    const decisions = ["garde", "peut-etre", "ignore"] as const satisfies readonly NoteMoment["decision"][];
    expect(usages).toHaveLength(4);
    expect(decisions).toHaveLength(3);
  });

  it("SujetExtrait accepte les 12 types et appels-offres", () => {
    const sujets = [...TYPES_AUTOMATISATION.map((t) => t.id), "appels-offres"] satisfies SujetExtrait[];
    expect(sujets).toHaveLength(13);
  });

  it("les formes Moment, NoteMoment, ResultatTri se construisent", () => {
    const m: Moment = { id: "m1", origine: "parole", debutSec: 0, finSec: 3, montre: "inconnu", avecVisage: false, texteIncruste: false };
    const n: NoteMoment = { note: 60, raisons: [{ code: "x", points: 60 }], sujet: null, usages: ["ecran"], decision: "garde" };
    const r: ResultatTri = { gardes: [{ ...m, ...n }], peutEtre: [], ignores: { nombre: 0, raisonPrincipale: null }, rienARetenir: false };
    expect(r.gardes[0].decision).toBe("garde");
  });

  it("garde statique : brique pure", () => {
    const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".ts"));
    expect(fichiers.sort()).toEqual(["bareme.ts", "choisir.ts", "index.ts", "moments-ecran.ts", "noter.ts", "reglage.ts", "sources-propres.ts", "sujets.ts", "trier.ts", "types.ts", "usages.ts", "version.ts"]);
    for (const f of fichiers) {
      const src = readFileSync(join(DOSSIER, f), "utf8");
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code).not.toMatch(/@\/services\//);
      expect(code).not.toMatch(/studio-rendu/);
      expect(code).not.toMatch(/credits|couts|depense-claude-video|plafond/);
      expect(code).not.toMatch(/Date\.now|new Date|Math\.random/);
    }
  });
});
