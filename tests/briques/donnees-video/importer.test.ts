/** G4-02 — importeur JSON / CSV (exemples FICTIFS). */
import { describe, expect, it } from "vitest";
import { importerTableauDeBord, TAILLE_MAX_OCTETS } from "../../../src/briques/donnees-video/importer";

const META = { titre: "Exemple fictif", periode: { debut: "2026-01-01", fin: "2026-01-31", libelle: "Janvier fictif" }, source: "Export fictif" };
const JSON_OK = { version: "tableau-de-bord.v1", ...META, indicateurs: [], series: [], comparaisons: [], alertes: [], calculs: [] };
const IND = "id;libelle;valeur;unite;precision;sens\n";
const messages = (r: ReturnType<typeof importerTableauDeBord>) => (r.ok ? [] : r.erreurs);

describe("importerTableauDeBord", () => {
  it("JSON valide minimal → ok", () => {
    const r = importerTableauDeBord(JSON.stringify(JSON_OK), "json");
    expect(r.ok).toBe(true);
  });
  it("JSON avec champ inconnu → refus", () => {
    const r = importerTableauDeBord(JSON.stringify({ ...JSON_OK, extra: 1 }), "json");
    expect(r.ok).toBe(false);
    expect(messages(r).join(" ")).toContain("Champ inconnu refusé");
  });
  it("JSON illisible", () => {
    expect(messages(importerTableauDeBord("{pas du json", "json"))).toEqual(["Fichier JSON illisible."]);
  });
  it("CSV indicateurs « ; » avec 12,5 → 12.5", () => {
    const r = importerTableauDeBord(`﻿${IND}vues;Vues;12,5;%;1;hausse-bonne\r\n`, "csv", META);
    expect(r.ok && r.donnee.indicateurs[0].valeur).toBe(12.5);
  });
  it("CSV série de 3 points → ok ; guillemets et « ; » dans une cellule", () => {
    const csv = 'serie;libelle;unite;x;valeur\ns1;"Vues; par jour";vues;"lun";10\ns1;"Vues; par jour";vues;mar;"1 240"\ns1;"Vues; par jour";vues;mer;3.5\n';
    const r = importerTableauDeBord(csv, "csv", META);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.donnee.series[0].points.map((p) => p.valeur)).toEqual([10, 1240, 3.5]);
  });
  it("série à 1 point → refus (G4-01)", () => {
    const r = importerTableauDeBord("serie;libelle;unite;x;valeur\ns1;Vues;vues;lun;10\n", "csv", META);
    expect(messages(r).join(" ")).toContain("au moins 2 points");
  });
  it("cellule « abc » → refus avec ligne et colonne", () => {
    const r = importerTableauDeBord(`${IND}vues;Vues;abc;%;1;hausse-bonne\n`, "csv", META);
    expect(messages(r)[0]).toContain("ligne 2, colonne 3");
  });
  it("« 1,234 » avec séparateur « , » → refus ambigu", () => {
    const r = importerTableauDeBord('id,libelle,valeur,unite,precision,sens\nvues,Vues,"1,234",%,1,hausse-bonne\n', "csv", META);
    expect(messages(r)[0]).toContain("ambigu");
  });
  it("« 1,234 » avec « ; » → refus ambigu aussi", () => {
    expect(messages(importerTableauDeBord(`${IND}vues;Vues;1,234;%;1;hausse-bonne\n`, "csv", META))[0]).toContain("ambigu");
  });
  it("« 1,234 % » et « 1,234% » avec « ; » → refus ambigu", () => {
    for (const v of ["1,234 %", "1,234%", "1.234 %"]) {
      expect(messages(importerTableauDeBord(`${IND}vues;Vues;${v};%;1;hausse-bonne\n`, "csv", META))[0]).toContain("ambigu");
    }
  });
  it("« 12,5 » avec séparateur « , » → refus ambigu", () => {
    const r = importerTableauDeBord('id,libelle,valeur,unite,precision,sens\nvues,Vues,"12,5",%,1,hausse-bonne\n', "csv", META);
    expect(messages(r)[0]).toContain("ambigu");
  });
  it("201 Ko → refus", () => {
    const r = importerTableauDeBord("a".repeat(TAILLE_MAX_OCTETS + 1), "json");
    expect(messages(r)).toEqual(["Fichier trop gros : 200 Ko au plus."]);
  });
  it("501 lignes → refus", () => {
    const csv = IND + Array.from({ length: 500 }, (_, i) => `i${i};L;1;%;0;hausse-bonne`).join("\n");
    expect(messages(importerTableauDeBord(csv, "csv", META))[0]).toContain("500 lignes au plus");
  });
  it("CSV sans meta → refus", () => {
    expect(messages(importerTableauDeBord(`${IND}vues;Vues;1;%;0;hausse-bonne\n`, "csv"))[0]).toContain("titre, la période et la source");
  });
  it("guillemet non refermé et en-têtes inconnus → refus, sans lever", () => {
    expect(importerTableauDeBord('a;b\n"x', "csv", META).ok).toBe(false);
    expect(messages(importerTableauDeBord("a;b\n1;2\n", "csv", META))[0]).toContain("En-têtes CSV inconnus");
  });
});
