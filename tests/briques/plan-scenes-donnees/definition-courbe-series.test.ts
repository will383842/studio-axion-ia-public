import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CATALOGUE_BRIQUES, type DefinitionBrique } from "../../../src/briques/plan-scenes/catalogue";
import { consignePlan } from "../../../src/briques/plan-scenes/generateur";
import { TOILES } from "../../../src/briques/plan-scenes/toiles";
import { valider, type ParametresCourbeSeries } from "../../../src/briques/plan-scenes-donnees/courbe-series";
import {
  DEFINITION_COURBE_SERIES,
  EXEMPLE_COURBE_SERIES,
  nombresCourbeSeries,
  schemaCourbeSeries,
  textesCourbeSeries,
} from "../../../src/briques/plan-scenes-donnees/definition-courbe-series";

const base = (): ParametresCourbeSeries => structuredClone(EXEMPLE_COURBE_SERIES);
const serie = (nom: string, n: number) => ({ nom, valeurs: Array.from({ length: n }, (_, i) => i + 1) });
// Même normalisation que catalogue.ts (fonction non exportée).
const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

describe("définition de la courbe à plusieurs séries (G4-11b-PREP-v19c)", () => {
  it("a) l'exemple passe le schéma et valider", () => {
    expect(schemaCourbeSeries.safeParse(EXEMPLE_COURBE_SERIES).success).toBe(true);
    expect(valider(EXEMPLE_COURBE_SERIES).ok).toBe(true);
  });

  it("b) Zod et valider donnent le même verdict sur 7 cas", () => {
    const cas: Array<[string, ParametresCourbeSeries]> = [
      ["exemple", base()],
      ["1 série", { ...base(), series: [serie("A", 4)], enAvant: 0 }],
      ["5 séries", { ...base(), series: ["A", "B", "C", "D", "E"].map((n) => serie(n, 4)), enAvant: 0 }],
      ["2 abscisses", { titre: "T", abscisses: ["a", "b"], series: [serie("A", 2), serie("B", 2)] }],
      ["une valeur de moins", { ...base(), series: [serie("A", 4), serie("B", 3)] }],
      ["enAvant 2 sur 2 séries", { ...base(), enAvant: 2 }],
      ["titre blanc", { ...base(), titre: "  " }],
    ];
    for (const [nom, p] of cas) {
      expect({ nom, zod: schemaCourbeSeries.safeParse(p).success }).toEqual({ nom, zod: valider(p).ok });
    }
  });

  it("b bis) écart voulu : un champ inconnu est refusé par Zod (strict), ignoré par valider", () => {
    const p = { ...base(), inconnu: 1 } as ParametresCourbeSeries;
    expect(schemaCourbeSeries.safeParse(p).success).toBe(false);
    expect(valider(p).ok).toBe(true);
  });

  it("c) le schéma se convertit en JSON Schema sans lever", () => {
    expect(() => z.toJSONSchema(schemaCourbeSeries)).not.toThrow();
  });

  it("définition : forme attendue du catalogue", () => {
    const d: DefinitionBrique = DEFINITION_COURBE_SERIES;
    expect(d.id).toBe("courbe-series");
    expect(d.famille).toBe("donnee");
    expect(d.toile).toBe(TOILES.graphique);
    expect(d.description.length).toBeLessThanOrEqual(140);
    expect(d.schema.safeParse(d.exemple).success).toBe(true);
  });

  it("d) ni l'id ni un alias ne reprend l'id ou un alias d'une pièce du catalogue", () => {
    const pris = new Set<string>();
    for (const def of Object.values(CATALOGUE_BRIQUES) as DefinitionBrique[]) {
      pris.add(normaliser(def.id));
      for (const a of def.alias) pris.add(normaliser(a));
    }
    for (const nom of [DEFINITION_COURBE_SERIES.id, ...DEFINITION_COURBE_SERIES.alias]) expect(pris.has(normaliser(nom))).toBe(false);
  });

  it("e) nombres et textes extraits, sans jamais lever", () => {
    expect(nombresCourbeSeries(EXEMPLE_COURBE_SERIES)).toEqual(EXEMPLE_COURBE_SERIES.series.flatMap((s) => s.valeurs));
    expect(nombresCourbeSeries(EXEMPLE_COURBE_SERIES)).toHaveLength(8);
    expect(nombresCourbeSeries(null)).toEqual([]);
    expect(nombresCourbeSeries({ series: [{ valeurs: [1, Number.NaN, "x", 2] }, null] })).toEqual([1, 2]);
    expect(textesCourbeSeries(EXEMPLE_COURBE_SERIES)).toEqual([
      EXEMPLE_COURBE_SERIES.titre,
      ...EXEMPLE_COURBE_SERIES.abscisses,
      ...EXEMPLE_COURBE_SERIES.series.map((s) => s.nom),
    ]);
    expect(textesCourbeSeries(undefined)).toEqual([]);
  });

  it("f) éteint = identique : non inscrite, consigne inchangée, aucun import", () => {
    expect(Object.keys(CATALOGUE_BRIQUES)).not.toContain("courbe-series");
    const avant = readFileSync(new URL("../plan-scenes/__fixtures__/consigne-avant-porte.txt", import.meta.url), "utf8");
    expect(consignePlan()).toBe(avant);
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (n === "node_modules") continue;
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(n) && n !== "definition-courbe-series.ts" && !c.split(sep).join("/").endsWith("definition-courbe-series.test.ts")) fichiers.push(c);
      }
    };
    parcourir(join(process.cwd(), "src"));
    parcourir(join(process.cwd(), "studio-rendu"));
    expect(fichiers.filter((f) => readFileSync(f, "utf8").includes("definition-courbe-series"))).toEqual([]);
  });
});
