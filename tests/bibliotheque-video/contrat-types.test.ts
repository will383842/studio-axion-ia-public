import { describe, it, expect, expectTypeOf } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  cleUsageExtrait,
  VERSION_BIBLIOTHEQUE,
  type CandidatExtrait,
  type EtatCapacite,
  type ProfilVideo,
  type SourceMemoire,
} from "@/briques/bibliotheque-video";

const RACINE = join(__dirname, "..", "..");

function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}

/** Retire les commentaires, puis liste tous les spécifieurs d'import/export (multi-ligne et dynamiques compris). */
export function specifieursImportes(source: string): string[] {
  const sans = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const motifs = [/\bfrom\s+["']([^"']+)["']/g, /\bimport\s*\(\s*["']([^"']+)["']/g, /\bimport\s+["']([^"']+)["']/g];
  return motifs.flatMap((m) => [...sans.matchAll(m)].map((r) => r[1]));
}

describe("contrat commun de la bibliothèque vidéo (types seuls)", () => {
  it("(a) cleUsageExtrait compose la clé", () => {
    expect(cleUsageExtrait("e1", "p2")).toBe("extrait:e1:p2");
  });

  it("(b) la version est figée", () => {
    expect(VERSION_BIBLIOTHEQUE).toBe("bibliotheque-video/1");
  });

  it("(c) vérifications de type", () => {
    expectTypeOf<EtatCapacite>().toEqualTypeOf<"prod" | "demande" | "eteint" | "coulisse" | "absent" | "prevu">();
    expectTypeOf<"v4-extraits">().toExtend<SourceMemoire>();
    expectTypeOf<CandidatExtrait["visage"]>().toEqualTypeOf<"williams" | "aucun">();
    const sansBlocs: ProfilVideo = {
      id: "p", formatId: "f", version: 1, capacites: {},
      plafonds: {}, memoire: { fenetreVideos: 3, portee: "format" }, verrous: [],
    };
    expect(sansBlocs.blocs).toBeUndefined();
  });

  it("(d) gardes statiques : ni argent, ni rendu, et le rendu n'importe pas la brique", () => {
    const argent = [
      "credits", "budget-mensuel", "mode-budget", "autonomie-usine", "couts",
      "cle-depense-usine", "depense-claude-contenu", "depense-claude-video",
      "generation-claude", "image-video",
    ];
    for (const f of fichiers(join(RACINE, "src/briques/bibliotheque-video"))) {
      const specs = specifieursImportes(readFileSync(f, "utf8"));
      for (const sp of specs) expect(sp, `${f} importe studio-rendu`).not.toMatch(/studio-rendu/);
      for (const nom of argent) {
        for (const sp of specs) {
          expect(sp, `${f} importe ${nom}`).not.toMatch(new RegExp(`/(services|domaine)/${nom}(-[a-z-]+)?$`));
        }
      }
    }
    for (const f of fichiers(join(RACINE, "studio-rendu"))) {
      if (f.includes("node_modules")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/bibliotheque-video/);
    }
  });

  it("(d') la garde attrape un import multi-ligne et un import dynamique", () => {
    const multi = 'import {\n  type X,\n} from "@/services/credits";\n// import y from "@/services/couts";\nconst m = await import("../studio-rendu/a");\nimport "@/services/budget-mensuel";';
    expect(specifieursImportes(multi)).toEqual(["@/services/credits", "../studio-rendu/a", "@/services/budget-mensuel"]);
  });
});
