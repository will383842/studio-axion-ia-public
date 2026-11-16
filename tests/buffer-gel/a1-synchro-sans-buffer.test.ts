/**
 * LOT A1 — la synchronisation gelée n'appelle JAMAIS Buffer : ni comptes, ni états, ni relecture d'un envoi Buffer.
 * Contrôle : dégelé (réglage `false`), le même banc voit bien des appels.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CANAUX, fauxBuffer } from "../helpers/r1-buffer";

process.env.BUFFER_API_KEY = "cle-buffer-de-test-gel-0000";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const buf = await import("@/services/buffer");

const MIDI = new Date(Date.now() - 2 * 3600_000).toISOString();
let buffer: ReturnType<typeof fauxBuffer>;

async function semer() {
  const il_y_a_2h = new Date(Date.now() - 2 * 3600_000).toISOString();
  await ecrireParametre("buffer.canaux", { lusLe: il_y_a_2h, canaux: [{ id: CANAUX.instagram, nom: "Exemple IG", service: "instagram", deconnecte: false, organisationId: "org-exemple" }] });
  await depots().publications.enregistrer({ id: "pub-brouillon", creeLe: MIDI, modifieLe: MIDI, videoId: "v-15", reseau: "instagram", statut: "brouillon", via: "buffer", date: MIDI, texte: "Texte brouillon.", idExterne: "f1a2b3c4d5e6f7a8b9c0d001", etatEnvoi: "envoye", canalId: CANAUX.instagram } as never);
  await depots().publications.enregistrer({ id: "pub-averifier", creeLe: MIDI, modifieLe: MIDI, videoId: "v-15", reseau: "instagram", statut: "brouillon", via: "buffer", date: MIDI, texte: "Texte à vérifier.", etatEnvoi: "a-verifier", canalId: CANAUX.instagram, envoiCommenceLe: new Date(Date.now() - 40 * 60_000).toISOString() } as never);
}
const instantane = async () => JSON.stringify({ canaux: await buf.canauxEnregistres(), pubs: await depots().publications.lister(), notifs: await depots().notifications.lister() });

beforeAll(async () => {
  await preparerMotDePasse("essai-a1-synchro");
});
beforeEach(async () => {
  vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "");
  vi.unstubAllGlobals();
  reinitialiserDepots();
  reinitialiserRequete();
  buffer = fauxBuffer();
  vi.stubGlobal("fetch", buffer.appeler);
  await semer();
});
afterEach(() => vi.unstubAllEnvs());

describe("A1 · synchronisation gelée", () => {
  it("gelé : aucun appel à Buffer, comptes, publications et notifications inchangés", async () => {
    const avant = await instantane();
    await buf.synchroniserEtatsBuffer({ force: true });
    expect(buffer.appels.length).toBe(0);
    expect(await instantane()).toBe(avant);
    expect((await depots().publications.obtenir("pub-averifier"))!.modifieLe).toBe(MIDI);
  });

  it("CONTRÔLE : réglage `buffer.gele=false` → le banc voit des appels", async () => {
    await ecrireParametre("buffer.gele", false);
    await buf.synchroniserEtatsBuffer({ force: true });
    expect(buffer.appels.length).toBeGreaterThan(0);
  });
});
