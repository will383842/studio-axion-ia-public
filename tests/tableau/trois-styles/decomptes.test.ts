/**
 * Vidéo v-b2d772d28b97 (17/10/2026) : la voix dit « Trois réflexes pour l'envoyer en dix minutes », le découpage a écrit
 * « Les réflexes pour l'envoyer rapidement ». Un DÉCOMPTE annoncé (« trois réflexes », « 3 étapes ») n'est pas un
 * chiffre à sourcer : il reste écrit. Les vraies quantités sans source (« en 10 minutes ») restent refusées.
 */
import { describe, expect, it } from "vitest";
import { CONSIGNE_DECOUPAGE, roleDecoupageTableau } from "../../../src/moteurs/montage-tableau/decoupage";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { decomptesRetires, sansDecomptes } from "../../../src/moteurs/montage-tableau/fidelite-texte";
import { contexteTableau, ficheDemonstration3Gestes } from "./fiches";

/** La fiche réaliste, la phrase de la page 3 (« Trois réflexes pour l'envoyer en dix minutes. » dit) écrite autrement. */
function avecPhrase(texte: string): FicheTableau {
  const f = ficheDemonstration3Gestes("ardoise");
  return { ...f, scenes: f.scenes.map((s) => (s.id === "s03" ? { ...s, elements: s.elements.map((e) => (e.id === "e04" && e.type === "ligne" ? { ...e, texte } : e)) } : s)) };
}
const refus = (f: FicheTableau) => {
  const v = validerFicheTableau(f, contexteTableau(f));
  return v.ok ? [] : v.problemes.map((p) => p.message);
};

describe("un décompte annoncé reste écrit", () => {
  it("« Trois réflexes pour l'envoyer. » et « 3 réflexes pour l'envoyer. » : acceptés", () => {
    expect(refus(avecPhrase("Trois réflexes pour l'envoyer."))).toEqual([]);
    expect(refus(avecPhrase("3 réflexes pour l'envoyer."))).toEqual([]);
  });
  it("« Les réflexes pour l'envoyer rapidement. » (ce qu'a écrit le découpage) : refusé, le décompte est retiré", () => {
    const r = refus(avecPhrase("Les réflexes pour l'envoyer rapidement."));
    expect(r.join(" ")).toMatch(/a retiré le décompte « trois réflexes » que la voix annonce/);
  });
  it("une vraie quantité sans source reste refusée (« en 10 minutes » hors de l'exemple illustratif)", () => {
    expect(refus(avecPhrase("Trois réflexes pour l'envoyer en 10 minutes.")).join(" ")).toMatch(/contient un chiffre sans élément chiffre sourcé/);
    expect(refus(avecPhrase("3 réflexes pour l'envoyer en 10 minutes.")).join(" ")).toMatch(/contient un chiffre sans élément chiffre sourcé/);
  });
  it("détection : décompte retiré, décompte en chiffres", () => {
    expect(decomptesRetires("Les réflexes pour l'envoyer rapidement.", "Trois réflexes pour l'envoyer en dix minutes.")).toEqual([{ dit: "Trois", valeur: 3, mot: "réflexes" }]);
    expect(decomptesRetires("Trois réflexes pour l'envoyer.", "Trois réflexes pour l'envoyer en dix minutes.")).toEqual([]);
    expect(decomptesRetires("3 étapes à suivre.", "Trois étapes à suivre.")).toEqual([]);
    // « dix minutes » n'est pas un décompte : la règle des chiffres retirés s'en occupe.
    expect(decomptesRetires("Des minutes gagnées.", "Dix minutes gagnées.")).toEqual([]);
    expect(sansDecomptes("3 étapes, 10 minutes")).toBe(" étapes, 10 minutes");
    expect(sansDecomptes("Les 5 erreurs")).toBe("Les  erreurs");
  });
  it("la consigne du découpage le dit (depuis la version 15)", () => {
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(15);
    expect(CONSIGNE_DECOUPAGE).toMatch(/Un DÉCOMPTE annoncé \(« Trois réflexes pour… », « 3 étapes », « Cinq erreurs »\) n'est pas un chiffre à sourcer/);
    expect(CONSIGNE_DECOUPAGE).toMatch(/jamais « Les réflexes pour… »/);
  });
});
