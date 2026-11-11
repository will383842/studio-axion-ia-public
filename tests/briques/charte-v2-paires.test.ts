/**
 * Toutes les paires (texte, fond) que le style « blocs/2 » déclare (TEXTE_SUR, TEXTE_SECOND_SUR, BLOC_SUR) doivent être
 * des paires de la charte Axion 2026 (`autoriserTexte`).
 */
import { describe, expect, it } from "vitest";
import { autoriserTexte } from "../../src/briques/charte/axion-2026";
import { BLOC_SUR, COULEURS_V2, FONDS_V2, TEXTES_SUR_ORANGE, TEXTE_SECOND_SUR, TEXTE_SUR } from "../../src/briques/tableau-scene/v2/charte";

/**
 * ESCALADE (Williams) : le noir sur l'orange #D97757 (5,90:1, `BLOC_SUR.encre`) n'est pas dans PAIRES_TEXTE de la charte.
 * Le fichier de la charte n'est pas modifié par ce lot ; l'exception est nommée ici et le test échoue si la charte la
 * règle (ou si la paire change), pour qu'on retire alors l'exception.
 */
const ESCALADEES = new Set([`${COULEURS_V2.encre}/${COULEURS_V2.orangeSurEncre}`]);

const fondDe = (f: (typeof FONDS_V2)[number]) => COULEURS_V2[f];

describe("blocs/2 : chaque paire (texte, fond) est dans la charte", () => {
  for (const f of FONDS_V2) {
    it(`TEXTE_SUR ${f}`, () => expect(autoriserTexte(TEXTE_SUR[f], fondDe(f))).toBe(true));
    it(`TEXTE_SECOND_SUR ${f}`, () => expect(autoriserTexte(TEXTE_SECOND_SUR[f], fondDe(f))).toBe(true));
    it(`BLOC_SUR ${f}`, () => {
      const { texte, fond } = BLOC_SUR[f];
      expect(autoriserTexte(texte, fond), "paire escaladée : voir ESCALADEES").toBe(!ESCALADEES.has(`${texte}/${fond}`));
    });
  }
  it("TEXTES_SUR_ORANGE : chaque texte est permis sur la terracotta", () => {
    for (const t of TEXTES_SUR_ORANGE) expect(autoriserTexte(t, COULEURS_V2.orange), t).toBe(true);
  });
});
