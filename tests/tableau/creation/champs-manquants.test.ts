/** Lot C (audit du 11/11/2026) : le script refusé nomme TOUS les champs manquants d'un coup. */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { validerDonneesScript } = await import("@/services/tableau-creation");

describe("validerDonneesScript : champs manquants", () => {
  it("un texte de 8 mots sans autre champ : la phrase cite la série, la forme, le problème et le geste", () => {
    const r = validerDonneesScript({ texte: "Voici huit mots dits pour tester le contrôle ici." });
    expect(r).toEqual({ ok: false, phrase: "Il manque : la série, la forme, le problème, le geste." });
  });
  it("un seul manque : seul celui-là est cité", () => {
    const r = validerDonneesScript({ texte: "Voici huit mots dits pour tester le contrôle ici.", douleur: "Vous perdez du temps.", gesteMinute: "Ouvrez votre boîte mail." });
    expect(r).toMatchObject({ ok: false });
    expect((r as { phrase: string }).phrase).toMatch(/^Il manque : la série, la forme\.$/);
  });
});
