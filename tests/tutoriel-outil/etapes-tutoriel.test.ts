import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { etapesTutoriel } from "@/moteurs/montage-tutoriel-outil/etapes-tutoriel";

const CHEMIN = "src/moteurs/montage-tutoriel-outil/etapes-tutoriel.ts";
const motsDe = (script: string) =>
  script.trim().split(/\s+/).map((mot, i) => ({ mot, debutSec: i, finSec: i + 0.5 }));

describe("etapesTutoriel", () => {
  const script = "D'abord ouvrez l'outil. Ensuite cliquez sur Importer. Enfin exportez le fichier.";
  it("marqueurs : 3 étapes 1/3, 2/3, 3/3 aux bons mots", () => {
    const r = etapesTutoriel({ script, mots: motsDe(script), dureeSec: 60 });
    expect(r.etapes.map((e) => `${e.numero}/${e.total}`)).toEqual(["1/3", "2/3", "3/3"]);
    expect(r.etapes.map((e) => [e.premierMot, e.dernierMot])).toEqual([[0, 2], [3, 6], [7, 10]]);
    expect(r.etapes.map((e) => e.debutSec)).toEqual([0, 3, 7]);
    expect(r.etapes[0].libelle).toBe("Ouvrez l'outil");
    expect(r.chapitres).toEqual([
      { titre: "Ouvrez l'outil", debutSec: 0 },
      { titre: "Cliquez sur Importer", debutSec: 3 },
      { titre: "Exportez le fichier", debutSec: 7 },
    ]);
  });
  it("« puis » au milieu d'une phrase n'ouvre pas d'étape", () => {
    const s = "Ouvrez l'outil puis cliquez. Ensuite exportez. Enfin fermez.";
    expect(etapesTutoriel({ script: s, mots: motsDe(s), dureeSec: 60 }).etapes).toHaveLength(2);
  });
  it("numérotation « 1. » et « 2) »", () => {
    const s = "1. Ouvrez\n2) Cliquez\n3. Exportez";
    const r = etapesTutoriel({ script: s, mots: motsDe(s), dureeSec: 60 });
    expect(r.etapes.map((e) => e.libelle)).toEqual(["Ouvrez", "Cliquez", "Exportez"]);
  });
  it("sans marqueur : 2 paragraphes → 2 étapes", () => {
    const s = "Ouvrez l'outil et connectez-vous.\n\nCliquez sur Importer.";
    expect(etapesTutoriel({ script: s, mots: motsDe(s), dureeSec: 60 }).etapes).toHaveLength(2);
  });
  it("une seule phrase → []", () => {
    const r = etapesTutoriel({ script: "Ouvrez l'outil.", mots: [], dureeSec: 60 });
    expect(r).toEqual({ etapes: [], chapitres: [] });
  });
  it("12 marqueurs → 9 étapes couvrant tous les mots", () => {
    const s = Array.from({ length: 12 }, (_, i) => `Étape ${i + 1} fais le geste ${"x ".repeat(i % 3)}numéro ${i}.`).join(" ");
    const r = etapesTutoriel({ script: s, mots: motsDe(s), dureeSec: 120 });
    expect(r.etapes).toHaveLength(9);
    expect(r.etapes.every((e) => e.total === 9)).toBe(true);
    expect(r.etapes[0].premierMot).toBe(0);
    expect(r.etapes[8].dernierMot).toBe(motsDe(s).length - 1);
    r.etapes.slice(1).forEach((e, i) => expect(e.premierMot).toBe(r.etapes[i].dernierMot + 1));
  });
  it("mots absents → prorata sur la durée", () => {
    const r = etapesTutoriel({ script, mots: [], dureeSec: 110 });
    expect(r.etapes[0].debutSec).toBe(0);
    expect(r.etapes[1].debutSec).toBe(30);
    expect(r.etapes[2].debutSec).toBe(70);
    expect(r.etapes[2].finSec).toBe(110);
  });
  it("déterministe", () => {
    const a = etapesTutoriel({ script, mots: motsDe(script), dureeSec: 60 });
    expect(etapesTutoriel({ script, mots: motsDe(script), dureeSec: 60 })).toEqual(a);
  });
  it("< 30 s → aucun chapitre, étapes gardées", () => {
    const r = etapesTutoriel({ script, mots: motsDe(script), dureeSec: 20 });
    expect(r.chapitres).toEqual([]);
    expect(r.etapes).toHaveLength(3);
  });
  it("libellé ≤ 40 caractères", () => {
    const s = "D'abord ouvrez l'outil de gestion des projets en cours de la semaine. Ensuite fermez.";
    const r = etapesTutoriel({ script: s, mots: [], dureeSec: 60 });
    expect(r.etapes[0].libelle.length).toBeLessThanOrEqual(40);
  });
  it("garde statique : pas d'import @/ ni generation-claude", () => {
    const src = readFileSync(CHEMIN, "utf8");
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/generation-claude/);
  });
});
