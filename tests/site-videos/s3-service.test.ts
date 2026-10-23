/** S3.2 — vue « Sur le site », case à cocher, refus de publication (parcours étapes 1 à 4). */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const { ErreurStudio } = await import("@/services/_commun");
const { creerSiteFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
const VIDEO = "v-01";
beforeEach(async () => {
  await preparerBase();
  factice = creerSiteFactice({ secret: "secret-test-service" });
  injecterSiteFactice(factice);
});
afterEach(() => injecterSiteFactice(null));

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ErreurStudio) return e.code;
    throw e;
  }
  return "AUCUN_REFUS";
}

describe("S3.2 générateur éteint", () => {
  it("la vue n'est pas visible et publier est refusé (GENERATEUR_ETEINT), cocher aussi", async () => {
    expect(await site.vueSurLeSite(VIDEO)).toEqual({ visible: false });
    expect(await code(site.publierSurLeSite(VIDEO))).toBe("GENERATEUR_ETEINT");
    expect(await code(site.cocherSurLeSite(VIDEO, true))).toBe("GENERATEUR_ETEINT");
    expect(factice.appels.publier).toBe(0);
  });
});

describe("S3.2 générateur allumé", () => {
  beforeEach(async () => {
    await site.definirSiteGenerateur("avocat", true);
  });

  it("le bloc est visible, la case décochée, aucun état sur le site", async () => {
    const v = await site.vueSurLeSite(VIDEO);
    expect(v.visible).toBe(true);
    if (!v.visible) return;
    expect(v.choisie).toBe(false);
    expect(v.etat).toBeNull();
    expect(v.enLigne).toBe(false);
    expect(v.simulation).toBe(true);
    expect((await depots().kits.trouver((k) => k.videoId === VIDEO))?.site).toBeUndefined();
  });

  it("une vidéo qui n'est pas prête n'a pas de bloc", async () => {
    expect(await site.vueSurLeSite("v-05")).toEqual({ visible: false });
    expect(await code(site.cocherSurLeSite("v-05", true))).toBe("NON_PRETE");
  });

  it("publier sans avoir coché est refusé (NON_CHOISIE)", async () => {
    expect(await code(site.publierSurLeSite(VIDEO))).toBe("NON_CHOISIE");
    expect(factice.appels.publier).toBe(0);
  });

  it("cocher pose l'état « hors ligne » ; décocher le retire de la sélection", async () => {
    const e = await site.cocherSurLeSite(VIDEO, true);
    expect(e).toMatchObject({ choisie: true, etat: "hors-ligne", fichiersPublics: [] });
    const v = await site.vueSurLeSite(VIDEO);
    expect(v.visible && v.choisie).toBe(true);
    expect((await site.cocherSurLeSite(VIDEO, false)).choisie).toBe(false);
  });

  it("cocher exige la session", async () => {
    reinitialiserRequete();
    await expect(site.cocherSurLeSite(VIDEO, true)).rejects.toThrow();
  });

  it("cochée, la vidéo au passeport d'essai est refusée (CONTROLES) et le site n'est pas appelé", async () => {
    await site.cocherSurLeSite(VIDEO, true);
    const controles = await site.controlesDeLaVideo(VIDEO);
    const rouges = controles.controles.filter((c) => !c.ok && c.gravite === "bloquant").map((c) => c.code);
    expect(rouges).toContain("SITE-10");
    expect(rouges).toContain("SITE-05");
    let message = "";
    try {
      await site.publierSurLeSite(VIDEO);
    } catch (e) {
      expect(e).toBeInstanceOf(ErreurStudio);
      expect((e as InstanceType<typeof ErreurStudio>).code).toBe("CONTROLES");
      message = (e as Error).message;
    }
    expect(message).toContain("Aucun client nommé");
    expect(message).toMatch(/autres?\)/);
    expect(factice.appels.publier).toBe(0);
    expect(factice.appels.retirer).toBe(0);
    expect(factice.pages.size).toBe(0);
    // L'état reste « hors ligne » : rien n'est parti.
    expect((await depots().kits.trouver((k) => k.videoId === VIDEO))!.site?.etat).toBe("hors-ligne");
  });
});
