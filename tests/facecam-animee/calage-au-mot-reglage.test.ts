/**
 * GV-MD-03b : le réglage `facecamAnimee.calageAuMot` est lu par le service et passé aux outils de la chaîne v4.
 * Éteint ou absent (défaut) : les outils sont strictement ceux d'avant (aucune clé `calageAuMot`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const lire = vi.hoisted(() => vi.fn());
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/_commun")>()), lireParametre: lire }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));

import { outilsFacecamAnimee, PARAM_CALAGE_AU_MOT_FA } from "@/services/facecam-animee";

const outilsAvec = () =>
  outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);

describe("GV-MD-03b : réglage du calage au mot", () => {
  beforeEach(() => lire.mockReset());

  it("réglage allumé : les outils portent calageAuMot: true", async () => {
    lire.mockImplementation(async (id: string, defaut: unknown) => (id === PARAM_CALAGE_AU_MOT_FA ? true : defaut));
    expect((await outilsAvec()).calageAuMot).toBe(true);
  });

  it("réglage absent : calageAuMot absent, le reste des outils inchangé", async () => {
    lire.mockImplementation(async (_id: string, defaut: unknown) => defaut);
    const o = await outilsAvec();
    expect(o.calageAuMot).toBeUndefined();
    expect("calageAuMot" in o).toBe(false);
    expect(Object.keys(o).sort()).toEqual(["appelerRealisateur", "historique", "plafondClaudeAtteint", "rendre", "reperer", "transcrire", "videos"]);
  });

  it("réglage éteint, autre valeur ou lecture en échec : calageAuMot absent", async () => {
    for (const valeur of [false, "true", 1, null]) {
      lire.mockImplementation(async (id: string, defaut: unknown) => (id === PARAM_CALAGE_AU_MOT_FA ? valeur : defaut));
      expect("calageAuMot" in (await outilsAvec())).toBe(false);
    }
    lire.mockImplementation(async (id: string, defaut: unknown) => { if (id === PARAM_CALAGE_AU_MOT_FA) throw new Error("lecture"); return defaut; });
    expect("calageAuMot" in (await outilsAvec())).toBe(false);
  });
});
