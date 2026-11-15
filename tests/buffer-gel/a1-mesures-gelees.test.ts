/**
 * LOT A1 — chiffres : gelé, plus aucune lecture chez Buffer (même avec un lecteur injecté) ; Zernio inchangé.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { matiere, preparerMotDePasse } from "../helpers/g1a";
import { creerLecteurZernio } from "@/fournisseurs/mesures/zernio";
import { creerFauxClientZernio } from "../zernio/aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const { ecrireParametre } = await import("@/services/_commun");
const mc = await import("@/services/mesures-completes");

const MDP = "essai-a1-mesures";
const CORPS = { postId: "exemple-post-z", status: "published", analytics: { impressions: 1000, reach: 800, likes: 40, comments: 3, shares: 8, views: 900, lastUpdated: "2026-11-01T08:00:00Z" } };
const VISITES = { mode: "simulation" as const, lire: async () => null };

async function publications(lignes: [via: "zernio" | "buffer", id: string, idExterne: string][]) {
  await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
  const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: ["tiktok", "linkedin"], formatId: "avocat" });
  const e = await gen.ecrireSujetSimule(s.id);
  if (!e.ok) throw new Error("écriture refusée");
  const tt = (await gen.obtenirSujet(s.id))!.versions.find((v) => v.variante.reseau === "tiktok")!.variante;
  await gen.validerVersions([tt.id]);
  await gen.rangerVideo("v-02", tt.id);
  for (const [via, id, idExterne] of lignes) {
    await depots().publications.enregistrer({ id, videoId: "v-02", reseau: "tiktok", statut: "publiee", via, date: "2026-10-28T07:00:00.000Z", texte: "", idExterne, varianteId: tt.id, creeLe: "2026-10-28T00:00:00Z", modifieLe: "2026-10-28T00:00:00Z" });
  }
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "");
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});
afterEach(() => vi.unstubAllEnvs());

describe("A1 · chiffres, Buffer gelé", () => {
  it("gelé : le lecteur Buffer n'est jamais appelé ; message « gelé » ; Zernio lu", async () => {
    await publications([["buffer", "pub-buf", "exemple-post-b"], ["zernio", "pub-zer", "exemple-post-z"]]);
    const lire = vi.fn(async () => ({ idExterne: "x", valeurs: { vues: 10, likes: 1, commentaires: 0, partages: 0 } }));
    const { client } = creerFauxClientZernio([{ statut: 200, corps: CORPS }]);
    const b = await mc.importerMesures({ buffer: { mode: "reel", lire }, zernio: creerLecteurZernio(client), visites: VISITES, instant: new Date("2026-11-01T10:00:00Z") });
    expect(lire).not.toHaveBeenCalled();
    expect(b.buffer.lues).toBe(0);
    expect(b.buffer.ajoutees).toBe(0);
    expect(b.buffer.message).toContain("gelé");
    expect(b.zernio.ajoutees).toBe(1);
    expect((await depots().publications.obtenir("pub-buf"))!.releves ?? []).toHaveLength(0);
  });

  it("CONTRÔLE : dégelé, le lecteur Buffer est appelé", async () => {
    await ecrireParametre("buffer.gele", false);
    await publications([["buffer", "pub-buf", "exemple-post-b"]]);
    const lire = vi.fn(async () => ({ idExterne: "x", valeurs: { vues: 10, likes: 1, commentaires: 0, partages: 0 } }));
    const { client } = creerFauxClientZernio([]);
    const b = await mc.importerMesures({ buffer: { mode: "reel", lire }, zernio: creerLecteurZernio(client), visites: VISITES });
    expect(lire).toHaveBeenCalledTimes(1);
    expect(b.buffer.ajoutees).toBe(1);
    expect(b.buffer.message).toBeUndefined();
  });
});
