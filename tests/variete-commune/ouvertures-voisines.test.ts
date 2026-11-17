import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { NEUTRES, VOCABULAIRE } from "@/briques/variete-commune/vocabulaire";
import { LIBELLES_OUVERTURE, ouverturesVoisines } from "@/services/variete-commune/ouvertures-voisines";

const emp = (...ouverture: string[]): EmpreinteVideo => ({ version: "1", videoId: "v", formatId: "f", le: "x", axes: { ouverture } });

describe("ouverturesVoisines (X2-14b-a)", () => {
  it("voisines vides → []", () => {
    expect(ouverturesVoisines([])).toEqual([]);
  });
  it("5 voisines → seules les 3 premières comptent", () => {
    const v = [emp("question"), emp("affiche"), emp("horloge"), emp("titre-geant"), emp("objet-zoom")];
    expect(ouverturesVoisines(v)).toEqual([LIBELLES_OUVERTURE["question"], LIBELLES_OUVERTURE["affiche"], LIBELLES_OUVERTURE["horloge"]]);
  });
  it("max personnalisé", () => {
    expect(ouverturesVoisines([emp("question"), emp("affiche")], 1)).toHaveLength(1);
    expect(ouverturesVoisines([emp("question")], 0)).toEqual([]);
  });
  it("neutres, autre: et valeurs inconnues retirés", () => {
    expect(ouverturesVoisines([emp(...NEUTRES, "autre:x:y", "inconnue-xyz", "question")])).toEqual([LIBELLES_OUVERTURE["question"]]);
  });
  it("doublons retirés", () => {
    expect(ouverturesVoisines([emp("question"), emp("question", "affiche")])).toEqual([LIBELLES_OUVERTURE["question"], LIBELLES_OUVERTURE["affiche"]]);
  });
  it("voisine sans ouverture ignorée", () => {
    const sans: EmpreinteVideo = { version: "1", videoId: "v", formatId: "f", le: "x", axes: {} };
    expect(ouverturesVoisines([sans, emp("question")])).toEqual([LIBELLES_OUVERTURE["question"]]);
  });
  it("complétude : chaque valeur de VOCABULAIRE.ouverture a un libellé lisible", () => {
    for (const val of VOCABULAIRE.ouverture ?? []) expect(LIBELLES_OUVERTURE[val], val).toMatch(/\S/);
  });
  it("déterministe", () => {
    const v = [emp("question", "horloge"), emp("affiche")];
    expect(ouverturesVoisines(v)).toEqual(ouverturesVoisines(v));
  });
  it("aucun import de facecam-animee ni de motion-v4", () => {
    const src = readFileSync(resolve(__dirname, "../../src/services/variete-commune/ouvertures-voisines.ts"), "utf8");
    expect(src).not.toMatch(/facecam-animee["']/);
    expect(src).not.toMatch(/motion-v4/);
  });
});
