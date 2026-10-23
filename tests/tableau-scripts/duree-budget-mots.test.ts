/**
 * Le budget de mots (125 à 145 en 60 s) et la fourchette de durée des réseaux doivent s'accorder : un script au bas du
 * budget n'est pas refusé pour sa durée (4e passe B2b).
 */
import { describe, expect, it } from "vitest";
import { RESEAUX_SCRIPT, RESEAUX_SCRIPT_INFOS } from "@/domaine/scripts-tableau";
import { controlerDuree, MOTS_SCRIPT } from "@/domaine/scripts-tableau-controles";
import { TOLERANCE_DUREE } from "@/domaine/scripts-tableau-controles";

const motsCourts = (n: number) => Array.from({ length: n }, () => "midi").join(" ") + "."; // mots de 4 lettres : le cas le plus court

describe("durée et budget de mots", () => {
  it("125 mots courts (4 lettres) ne sont refusés pour durée dans AUCUN réseau", () => {
    for (const r of RESEAUX_SCRIPT) {
      expect(controlerDuree(motsCourts(MOTS_SCRIPT[60].min), r).filter((d) => d.eliminatoire), r).toEqual([]);
    }
  });
  it("la durée minimale des réseaux, avec sa tolérance, couvre le bas du budget", () => {
    for (const r of RESEAUX_SCRIPT) expect(RESEAUX_SCRIPT_INFOS[r].dureeMin * (1 - TOLERANCE_DUREE)).toBeLessThanOrEqual(36.5);
  });
});
