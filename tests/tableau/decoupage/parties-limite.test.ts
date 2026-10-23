/**
 * Les parties d'un script sont au plus 11 : 3 fixes (accroche, douleur, solution), 5 étapes au plus, l'exemple,
 * « à retenir » et l'appel. Au-delà, la donnée est refusée (relue sans parties), à la lecture du brouillon comme au découpage.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { PARTIES_MAX, partiesDuDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { lireParties } = await import("@/services/tableau-creation");

const IDS = ["accroche", "douleur", "solution", "etape", "etape", "etape", "etape", "etape", "exemple", "a-retenir", "appel", "appel"];
const parties = (n: number) => IDS.slice(0, n).map((partie, i) => ({ partie, libelle: partie, texte: `mot${i}`, ecran: [] }));
const texteDe = (n: number) => parties(n).map((p) => p.texte).join(" ");

describe("au plus 11 parties", () => {
  it("la borne est de 11", () => expect(PARTIES_MAX).toBe(11));

  it("11 parties : lues, au découpage comme à la lecture du brouillon", () => {
    expect(partiesDuDecoupage(parties(11))).toHaveLength(11);
    expect(lireParties(parties(11), texteDe(11))).toHaveLength(11);
  });

  it("12 parties : refusées, au découpage comme à la lecture du brouillon", () => {
    expect(partiesDuDecoupage(parties(12))).toBeUndefined();
    expect(lireParties(parties(12), texteDe(12))).toBeUndefined();
  });
});
