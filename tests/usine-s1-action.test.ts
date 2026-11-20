/** PR S1 · l'action serveur du bouton : jour et réseau visés transmis, rien d'autre ne part. Aucun réseau, aucune dépense. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));
const vu: { options?: unknown; visee?: unknown } = {};
vi.mock("@/services/usine-sujet", async () => {
  const porte = await import("@/services/usine-porte");
  return { ecrireSujetDeLUsine: vi.fn(async (_i: unknown, options: unknown) => { vu.options = options; vu.visee = porte.viseeUsineCourante(); return { id: "suj-1", rappelUsine: false }; }) };
});
const { retenirSujetSemaineAction } = await import("@/app/(studio)/calendrier/retenir-sujet");
const porte = await import("@/services/usine-porte");

const idee = { signature: "s", parts: { metier: "m", actualite: null }, metier: "M", taille: "TPE", douleur: "d", casUsage: "c" };

describe("action « Retenir ce sujet »", () => {
  beforeEach(() => { delete vu.options; delete vu.visee; delete process.env.USINE_URL; delete process.env.USINE_PORTE_SECRET; });
  const allumer = () => { process.env.USINE_URL = "https://usine.test"; process.env.USINE_PORTE_SECRET = "x".repeat(40); };

  it("reseaux = [reseau], typeContenu = video, dateVisee = jour ; la porte reçoit le même jour et réseau", async () => {
    allumer();
    const r = await retenirSujetSemaineAction(idee, "2026-11-24", "instagram");
    expect(r).toEqual({ ok: true, donnees: { id: "suj-1", rappelUsine: false } });
    expect(vu.options).toEqual({ reseaux: ["instagram"], typeContenu: "video", dateVisee: "2026-11-24" });
    expect(vu.visee).toEqual({ jour: "2026-11-24", reseau: "instagram" });
    expect(porte.viseeUsineCourante()).toBeUndefined();
  });
  it("Usine non reliée : refus, rien n'est écrit", async () => {
    const r = await retenirSujetSemaineAction(idee, "2026-11-24", "instagram");
    expect(r.ok).toBe(false);
    expect(vu.options).toBeUndefined();
  });
  it("jour ou réseau inconnu : refus, rien n'est écrit", async () => {
    allumer();
    expect((await retenirSujetSemaineAction(idee, "demain", "instagram")).ok).toBe(false);
    expect((await retenirSujetSemaineAction(idee, "2026-11-24", "myspace")).ok).toBe(false);
    expect(vu.options).toBeUndefined();
  });
});
