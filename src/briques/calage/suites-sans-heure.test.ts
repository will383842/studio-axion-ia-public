import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { etalerSuitesSansHeure, horodaterMotsPrononces, reporterHorodatages, type TexteVoix } from "./report";
import { appliquerAlignement } from "./alignement";

const m = (mot: string, debutSec: number, finSec: number): MotHorodate => ({ mot, debutSec, finSec });

/** Aucun mot de durée nulle ou négative, débuts strictement croissants. */
function verifier(mots: MotHorodate[]) {
  mots.forEach((x, k) => {
    expect(x.finSec - x.debutSec, `durée de « ${x.mot} »`).toBeGreaterThan(0);
    if (k) expect(x.debutSec, `début de « ${x.mot} »`).toBeGreaterThan(mots[k - 1].debutSec);
  });
}

describe("étalement des suites de mots sans heure", () => {
  it("une suite entre deux voisins se partage l'intervalle, les mots bien calés ne bougent pas", () => {
    const r = etalerSuitesSansHeure([m("a", 0, 1), { ...m("pas", 0, 0), sansHeure: true }, { ...m("un", 0, 0), sansHeure: true }, { ...m("jour", 0, 0), sansHeure: true }, m("b", 2, 3)]);
    expect(r[0]).toEqual(m("a", 0, 1));
    expect(r[4]).toEqual(m("b", 2, 3));
    expect(r[1].debutSec).toBe(1);
    expect(r[3].finSec).toBeCloseTo(2, 3);
    verifier(r);
  });

  it("pas de place : la suite prend sur le mot précédent (ou suivant en tête)", () => {
    const fin = etalerSuitesSansHeure([m("a", 1, 1.4), { ...m("x", 0, 0), sansHeure: true }, { ...m("y", 0, 0), sansHeure: true }]);
    verifier(fin);
    expect(fin[0].debutSec).toBe(1);
    const tete = etalerSuitesSansHeure([{ ...m("x", 0, 0), sansHeure: true }, { ...m("y", 0, 0), sansHeure: true }, m("a", 0, 0.5)]);
    verifier(tete);
    expect(tete[2].finSec).toBeCloseTo(0.5, 3);
  });

  it("sans aucun mot horodaté : tous les mots reçoivent une durée", () => {
    verifier(etalerSuitesSansHeure([{ ...m("x", 0, 0), sansHeure: true }, { ...m("y", 0, 0), sansHeure: true }]));
  });
});

describe("horodaterMotsPrononces : mots non retrouvés", () => {
  const prononces = ["Voici", "pas", "un", "jour", "fin"];
  const renvoyes = [m("voici", 0, 0.75), m("fin", 0.8, 1.2)];

  it("avec l'option : aucun mot de durée nulle, débuts croissants", () => {
    const r = horodaterMotsPrononces(prononces, renvoyes, { etalerSansHeure: true });
    expect(r.map((x) => x.mot)).toEqual(prononces);
    verifier(r);
  });

  it("SANS l'option : résultat identique à l'ancien (garde du rendu validé « ? Deux, »)", () => {
    const mots = ["Un,", "?", "Deux,", "?", "Trois,"];
    const r = horodaterMotsPrononces(mots, [m("un", 0, 0.3), m("deux", 0.5, 0.8), m("trois", 1, 1.3)]);
    expect(r).toEqual([m("Un,", 0, 0.3), m("?", 0.3, 0.5), m("Deux,", 0.5, 0.8), m("?", 0.8, 1), m("Trois,", 1, 1.3)]);
  });

  it("sonde du report « explique comment contester… » : 8 mots non alignés sur 24, aucun mot de durée nulle", () => {
    const dits = "Maître je vous explique comment contester une amende reçue la semaine dernière avant que le délai ne soit dépassé par le service concerné ce matin".split(" ").slice(0, 24);
    const alignes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter((i) => i % 3 !== 2));
    const renv = dits.flatMap((mot, i) => (alignes.has(i) || i > 15 ? [m(mot.toLowerCase(), i * 0.4, i * 0.4 + 0.35)] : []));
    const r = horodaterMotsPrononces(dits, renv, { etalerSansHeure: true });
    expect(r).toHaveLength(dits.length);
    verifier(r);
  });
});

describe("reporterHorodatages : segment sans texte dit", () => {
  const texte: TexteVoix = {
    texte: "a b c",
    motsValides: ["V0", "V1", "V2", "V3", "V4", "V5"].map((mot, index) => ({ mot, segmentId: `s${index}`, index })),
    motsPrononces: ["a", "b", "c"],
    groupes: [
      { debut: 0, fin: 1, debutPrononce: 0, finPrononce: 0 }, // en tête
      { debut: 1, fin: 2, debutPrononce: 0, finPrononce: 1 },
      { debut: 2, fin: 3, debutPrononce: 1, finPrononce: 1 }, // au milieu
      { debut: 3, fin: 4, debutPrononce: 1, finPrononce: 2 },
      { debut: 4, fin: 5, debutPrononce: 2, finPrononce: 3 },
      { debut: 5, fin: 6, debutPrononce: 3, finPrononce: 3 }, // en fin
    ],
  };
  it("aucun mot perdu, aucune durée négative ou nulle", () => {
    const r = reporterHorodatages(texte, [m("a", 1, 1.4), m("b", 1.4, 1.8), m("c", 2, 2.5)]);
    expect(r.map((x) => x.mot)).toEqual(["V0", "V1", "V2", "V3", "V4", "V5"]);
    expect(r.map((x) => x.index)).toEqual([0, 1, 2, 3, 4, 5]);
    verifier(r);
  });
});

describe("appliquerAlignement : mots non alignés par l'aligneur", () => {
  it("aucun mot calé de durée nulle", () => {
    const voix = "un deux trois quatre cinq six sept huit".split(" ").map((mot, i) => m(mot, i * 0.5, i * 0.5 + 0.45));
    const calage = voix.map((x, i) => ({ ...x, aligne: i !== 3 && i !== 4 }));
    const r = appliquerAlignement(voix, { mots: calage, motsNonAlignes: 2, modele: "test" } as never, 4.5);
    expect(r.rapport.source).toBe("aligneur");
    verifier(r.mots);
  });
});
