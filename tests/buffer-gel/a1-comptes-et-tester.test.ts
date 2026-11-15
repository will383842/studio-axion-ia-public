/**
 * LOT A1 — « Tester » et la relecture des comptes refusent sans appel ; les comptes figés restent LUS (I3) ;
 * `passerProgrammee` reste exportée et garde son sens (I4).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CANAUX, fauxBuffer } from "../helpers/r1-buffer";

process.env.BUFFER_API_KEY = "cle-buffer-de-test-gel-0003";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const buf = await import("@/services/buffer");

const MDP = "essai-a1-comptes";
const LUS = { lusLe: "2026-11-01T08:00:00.000Z", canaux: [{ id: CANAUX.instagram, nom: "Exemple IG", service: "instagram", deconnecte: false, organisationId: "org-exemple" }] };
let buffer: ReturnType<typeof fauxBuffer>;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "");
  vi.unstubAllGlobals();
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  buffer = fauxBuffer();
  vi.stubGlobal("fetch", buffer.appeler);
  await ecrireParametre("buffer.canaux", LUS);
});
afterEach(() => vi.unstubAllEnvs());

describe("A1 · comptes et « Tester », Buffer gelé", () => {
  it("`testerBuffer()` → `BUFFER_GELE`, 0 appel, comptes intacts", async () => {
    await expect(buf.testerBuffer()).rejects.toMatchObject({ code: "BUFFER_GELE" });
    expect(buffer.appels.length).toBe(0);
    expect(await buf.canauxEnregistres()).toEqual(LUS);
  });

  it("`actualiserCanauxBuffer()` → `BUFFER_GELE`, 0 appel", async () => {
    await expect(buf.actualiserCanauxBuffer()).rejects.toMatchObject({ code: "BUFFER_GELE" });
    expect(buffer.appels.length).toBe(0);
  });

  it("`canauxEnregistres()` rend toujours la liste figée (I3)", async () => {
    expect(await buf.canauxEnregistres()).toEqual(LUS);
  });

  it("`vueBuffer()` : `gele:true`, comptes = ceux de la base, 0 appel", async () => {
    const v = await buf.vueBuffer();
    expect(v.gele).toBe(true);
    expect(v.comptes.map((c) => c.id)).toEqual([CANAUX.instagram]);
    expect(buffer.appels.length).toBe(0);
  });

  it("CONTRÔLE : dégelé, `vueBuffer().gele` est faux et « Tester » appelle Buffer", async () => {
    await ecrireParametre("buffer.gele", false);
    expect((await buf.vueBuffer()).gele).toBe(false);
    await buf.testerBuffer();
    expect(buffer.appels.length).toBeGreaterThan(0);
  });

  it("I4 : `passerProgrammee` met « programmée » et ne recule pas une vidéo « publiée »", async () => {
    await depots().videos.modifier("v-15", { etapeEditoriale: "validee" } as never);
    await buf.passerProgrammee("v-15");
    expect((await depots().videos.obtenir("v-15"))!.etapeEditoriale).toBe("programmee");
    await depots().videos.modifier("v-15", { etapeEditoriale: "publiee" } as never);
    await buf.passerProgrammee("v-15");
    expect((await depots().videos.obtenir("v-15"))!.etapeEditoriale).toBe("publiee");
  });
});
