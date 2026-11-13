/**
 * GV2-18 · l'écran dit avant le lancement si la vidéo avocat sera réelle ou d'essai.
 * `etatMontageReelAction` : lecture seule, à partir de `decisionMontageReel` et `gesteMontageReel`. Aucun réseau.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const decision = vi.hoisted(() => ({ valeur: {} as Record<string, unknown> }));

vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));
vi.mock("@/services/reglages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/reglages")>()),
  decisionMontageReel: async () => decision.valeur,
}));

const { etatMontageReelAction } = await import("@/app/(studio)/nouvelle/[format]/actions");

beforeEach(() => {
  decision.valeur = { moteurId: "simulation", effectif: false, manque: null, doublePasPret: null, allume: false };
});

describe("etatMontageReelAction", () => {
  it("interrupteur éteint : pas réel, la phrase nomme les interrupteurs à allumer", async () => {
    const r = await etatMontageReelAction("avocat");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.donnees.reel).toBe(false);
    expect(r.donnees.phrase).toMatch(/Montage réel des vidéos/);
  });

  it("une connexion manque : la phrase la nomme", async () => {
    decision.valeur = { ...decision.valeur, manque: "la voix" };
    const r = await etatMontageReelAction("avocat");
    if (!r.ok) throw new Error("attendu : ok");
    expect(r.donnees).toMatchObject({ reel: false });
    expect(r.donnees.phrase).toMatch(/la voix/);
  });

  it("toutes les conditions réunies : montage réel", async () => {
    decision.valeur = { moteurId: "montage-avocat", effectif: true, manque: null, doublePasPret: null, allume: true };
    const r = await etatMontageReelAction("avocat");
    if (!r.ok) throw new Error("attendu : ok");
    expect(r.donnees.reel).toBe(true);
  });
});
