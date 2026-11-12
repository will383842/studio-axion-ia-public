/** Relecture du lot C2+C3 : l'accroche retenue nomme la cible ; la série lancée depuis la page Idées n'est pas bloquée. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSIGNE_COURT_ANGLE, CONSIGNE_COURT_ANGLE_HORS_RECETTE } from "@/generateur/chaine-courte";

const lancerSerie = vi.fn(async () => ({ serie: { id: "ser-1", elements: [{ sort: "parti" }] }, plan: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
vi.mock("@/services/serie-ecriture", () => ({ lancerSerie, planSerie: vi.fn(), suiviSerie: vi.fn() }));

beforeEach(() => lancerSerie.mockClear());

describe("chaîne courte : l'accroche retenue nomme la cible (plan C2, chaine-courte.ts)", () => {
  it("la consigne commune demande de nommer la cible dans l'accroche retenue", () => {
    expect(CONSIGNE_COURT_ANGLE).toMatch(/accroche retenue NOMME la cible/);
  });
  it("le texte hors recette commune (avocat) n'est pas touché par cet ajout", () => {
    expect(CONSIGNE_COURT_ANGLE_HORS_RECETTE).not.toMatch(/accroche retenue NOMME la cible/);
  });
});

describe("lancerSerieAction : la page Idées n'a pas de choix de cible, la série n'est jamais bloquée pour autant", () => {
  it("sans cible, la série part (remarque « cible à préciser » au sujet, pas de refus)", async () => {
    const { lancerSerieAction } = await import("@/app/(studio)/ecrire/serie/actions");
    const r = await lancerSerieAction([{ texte: "Les relances" }], { reseaux: ["tiktok"], formatId: "face-camera", adresse: "vous", mode: "will", objectif: "notoriete" } as never, "cle-1");
    expect(r).not.toMatchObject({ code: "CIBLE_ABSENTE" });
    expect(lancerSerie).toHaveBeenCalledTimes(1);
  });
});
