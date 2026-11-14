/**
 * L7-06-4-3 : le client ne choisit plus Buffer, le serveur route. « buffer » n'est accepté que si la configuration
 * (outilDeEnvoi) place le réseau chez Buffer ; sinon, et pour toute valeur inattendue, OUTIL_REFUSE sans aucun effet de bord.
 * Zernio explicite et absence d'outil passent comme avant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const appels = vi.hoisted(() => ({ buffer: vi.fn(), zernio: vi.fn(), journal: vi.fn(), kit: vi.fn(), fournisseur: vi.fn(), depots: vi.fn(), session: vi.fn(), routage: vi.fn() }));

vi.mock("@/services/auth", () => ({ exigerSession: appels.session }));
vi.mock("@/services/publications", () => ({
  envoyerVersBuffer: appels.buffer,
  envoyerReel: appels.zernio,
  obtenirKit: appels.kit,
  videoEnEssai: async () => false,
}));
vi.mock("@/services/routage-publication", () => ({ lireRoutage: async () => ({}), outilDeEnvoi: appels.routage }));
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
  appels.routage.mockResolvedValue("zernio");
  appels.kit.mockResolvedValue({ publiable: true });
  appels.fournisseur.mockReturnValue({});
  appels.buffer.mockResolvedValue({ publications: [{}], problemes: [] });
  appels.zernio.mockResolvedValue({ publications: [{}], problemes: [] });
});

describe("L7-06-4-3 · refus serveur de l'outil buffer", () => {
  function aucunEffet() {
    expect(appels.buffer).not.toHaveBeenCalled();
    expect(appels.zernio).not.toHaveBeenCalled();
    expect(appels.journal).not.toHaveBeenCalled();
    expect(appels.kit).not.toHaveBeenCalled();
    expect(appels.fournisseur).not.toHaveBeenCalled();
    expect(appels.depots).not.toHaveBeenCalled();
  }

  it("compte routé chez Zernio + « buffer » : OUTIL_REFUSE et aucun effet de bord", async () => {
    appels.routage.mockResolvedValue("zernio");
    const r = await envoyerParOutilAction("v-1", "instagram", DATE, { outil: "buffer" });
    expect(r).toMatchObject({ ok: false, code: "OUTIL_REFUSE" });
    aucunEffet();
  });

  it("configuration illisible (outil non relié) + « buffer » : OUTIL_REFUSE sans effet", async () => {
    appels.routage.mockRejectedValue(new Error("non relié"));
    expect(await envoyerParOutilAction("v-1", "instagram", DATE, { outil: "buffer" })).toMatchObject({ ok: false, code: "OUTIL_REFUSE" });
    aucunEffet();
  });

  it("compte routé chez Buffer par la configuration + « buffer » : envoi accepté (1 publication, 1 envoi Buffer)", async () => {
    appels.routage.mockResolvedValue("buffer");
    const r = await envoyerParOutilAction("v-1", "instagram", DATE, { outil: "buffer" });
    expect(r).toMatchObject({ ok: true, donnees: { nombre: 1 } });
    expect(appels.buffer).toHaveBeenCalledTimes(1);
    expect(appels.zernio).not.toHaveBeenCalled();
  });

  it.each([["Buffer"], [" buffer"], ["buffer "], ["BUFFER"], ["inconnu"], [""], [null], [0]])("valeur inattendue %j, même si la configuration dit Buffer : OUTIL_REFUSE sans effet", async (valeur) => {
    appels.routage.mockResolvedValue("buffer");
    const r = await envoyerParOutilAction("v-1", "instagram", DATE, { outil: valeur as never });
    expect(r).toMatchObject({ ok: false, code: "OUTIL_REFUSE" });
    aucunEffet();
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
