/**
 * GV-ST-05 : le raccord du tutoriel d'outil transmet au moteur le style de sous-titres choisi dans la Bibliothèque
 * (champs absents si non définis). Rien n'est appelé pour de vrai : stockage, voix et rendu sont simulés.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { servicesTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { commandeTutoriel } from "./doubles";

vi.mock("@/services/tableau-outils", () => ({
  TARIF_VOIX_CENTIMES_PAR_CARACTERE: 0,
  branchementsReels: async () => ({ voix: {}, montage: { rendu: () => ({}), signer: async () => ({ lectures: {}, depots: {} }) }, env: "test" }),
}));

beforeAll(async () => {
  await import("@/services/tutoriel-branchements");
});

const outilsDe = async (plus: Parameters<typeof commandeTutoriel>[0]) => {
  const o = await servicesTutoriel().outils!(commandeTutoriel(plus), "t1");
  expect(o).not.toBeNull();
  return o!;
};

describe("tutoriel : style de sous-titres de la Bibliothèque", () => {
  it("transmet le style choisi, la base et l'intensité", async () => {
    const o = await outilsDe({
      styles: { sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT }, decor: null, profilSon: null, lut: null, musique: null },
      sousTitres: { base: "karaoke", intensite: "equilibre" },
    });
    expect(o.sousTitres?.style).toEqual(STYLE_SOUS_TITRES_AVOCAT);
    expect(o.sousTitres?.base).toBe("karaoke");
    expect(o.sousTitres?.intensite).toBe("equilibre");
  });

  it("sans style : le champ style est absent (le défaut du code sert)", async () => {
    const o = await outilsDe({});
    expect(o.sousTitres).toBeDefined();
    expect(o.sousTitres && "style" in o.sousTitres).toBe(false);
    expect(o.sousTitres && "base" in o.sousTitres).toBe(false);
  });
});
