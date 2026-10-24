/**
 * ART-1 : interligne des titres en capitales. Défaut vu en production (23/10) : « IDÉE REÇUE, / RÉALITÉ », la cédille de « Ç » touchait
 * l'accent de « É » de la ligne du dessous. L'interligne d'un titre se calcule sur ses lignes (encre réelle d'Inter Display Black), et la
 * mesure du rendu compte toute collision « jambage de la ligne n contre accent de la ligne n + 1 ».
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ECART_ENCRE, ecartsEncre, INTERLIGNE_MIN, interligneCapitales } from "../../studio-rendu/compositions/visuels/commun/interligne-capitales";
import { collisionsInterligne } from "../../studio-rendu/compositions/visuels/commun/zones";

const DEFAUT = ["IDÉE REÇUE,", "RÉALITÉ"];
/** Interligne fixe d'avant ART-1. */
const ANCIEN_INTERLIGNE = 1.02;

describe("interligne des titres en capitales", () => {
  it("ROUGE : à l'ancien interligne fixe (1,02), la cédille de « Ç » touche l'accent de « É » (écart d'encre négatif)", () => {
    const [e] = ecartsEncre(DEFAUT, ANCIEN_INTERLIGNE);
    expect(e).toBeLessThan(0);
  });

  it("VERT : l'interligne calculé laisse au moins ECART_ENCRE entre la cédille et l'accent", () => {
    const interligne = interligneCapitales(DEFAUT);
    expect(interligne).toBeGreaterThan(ANCIEN_INTERLIGNE);
    for (const e of ecartsEncre(DEFAUT, interligne)) expect(e).toBeGreaterThanOrEqual(ECART_ENCRE - 1e-9);
  });

  it.each([
    [["À QUOI SERT,", "ÉCRIRE ?"]],
    [["QUI JUGE ;", "ÊTRE PRÊT"]],
    [["LA QUESTION (", "ÀPRÈS)"]],
    [["UN", "DEUX", "ÉTÉ ÇA", "ÉCOLE"]],
  ])("jambages et accents (Ç, Q, J, virgule, É, À) : %j garde un écart d'encre positif", (lignes) => {
    for (const e of ecartsEncre(lignes, interligneCapitales(lignes))) expect(e).toBeGreaterThanOrEqual(ECART_ENCRE - 1e-9);
  });

  it("des lignes sans accent ni jambage restent serrées (interligne minimal)", () => {
    expect(interligneCapitales(["RANGER", "LE BUREAU"])).toBe(INTERLIGNE_MIN);
  });

  it("un titre d'une ligne garde l'interligne minimal", () => {
    expect(interligneCapitales(["IDÉE REÇUE, RÉALITÉ"])).toBe(INTERLIGNE_MIN);
  });
});

describe("mesure du rendu : collisions entre lignes de titre", () => {
  it("compte une ligne dont l'encre du bas (jambage) touche l'encre du haut (accent) de la suivante", () => {
    expect(collisionsInterligne([[{ haut: 0, bas: 110 }, { haut: 108, bas: 200 }]])).toBe(1);
    expect(collisionsInterligne([[{ haut: 0, bas: 100 }, { haut: 104, bas: 200 }]])).toBe(0);
    expect(collisionsInterligne([[{ haut: 0, bas: 100 }, { haut: 101, bas: 200 }]], 2)).toBe(1);
  });

  it("la mesure de chaque rendu relève l'encre des lignes de titre et l'ajoute aux chevauchements", () => {
    const src = readFileSync(new URL("../../studio-rendu/compositions/visuels/mesure/MesureVisuelPage.tsx", import.meta.url), "utf8");
    expect(src).toContain("collisionsInterligne(");
    expect(src).toContain("encreDesTitres(");
  });
});
