import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOURCES_RECENTES_RESEAU, valeursObjetsExtraits } from "@/briques/variete-commune/correspondances/extraits";

describe("correspondance extraits → axe objets", () => {
  it("deux plages d'une même source donnent une seule valeur", () => {
    expect(valeursObjetsExtraits(["extrait:archive-extraits-v1:p1", "extrait:archive-extraits-v1:p2"])).toEqual(["source:v1"]);
  });
  it("sans préfixe d'archive, l'élément sert d'identifiant", () => {
    expect(valeursObjetsExtraits(["extrait:el9:p1"])).toEqual(["source:el9"]);
  });
  it("clés mal formées ignorées", () => {
    expect(valeursObjetsExtraits(["extrait:", "autre:a:b", "", "extrait:a"])).toEqual([]);
  });
  it("sourceDe est respecté, repli si undefined", () => {
    const sourceDe = (id: string) => (id === "a" ? "S" : undefined);
    expect(valeursObjetsExtraits(["extrait:a:1", "extrait:b:1", "extrait:archive-extraits-c:1"], sourceDe)).toEqual(["source:S", "source:b", "source:c"]);
  });
  it("sortie triée et déterministe", () => {
    const e = ["extrait:z:1", "extrait:a:1", "extrait:m:1"];
    expect(valeursObjetsExtraits(e)).toEqual(["source:a", "source:m", "source:z"]);
    expect(valeursObjetsExtraits(e)).toEqual(valeursObjetsExtraits(e));
  });
  it("constante de fenêtre", () => {
    expect(SOURCES_RECENTES_RESEAU).toBe(3);
  });
  it("garde statique du fichier", () => {
    const src = readFileSync(join(__dirname, "../../src/briques/variete-commune/correspondances/extraits.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']@\/services\//);
    expect(src).not.toMatch(/from\s+["'][^"']*studio-rendu/);
    expect(src).not.toMatch(/\bnew Date\b|\bDate\.now\b|Math\.random/);
  });
});
