/**
 * C2-U4 : le type facultatif `texteEcran` du style de sous-titres (contrat seul, aucune logique : U5 la branche : seul `surlignage` change).
 * Éteint = identique : un style avec `texteEcran` donne aujourd'hui exactement les mêmes `donneesCalque` que sans.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import { MARQUEURS, donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import type { ReglagesTexteEcran } from "@/domaine/texte-ecran";
import type { ReglagesTexteEcranRendu } from "@/briques/sous-titres/types-rendu";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { ValeurStyleSousTitres } from "@/domaine/types";

const PHRASE = "Votre patron peut-il lire vos mails ? Oui, mais jamais les mails personnels.";
const MOTS = PHRASE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(0.5 + i * 0.3).toFixed(3), finSec: +(0.5 + i * 0.3 + 0.26).toFixed(3) }));
const DUREE = +(MOTS.at(-1)!.finSec + 0.4).toFixed(3);

const calque = (style: ValeurStyleSousTitres) => {
  const segments = fabriquerSousTitres({ texte: PHRASE, dureeSec: DUREE, mots: MOTS, emphase: ["mails"], style, base: "karaoke", intensite: "equilibre" });
  return donneesCalque({ segments, base: "karaoke", style });
};

describe("C2-U4 : type texteEcran, contrat seul", () => {
  it("(a) sans texteEcran : aucune clé texteEcran dans la sortie", () => {
    expect(JSON.stringify(calque(STYLE_SOUS_TITRES_AVOCAT))).not.toContain("texteEcran");
  });
  it("(b) avec texteEcran.marqueur : donneesCalque identiques à sans le champ, SAUF la clé surlignage, qui vaut exactement MARQUEURS.terracotta", () => {
    const avec: ValeurStyleSousTitres = { ...STYLE_SOUS_TITRES_AVOCAT, texteEcran: { marqueur: { teinte: "terracotta" } } };
    const sans = calque(STYLE_SOUS_TITRES_AVOCAT);
    expect(sans).not.toHaveProperty("surlignage");
    const { surlignage, ...reste } = calque(avec);
    expect(surlignage).toEqual(MARQUEURS.terracotta);
    expect(reste).toEqual(sans);
  });
  it("(c) le type est ReglagesTexteEcran | undefined, et la copie du rendu est égale", () => {
    expectTypeOf<ValeurStyleSousTitres["texteEcran"]>().toEqualTypeOf<ReglagesTexteEcran | undefined>();
    expectTypeOf<ReglagesTexteEcranRendu>().toEqualTypeOf<ReglagesTexteEcran>();
  });
});
