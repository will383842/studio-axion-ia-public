/**
 * BR-PRIX-FA-b : le prix affiché avant « Animer » compte le calage au mot et le téléphone QUAND ils sont allumés.
 * Chemin réel : `estimerFacecamAnimee` ; fournisseurs simulés, aucun appel payant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const lire = vi.hoisted(() => vi.fn());
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/_commun")>()), lireParametre: lire }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => undefined) }));
vi.mock("@/services/generation-claude", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/generation-claude")>()), taux: vi.fn(async () => 9.2) }));

import { estimerFacecamAnimee, outilsFacecamAnimee, PARAM_CALAGE_AU_MOT_FA, PARAM_PLAFOND_CLAUDE_FA } from "@/services/facecam-animee";
import { PARAM_TELEPHONE_VIDEO_FA } from "@/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video";

// Taux simulé ×10 : les options coûtent moins d'un centime par prise, l'arrondi au centime les cacherait.
const PRISES = [{ dureeSec: 60, motsTexte: 150 }];
// Plafond relevé dans le test seulement : au plafond réel (4 $) le pire cas est écrêté et ne montrerait pas la différence.
const regler = (valeurs: Record<string, unknown>) => lire.mockImplementation(async (id: string, defaut: unknown) => (id === PARAM_PLAFOND_CLAUDE_FA ? 100 : id in valeurs ? valeurs[id] : defaut));
const outilsAvec = () =>
  outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, planScenes: null, signer: { lecture: async (c: string) => c, depot: async (c: string) => c }, rendu: { soumettre: vi.fn(), etat: vi.fn() } } as never);

describe("BR-PRIX-FA-b : prix et options payantes", () => {
  beforeEach(() => lire.mockReset());

  it("(a) calage au mot allumé : le total dépasse celui du réglage absent", async () => {
    regler({});
    const base = await estimerFacecamAnimee(PRISES);
    regler({ [PARAM_CALAGE_AU_MOT_FA]: true });
    const avec = await estimerFacecamAnimee(PRISES);
    expect(avec.pireCasLotCentimesEur).toBeGreaterThan(base.pireCasLotCentimesEur);
  });

  it("(a) téléphone allumé : le total dépasse celui du réglage absent", async () => {
    regler({});
    const base = await estimerFacecamAnimee(PRISES);
    regler({ [PARAM_TELEPHONE_VIDEO_FA]: true });
    const avec = await estimerFacecamAnimee(PRISES);
    expect(avec.pireCasLotCentimesEur).toBeGreaterThan(base.pireCasLotCentimesEur);
  });

  it("(b) réglages absents, éteints ou en échec : estimation identique", async () => {
    regler({});
    const base = await estimerFacecamAnimee(PRISES);
    regler({ [PARAM_CALAGE_AU_MOT_FA]: false, [PARAM_TELEPHONE_VIDEO_FA]: "true" });
    expect(await estimerFacecamAnimee(PRISES)).toEqual(base);
    lire.mockImplementation(async (id: string, defaut: unknown) => { if (id === PARAM_CALAGE_AU_MOT_FA || id === PARAM_TELEPHONE_VIDEO_FA) throw new Error("lecture"); return id === PARAM_PLAFOND_CLAUDE_FA ? 100 : defaut; });
    expect(await estimerFacecamAnimee(PRISES)).toEqual(base);
  });

  it("(c) fabrication et estimation lisent la même valeur", async () => {
    for (const [cle, champ] of [[PARAM_CALAGE_AU_MOT_FA, "calageAuMot"], [PARAM_TELEPHONE_VIDEO_FA, "telephoneVideo"]] as const) {
      regler({});
      const [o0, e0] = [await outilsAvec(), await estimerFacecamAnimee(PRISES)];
      regler({ [cle]: true });
      const [o1, e1] = [await outilsAvec(), await estimerFacecamAnimee(PRISES)];
      expect(champ in o0).toBe(false);
      expect((o1 as unknown as Record<string, unknown>)[champ]).toBe(true);
      expect(e1.pireCasLotCentimesEur).toBeGreaterThan(e0.pireCasLotCentimesEur);
    }
  });
});
