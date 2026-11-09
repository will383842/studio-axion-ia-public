/** Lot C3 : l'action de création refuse un sujet sans cible (CIBLE_ABSENTE) ; ailleurs, l'absence n'est jamais bloquante. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const lancerGeneration = vi.fn(async (_brief: unknown) => ({ scriptMaitreId: "suj-1", ok: true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
vi.mock("@/services/boucle-generation", () => ({ lancerGeneration }));

const base = { idee: "Les relances", reseaux: ["tiktok"], formatId: "face-camera" } as never;

beforeEach(() => lancerGeneration.mockClear());

describe("creerSujetAction : cible obligatoire", () => {
  it("refuse sans cible avec le code CIBLE_ABSENTE et rien n'est lancé", async () => {
    const { creerSujetAction } = await import("@/app/(studio)/ecrire/sujets/actions");
    const r = await creerSujetAction(base);
    expect(r).toMatchObject({ ok: false, code: "CIBLE_ABSENTE", message: "Choisissez à qui parle la vidéo." });
    expect(lancerGeneration).not.toHaveBeenCalled();
  });
  it("refuse une cible vide ou de plus de 80 caractères", async () => {
    const { creerSujetAction } = await import("@/app/(studio)/ecrire/sujets/actions");
    for (const libelle of ["   ", "x".repeat(81), "a\nb"]) {
      const r = await creerSujetAction({ ...(base as object), ciblage: { niveau: "metier", libelle, origine: "saisie" } } as never);
      expect(r).toMatchObject({ ok: false, code: "CIBLE_ABSENTE" });
    }
    expect(lancerGeneration).not.toHaveBeenCalled();
  });
  it("accepte une cible valide, la nettoie et lance l'écriture", async () => {
    const { creerSujetAction } = await import("@/app/(studio)/ecrire/sujets/actions");
    const r = await creerSujetAction({ ...(base as object), ciblage: { niveau: "metier", libelle: "  Plombier ", origine: "saisie" }, typeAutomatisation: "devis-factures" } as never);
    expect(r).toMatchObject({ ok: true });
    const brief = lancerGeneration.mock.calls[0]![0] as { ciblage: { libelle: string; origine: string }; typeAutomatisation: string };
    expect(brief.ciblage).toEqual({ niveau: "metier", libelle: "Plombier", origine: "saisie" });
    expect(brief.typeAutomatisation).toBe("devis-factures");
  });
  it("ignore un type d'automatisation inconnu (À classer)", async () => {
    const { creerSujetAction } = await import("@/app/(studio)/ecrire/sujets/actions");
    await creerSujetAction({ ...(base as object), ciblage: { niveau: "taille", libelle: "TPE", origine: "saisie" }, typeAutomatisation: "n-importe-quoi" } as never);
    expect((lancerGeneration.mock.calls[0]![0] as { typeAutomatisation?: string }).typeAutomatisation).toBeUndefined();
  });
});
