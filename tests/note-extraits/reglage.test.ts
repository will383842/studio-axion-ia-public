import { describe, expect, it } from "vitest";
import { CLE_REGLAGE_NOTE_INTERET, SEUILS_PAR_DEFAUT, lireNoteInteret } from "@/briques/note-extraits";

const DEFAUTS = { garde: 60, peutEtre: 40, gardesMax: 8 };
const lecteur = (v: unknown) => async () => v;

describe("X4-07 réglage archiveExtraits.noteInteret", () => {
  it("la clé et les défauts sont ceux de la décision E4-2", () => {
    expect(CLE_REGLAGE_NOTE_INTERET).toBe("archiveExtraits.noteInteret");
    expect(SEUILS_PAR_DEFAUT).toEqual(DEFAUTS);
  });

  it("absent → éteint", async () => {
    expect(await lireNoteInteret(async (_id, defaut) => defaut)).toEqual({ actif: false, seuils: DEFAUTS });
  });

  it.each([["true"], [false], [1], [0], [null], [undefined], [{}], [{ actif: "true" }], [{ actif: false }]])("%j → éteint", async (v) => {
    expect((await lireNoteInteret(lecteur(v))).actif).toBe(false);
  });

  it("lecture en échec → éteint", async () => {
    expect((await lireNoteInteret(async () => { throw new Error("x"); })).actif).toBe(false);
  });

  it("true → allumé avec défauts", async () => {
    expect(await lireNoteInteret(lecteur(true))).toEqual({ actif: true, seuils: DEFAUTS });
  });

  it("{ actif: true } → allumé avec défauts ; seuils valides repris", async () => {
    expect(await lireNoteInteret(lecteur({ actif: true }))).toEqual({ actif: true, seuils: DEFAUTS });
    expect(await lireNoteInteret(lecteur({ actif: true, seuils: { garde: 70, peutEtre: 50, gardesMax: 5 } }))).toEqual({
      actif: true,
      seuils: { garde: 70, peutEtre: 50, gardesMax: 5 },
    });
  });

  it("seuils invalides → défauts", async () => {
    const mauvais = [
      { garde: 150, peutEtre: 40, gardesMax: 8 },
      { garde: 60, peutEtre: -1, gardesMax: 8 },
      { garde: 40, peutEtre: 60, gardesMax: 8 },
      { garde: 60, peutEtre: 40, gardesMax: 0 },
      { garde: 60, peutEtre: 40, gardesMax: 2.5 },
      { garde: "60", peutEtre: 40, gardesMax: 8 },
      { garde: 60, peutEtre: Number.NaN, gardesMax: 8 },
      { garde: 60 },
      "n'importe quoi",
    ];
    for (const seuils of mauvais) {
      expect(await lireNoteInteret(lecteur({ actif: true, seuils }))).toEqual({ actif: true, seuils: DEFAUTS });
    }
  });

  it("éteint → seuils toujours les défauts", async () => {
    expect(await lireNoteInteret(lecteur({ actif: false, seuils: { garde: 90, peutEtre: 80, gardesMax: 1 } }))).toEqual({ actif: false, seuils: DEFAUTS });
  });
});
