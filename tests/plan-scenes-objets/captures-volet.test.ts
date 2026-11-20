/** N-05-VOLET-a-v20j — choix des 2 captures du volet avant/après : fonction pure, aucun importeur. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const { capturesDuVolet } = await import("@/briques/plan-scenes-objets/captures-volet");

describe("capturesDuVolet", () => {
  it("a) entrée absente ou trop courte → null", () => {
    for (const x of [[], [{ cle: "x" }], null, "x", {}, undefined]) expect(capturesDuVolet(x)).toBeNull();
  });

  it("b) deux clés identiques → null", () => {
    expect(capturesDuVolet([{ cle: "a" }, { cle: "a" }])).toBeNull();
  });

  it("c) trois captures → première et dernière", () => {
    expect(capturesDuVolet([{ cle: "a" }, { cle: "b" }, { cle: "c" }])).toEqual({ avant: "a", apres: "c" });
  });

  it("d) éléments mal formés ignorés", () => {
    expect(capturesDuVolet([{ cle: 3 }, { cle: "a" }, { cle: "  " }, null, { cle: " b " }])).toEqual({ avant: "a", apres: "b" });
    expect(capturesDuVolet([{ cle: 3 }, { cle: "a" }, null])).toBeNull();
  });

  it("e) l'entrée n'est pas modifiée", () => {
    const e = [{ cle: "a", largeur: 1 }, { cle: "b" }, { cle: "c" }];
    const avant = JSON.parse(JSON.stringify(e));
    capturesDuVolet(e);
    expect(e).toEqual(avant);
  });

  it("f) même entrée, même sortie", () => {
    const e = [{ cle: "a" }, { cle: "z" }];
    expect(capturesDuVolet(e)).toEqual(capturesDuVolet(e));
  });

  it("g) garde statique : aucun import de valeur, réglage, date, hasard, service ou moteur", () => {
    const t = readFileSync("src/briques/plan-scenes-objets/captures-volet.ts", "utf8");
    expect(t).not.toMatch(/^\s*import\s+(?!type\b)/m);
    expect(t).not.toMatch(/lireParametre|\bDate\b|Math\.random|@\/services|moteurs\//);
    expect(t.split("\n").length).toBeLessThanOrEqual(40);
  });
});
