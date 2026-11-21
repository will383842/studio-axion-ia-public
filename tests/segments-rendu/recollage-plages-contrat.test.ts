import { readdirSync, readFileSync, statSync } from "node:fs";
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

  it("OPERATIONS (lue par verifierDemande) = AVANT + recollage-plages, même ordre que l'union", () => {
    const texte = lire("studio-rendu/src/contrat.ts");
    const debut = texte.indexOf("export const OPERATIONS");
    const bloc = texte.slice(debut, texte.indexOf("];", debut));
    const noms = [...bloc.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    expect(noms).toEqual([...AVANT.slice(0, -1), NOUVELLE, AVANT[AVANT.length - 1]]);
    expect(noms).toEqual(contrat);
  });
  it("verifierDemande ne refuse plus recollage-plages comme « opération inconnue »", async () => {
    // chemin CALCULÉ (PIEGE-REMOTION-TSC.md) : pas d'import littéral de studio-rendu/**
    const chemin = join(__dirname, "../..", "studio-rendu/src/contrat");
    const { verifierDemande } = (await import(/* @vite-ignore */ chemin)) as { verifierDemande: (d: unknown) => string | null };
    const demande = { idRendu: "x", operation: NOUVELLE, file: "longue", entrees: {}, sortie: { urlDepot: "u", cle: "k" }, parametres: {} };
    expect(verifierDemande(demande)).toBeNull();
    expect(verifierDemande({ ...demande, operation: "collage-chapitres" })).toBe("opération inconnue");
  });
  it("seuls ces fichiers de src/** citent l'opération recollage-plages (52c-d du tutoriel, ports communs S-11-b)", () => {
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(n) && /recollage-plages/.test(readFileSync(c, "utf8"))) trouves.push(c.replace(join(__dirname, "../.."), "").replace(/\\/g, "/").replace(/^\//, ""));
      }
    };
    parcourir(join(__dirname, "../..", "src"));
    expect(trouves).toEqual(["src/briques/rendu-par-plages/index.ts", "src/fournisseurs/types.ts", "src/moteurs/montage-tutoriel-outil/chaine.ts", "src/services/retouche-chat/rendu-commun.ts"]);
  });
  it("collage-chapitres n'est déclarée dans aucun des trois fichiers", () => {
    for (const f of ["studio-rendu/src/contrat.ts", "src/fournisseurs/types.ts", "studio-rendu/src/index.ts"]) {
      expect(lire(f)).not.toMatch(/"collage-chapitres"/);
    }
  });
});
