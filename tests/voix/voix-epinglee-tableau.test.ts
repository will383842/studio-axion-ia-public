/** L1-05 PR 1 : voix épinglée du tableau animé. Voix fautive → refus sans aucun appel au fournisseur ; bonne voix → un seul. */
import { describe, expect, it, vi } from "vitest";
import { exigerVoixMaitreHeygen, VOIX_MAITRE_HEYGEN_ID, VoixNonEpingleeError } from "@/briques/voix-maitre";
import { branchementsReels, type chargerModulesReels } from "@/services/tableau-outils";

type Modules = Awaited<ReturnType<typeof chargerModulesReels>>;

function modules(idExterne: string | null) {
  const resoudreFournisseur = vi.fn(() => ({ mode: "simulation" }));
  const m = {
    commun: {
      depots: () => ({
        personnages: { obtenir: async () => ({ id: "p1", nom: "Moi" }) },
        voix: { lister: async () => [{ id: "v1", nom: "Ma voix", fournisseur: "heygen", statut: "pret" }] },
      }),
      ressourceActive: async () => (idExterne ? { idExterne } : null),
      lireParametre: async () => 1,
    },
    fournisseurs: { resoudreFournisseur },
    client: { renduSimule: () => false, obtenirServiceRendu: () => ({}) },
    credits: {}, montants: { TAUX_USD_EUR_PAR_DEFAUT: 1, centimes: (n: number) => n }, etalonnage: {}, garde: {},
  } as unknown as Modules;
  return { m, resoudreFournisseur };
}

describe("voix maître HeyGen", () => {
  it("accepte la voix maître", () => expect(() => exigerVoixMaitreHeygen(VOIX_MAITRE_HEYGEN_ID)).not.toThrow());
  it.each(["f22784b5aaaa", "F22784B5", "autre-voix", "", null, undefined])("refuse %s", (id) => {
    expect(() => exigerVoixMaitreHeygen(id)).toThrow(VoixNonEpingleeError);
  });
  it("le refus porte un message pour Will", () => {
    try { exigerVoixMaitreHeygen("x"); } catch (e) { expect((e as VoixNonEpingleeError).messagePourWill).toMatch(/rien n'a été dépensé/); }
  });
});

describe("tableau animé : branchements réels", () => {
  it.each(["f22784b5e0e04a2c9d3f5a6b7c8d9e0f", "voix-inconnue"])("voix %s : refus avant tout fournisseur", async (id) => {
    const { m, resoudreFournisseur } = modules(id);
    await expect(branchementsReels("p1", "v1", async () => m)).rejects.toBeInstanceOf(VoixNonEpingleeError);
    expect(resoudreFournisseur).not.toHaveBeenCalled();
  });
  it("bonne voix : le fournisseur de voix est résolu une seule fois (puis la voix d'essai est refusée, hors sujet ici)", async () => {
    const { m, resoudreFournisseur } = modules(VOIX_MAITRE_HEYGEN_ID);
    await expect(branchementsReels("p1", "v1", async () => m)).rejects.toThrow(/voix d'essai/);
    expect(resoudreFournisseur).toHaveBeenCalledTimes(1);
  });
});
