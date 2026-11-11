import { describe, expect, it, vi } from "vitest";
import { mockHeaders } from "../helpers/next-mocks";
import { LONGUEUR_MAX_LIBELLE, TYPES_AUTOMATISATION } from "@/domaine/ciblage/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

describe("tableau animé : le prix pire cas compte la cible et le type (jamais sous-estimé)", () => {
  it.each(["courte", "complete"] as const)("méthode %s", async (m) => {
    const creation = await import("@/services/tableau-creation");
    const { estimerCoutScript, jetonsDuSocle } = await import("@/services/tableau-scripts");
    const { socleSansEchec, socleWillTableau } = await import("@/services/tableau-scripts/client-studio");
    const { memoireTableauAllumee } = await import("@/services/tableau-scripts/memoire");
    const typeLong = [...TYPES_AUTOMATISATION].sort((a, b) => b.libelle.length - a.libelle.length)[0].id;
    const demande = {
      serie: "formation", sujet: "x".repeat(160), public: "x".repeat(200),
      ciblage: { niveau: "secteur" as const, libelle: "x".repeat(LONGUEUR_MAX_LIBELLE), origine: "saisie" as const },
      typeAutomatisation: typeLong,
      vraiCas: { metier: "x".repeat(120), tache: "x".repeat(200), avant: "x".repeat(400), apres: "x".repeat(400), date: "x".repeat(40) },
      reseau: "linkedin", fin: { type: "diagnostic" as const }, envoi: "x".repeat(300),
    };
    const socle = await socleSansEchec(socleWillTableau)();
    const reel = estimerCoutScript(demande as never, undefined, jetonsDuSocle(socle), m, await memoireTableauAllumee()).pireCasUsd;
    expect(await creation.pireCasEcritureUsd(m)).toBeGreaterThanOrEqual(reel);
  });
});
