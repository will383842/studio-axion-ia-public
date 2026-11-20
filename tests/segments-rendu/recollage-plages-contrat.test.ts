import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const lire = (chemin: string) => readFileSync(join(__dirname, "../..", chemin), "utf8");
const AVANT = [
  "nettoyage-audio", "tranches-audio", "analyse-media", "mesure-son", "composition", "image-fixe", "traitement-image", "assemblage",
  "capture-site", "miniature", "etalonnage", "mixage", "extrait", "visuel-page", "assemblage-pdf", "toile-continue",
];
const NOUVELLE = "recollage-plages";

/** Noms de l'union `OperationRendu`, dans l'ordre (lecture de texte). */
function union(texte: string): string[] {
  const debut = texte.indexOf("export type OperationRendu =");
  const fin = texte.indexOf(";", texte.indexOf('"toile-continue"', debut));
  const bloc = texte.slice(debut, fin + 1).split("\n").map((l) => l.replace(/\/\/.*$/, ""));
  return bloc.flatMap((l) => [...l.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]));
}

describe("déclaration de recollage-plages au contrat (T-EXT-52c-b)", () => {
  const contrat = union(lire("studio-rendu/src/contrat.ts"));
  const types = union(lire("src/fournisseurs/types.ts"));
  it("les deux listes OperationRendu sont identiques (mêmes noms, même ordre)", () => {
    expect(contrat).toEqual(types);
  });
  it("chaque liste = les 16 noms d'avant + recollage-plages", () => {
    const attendu = [...AVANT.slice(0, -1), NOUVELLE, AVANT[AVANT.length - 1]];
    expect(contrat).toEqual(attendu);
    expect(types).toEqual(attendu);
    expect(AVANT).toHaveLength(16);
  });
  it("index.ts : clés d'operations = d'avant + recollage-plages, chargée par import dynamique", () => {
    const t = lire("studio-rendu/src/index.ts");
    expect(t).toContain('"recollage-plages": async (d, c) => (await charger("recollage-plages", () => import("./operations/recollage-plages.js"))).recollagePlages(d, c),');
    expect(t.match(/"recollage-plages":/g)).toHaveLength(1);
  });
  it("collage-chapitres n'est déclarée dans aucun des trois fichiers", () => {
    for (const f of ["studio-rendu/src/contrat.ts", "src/fournisseurs/types.ts", "studio-rendu/src/index.ts"]) {
      expect(lire(f)).not.toMatch(/"collage-chapitres"/);
    }
  });
});
