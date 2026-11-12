/**
 * Face caméra : les mots importants (chiffres, mots forts) sont mis en valeur dans les sous-titres, par la règle unique
 * de la brique centrale. Le texte et les groupes ne changent pas.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { GROUPEMENT_FACECAM } from "@/briques/habillage-facecam";
import { grouperMots } from "@/briques/sous-titres/groupement";
import { marquerMotsImportants } from "@/briques/sous-titres/mots-importants";

const TEXTE =
  "nous parlons ici de ce que je vois tous les matins quand je m'assois devant mon ordinateur et que je regarde la liste. " +
  "Voilà ce qui se passe chez les gens que je rencontre dans mes rendez-vous : ils ont trois choses ouvertes en même temps. " +
  "Puis il y a un papier sur la table, un autre dans la boîte, et personne ne sait vraiment où se trouve le dernier. " +
  "Alors je prends mon stylo et je note le devis du voisin, puis celui des clients de la rue d'à côté, un par un, sans me presser.";

const mots: MotHorodate[] = TEXTE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(i * 0.3).toFixed(2), finSec: +(i * 0.3 + 0.28).toFixed(2) }));

describe("face caméra : mots importants", () => {
  const groupes = grouperMots(mots, GROUPEMENT_FACECAM);
  const { segments, source } = marquerMotsImportants(groupes, {});
  const valeurs = segments.flatMap((s) => s.mots).filter((m) => m.enValeur).map((m) => m.mot.replace(/[^\p{L}]/gu, "").toLowerCase());

  it("met en valeur « trois », « devis » et « clients » (repli transcription)", () => {
    expect(source).toBe("transcription");
    for (const attendu of ["trois", "devis", "clients"]) expect(valeurs).toContain(attendu);
  });

  it("ne change ni le texte ni les groupes, et respecte les plafonds", () => {
    expect(segments.map((s) => s.mots.map((m) => m.mot))).toEqual(groupes.map((s) => s.mots.map((m) => m.mot)));
    expect(segments.filter((s) => s.mots.some((m) => m.enValeur)).length).toBeLessThanOrEqual(Math.floor(segments.length * 0.4));
    for (const s of segments) expect(s.mots.filter((m) => m.enValeur).length).toBeLessThanOrEqual(2);
  });

  it("donne les mêmes mots quel que soit le format (même regroupement pour 9:16, 4:5 et 1:1)", () => {
    const [a, b, c] = ["9:16", "4:5", "1:1"].map(() => marquerMotsImportants(grouperMots(mots, GROUPEMENT_FACECAM), {}).segments.flatMap((s) => s.mots.filter((m) => m.enValeur).map((m) => m.mot)));
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("l'emphase du script passe avant la transcription", () => {
    const r = marquerMotsImportants(groupes, { emphaseScript: ["stylo"] });
    expect(r.source).toBe("script");
    expect(r.segments.flatMap((s) => s.mots).filter((m) => m.enValeur).map((m) => m.mot)).toEqual(["stylo"]);
  });
});
