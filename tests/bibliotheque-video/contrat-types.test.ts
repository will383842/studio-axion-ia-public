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
      const texte = readFileSync(f, "utf8")
        .split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b|^\s*import\s+["']/.test(l)).join("\n");
      expect(texte, f).not.toMatch(/studio-rendu/);
      for (const nom of argent) {
        expect(texte, `${f} importe ${nom}`).not.toMatch(
          new RegExp(`from\\s+["'][^"']*/(services|domaine)/${nom}(-[a-z-]+)?["']`),
        );
      }
    }
    for (const f of fichiers(join(RACINE, "studio-rendu"))) {
      if (f.includes("node_modules")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/bibliotheque-video/);
    }
  });
});
