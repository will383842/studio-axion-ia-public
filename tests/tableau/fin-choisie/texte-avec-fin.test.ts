/** FIX-TABLEAU-FIN-CHOISIE-b : « Ajouter cette fin à mon texte » (fonction pure). */
import { describe, expect, it } from "vitest";
import { CARACTERES_DITS_MAX_TABLEAU, caracteresDits } from "../../../src/domaine/duree-tableau";
import { texteAvecFin } from "../../../src/moteurs/montage-tableau/fin-choisie";

const FIN = "Écrivez PLAN en commentaire. Je vous l'envoie.";

describe("texteAvecFin", () => {
  it("(a) ajoute la phrase après le texte, une espace entre les deux", () => {
    expect(texteAvecFin("… en sont là.", FIN)).toBe(`… en sont là. ${FIN}`);
    expect(texteAvecFin("… en sont là.   \n", FIN)).toBe(`… en sont là. ${FIN}`);
  });
  it("(a) appelée deux fois : même résultat, pas de doublon", () => {
    const une = texteAvecFin("Un texte.", FIN);
    expect(texteAvecFin(une, FIN)).toBe(une);
  });
  it("la phrase déjà présente (casse, ponctuation) : texte inchangé", () => {
    const t = "Un texte. écrivez plan en commentaire !";
    expect(texteAvecFin(t, "Écrivez PLAN en commentaire.")).toBe(t);
  });
  it("(c) le texte ajouté compte dans les caractères dits (le refus de longueur existant s'applique)", () => {
    const t = texteAvecFin("Un texte court.", FIN);
    expect(caracteresDits(t)).toBeGreaterThan(caracteresDits("Un texte court."));
    expect(caracteresDits(t)).toBeLessThanOrEqual(CARACTERES_DITS_MAX_TABLEAU);
  });
});
