/**
 * Le prix du découpage annoncé est un vrai plafond, même pour un script qui arrive avec ses `parties` : le texte est
 * alors répété dans `<parties>` (`variableDecoupage`), ce que le prix maximal ne comptait pas.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { coutPireDecoupageUsd } from "../../../src/moteurs/montage-tableau/decoupage";
import { CARACTERES_DITS_MAX_TABLEAU } from "../../../src/domaine/duree-tableau";
import type { PartieScript } from "../../../src/domaine/scripts-tableau";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { coutDecoupageCentimes, entreeDecoupage, validerDonneesScript, SERIES_TABLEAU } = await import("@/services/tableau-creation");

const TAUX = 0.92;

describe("prix annoncé ≥ prix exigé, script réel avec parties", () => {
  it("le prix exigé ne dépasse pas le prix annoncé (script au plafond de caractères, onze parties, libellés longs)", () => {
    const phrases = Array.from({ length: 11 }, (_, i) => "mot ".repeat(Math.floor(CARACTERES_DITS_MAX_TABLEAU / 4 / 11)).trim() + (i === 10 ? "" : "."));
    const ids = ["accroche", "douleur", "solution", "etape", "etape", "etape", "etape", "etape", "exemple", "a-retenir", "appel"] as const;
    const parties: PartieScript[] = ids.map((partie, i) => ({ partie, libelle: "x".repeat(40), texte: phrases[i], ecran: [], ...(partie === "etape" ? { numero: i - 2 } : {}) }));
    const texte = parties.map((p) => p.texte).join(" ");
    const lu = validerDonneesScript({ texte, serieCode: SERIES_TABLEAU[0].code, structure: "erreur-corrigee", douleur: "x", gesteMinute: "x", finId: null, reseaux: ["tiktok"], parties });
    const donnees = lu.ok ? lu.donnees : ({ texte, serieCode: SERIES_TABLEAU[0].code, structure: "erreur-corrigee", douleur: "x", gesteMinute: "x", finId: null, reseaux: [], parties } as never);
    expect(donnees.parties?.length).toBe(11);
    const controle = { aujourdhui: "2026-01-01", sourcesChiffres: [], preuves: [], matieres: [] };
    const exige = Math.ceil(coutPireDecoupageUsd(entreeDecoupage(donnees, "v-prix", "b1", controle, [])) * 100 * TAUX - 1e-9);
    expect(coutDecoupageCentimes(TAUX, controle, [])).toBeGreaterThanOrEqual(exige);
  });
});
