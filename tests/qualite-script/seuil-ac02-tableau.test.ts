/** AC-02 (1re phrase finie avant N s) et refus de l'accroche (BORNES_PASSAGES) doivent dire la même chose (4e passe B2b). */
import { describe, expect, it } from "vitest";
import { CARACTERES_PAR_MOT_FR } from "@/domaine/debit-voix";
import { DEBIT_TABLEAU_MOTS_PAR_SEC } from "@/domaine/duree-tableau";
import { RECETTE_TABLEAU } from "@/domaine/qualite-script/recettes/tableau";
import { ACCROCHE_MAX_SEC, BORNES_PASSAGES, controlerAccroche } from "@/domaine/scripts-tableau-controles";
import { caracteresEn } from "@/domaine/duree-tableau";

describe("seuil AC-02 du tableau", () => {
  const maxMots = BORNES_PASSAGES[60].accroche.refus[1];
  const seuil = RECETTE_TABLEAU.ecarts?.premierePhraseFinSec?.valeur as number;
  it("l'accroche la plus longue acceptée (refus) finit sous le seuil, et le seuil n'est pas plus large que cette durée (à 0,1 s près)", () => {
    const dureeMax = maxMots / DEBIT_TABLEAU_MOTS_PAR_SEC;
    expect(seuil).toBeGreaterThanOrEqual(dureeMax);
    expect(seuil).toBeLessThan(dureeMax + 0.1 + 1e-9);
  });
  it("le refus de l'accroche ne dépasse pas les 12 mots de la 1re phrase (premierePhraseMotsMax)", () => {
    expect(maxMots).toBeLessThanOrEqual(12);
    expect(CARACTERES_PAR_MOT_FR).toBeGreaterThan(0);
  });
  it("AC-02 lit la MÊME constante que le refus de l'accroche : ACCROCHE_MAX_SEC = 4,4 s (≈ 74 caractères, 12 mots)", () => {
    expect(ACCROCHE_MAX_SEC).toBe(4.4);
    expect(seuil).toBe(ACCROCHE_MAX_SEC);
    expect(caracteresEn(ACCROCHE_MAX_SEC)).toBe(74);
    expect(maxMots).toBe(12);
  });
  it("une accroche de 74 caractères (AC-02 : 4,4 s) est acceptée, une de 75 est refusée", () => {
    const accroche = (n: number) => [{ dit: `${"a".repeat(n - 1)}.`, ecran: "Deux mots" }];
    const s = (n: number) => ({ accroche: accroche(n), douleur: [], promesse: [], etapes: [], exemple: { mentionEcran: "", phrases: [] }, aRetenir: [], appel: [] });
    expect(controlerAccroche(s(74)).filter((d) => d.message.includes(" s au plus"))).toEqual([]);
    expect(controlerAccroche(s(75)).map((d) => d.code)).toEqual(["accroche-longue"]);
  });
});
