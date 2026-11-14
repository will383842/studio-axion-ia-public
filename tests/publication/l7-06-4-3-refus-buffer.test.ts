/**
 * L7-06-4-3 : le serveur refuse un outil « buffer » demandé par le client pour un envoi (code OUTIL_REFUSE),
 * sans aucun effet de bord. Zernio explicite et absence d'outil passent comme avant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const appels = vi.hoisted(() => ({ buffer: vi.fn(), zernio: vi.fn(), journal: vi.fn(), kit: vi.fn(), fournisseur: vi.fn(), depots: vi.fn(), session: vi.fn() }));

vi.mock("@/services/auth", () => ({ exigerSession: appels.session }));
vi.mock("@/services/publications", () => ({
  envoyerVersBuffer: appels.buffer,
  envoyerReel: appels.zernio,
  obtenirKit: appels.kit,
  videoEnEssai: async () => false,
}));
vi.mock("@/services/journal-envoi", () => ({ journaliserEnvoi: appels.journal }));
vi.mock("@/fournisseurs", () => ({ fournisseurParId: appels.fournisseur }));
vi.mock("@/services/zernio", () => ({ envoiZernioAutorise: async () => true, publicationEditorialeAutorisee: async () => true, envoiCalendrierAutorise: async () => true }));
vi.mock("@/services/buffer", () => ({ canauxEnregistres: async () => null, lireModeBuffer: async () => "brouillon", marquerEnvoiVerifie: async () => undefined }));
vi.mock("@/services/_commun", async (original) => {
  const reel = await original<typeof import("@/services/_commun")>();
  return { ...reel, depots: () => {
    appels.depots();
    return { videos: { obtenir: async () => ({ estDemo: false }) } };
  } };
});

const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const DATE = "2099-01-01T10:00:00.000Z";

beforeEach(() => {
  Object.values(appels).forEach((f) => f.mockReset());
  appels.session.mockResolvedValue(undefined);
  appels.kit.mockResolvedValue({ publiable: true });
  appels.fournisseur.mockReturnValue({});
  appels.buffer.mockResolvedValue({ publications: [{}], problemes: [] });
  appels.zernio.mockResolvedValue({ publications: [{}], problemes: [] });
});

describe("L7-06-4-3 · refus serveur de l'outil buffer", () => {
  it("un « buffer » explicite est refusé (OUTIL_REFUSE) et aucun effet de bord n'a lieu", async () => {
    const r = await envoyerParOutilAction("v-1", "instagram", DATE, { outil: "buffer" });
    expect(r).toMatchObject({ ok: false, code: "OUTIL_REFUSE" });
    expect(appels.buffer).not.toHaveBeenCalled();
    expect(appels.zernio).not.toHaveBeenCalled();
    expect(appels.journal).not.toHaveBeenCalled();
    expect(appels.kit).not.toHaveBeenCalled();
    expect(appels.fournisseur).not.toHaveBeenCalled();
    expect(appels.depots).not.toHaveBeenCalled();
  });

  it("un « zernio » explicite passe comme avant", async () => {
    const r = await envoyerParOutilAction("v-1", "instagram", DATE, { outil: "zernio" });
    expect(r.ok).toBe(true);
    expect(appels.zernio).toHaveBeenCalledTimes(1);
    expect(appels.buffer).not.toHaveBeenCalled();
  });

  it("l'absence d'outil passe comme avant (chemin Zernio par défaut)", async () => {
    const r = await envoyerParOutilAction("v-1", "instagram", DATE, {} as never);
    expect(r.ok).toBe(true);
    expect(appels.zernio).toHaveBeenCalledTimes(1);
    expect(appels.buffer).not.toHaveBeenCalled();
  });
});
