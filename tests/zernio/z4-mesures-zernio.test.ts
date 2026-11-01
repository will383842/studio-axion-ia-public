/**
 * z4 : statistiques Zernio. Lecture seule (GET /v1/analytics) via le client à liste fermée.
 * 202 = « pas encore prêtes », 424 et 402 = « non lisible », JAMAIS zéro. Données fictives « exemple ».
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { matiere, preparerMotDePasse } from "../helpers/g1a";
import { creerLecteurZernio, lecteurZernioEssai, valeursDepuisAnalyticsZernio } from "@/fournisseurs/mesures/zernio";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const mc = await import("@/services/mesures-completes");

const CORPS = { postId: "exemple-post-1", status: "published", analytics: { impressions: 1000, reach: 800, likes: 40, comments: 3, shares: 8, views: 900, lastUpdated: "2026-11-01T08:00:00Z" } };

describe("z4 · lecteur Zernio", () => {
  it("200 : vues, portée, réactions, commentaires, partages, partages ÷ portée", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: CORPS }]);
    const r = await creerLecteurZernio(client).lire("exemple-post-1");
    expect(r).toMatchObject({ etat: "lues", valeurs: { vues: 900, portee: 800, likes: 40, commentaires: 3, partages: 8, partagesParPortee: 1 } });
    expect(faux.appels).toHaveLength(1);
    expect(faux.appels[0].methode).toBe("GET");
    expect(faux.appels[0].url).toContain("/v1/analytics");
    expect(faux.appels[0].url).toContain("postId=exemple-post-1");
  });

  it("202 : pas encore prêtes (pas de chiffres)", async () => {
    const { client } = creerFauxClientZernio([{ statut: 202, corps: { message: "sync pending" } }]);
    expect(await creerLecteurZernio(client).lire("exemple-post-1")).toEqual({ etat: "pas-encore-pretes" });
  });

  it("424 et 402 : non lisible, jamais zéro", async () => {
    for (const statut of [424, 402]) {
      const { client } = creerFauxClientZernio([{ statut, corps: { error: "exemple" } }]);
      const r = await creerLecteurZernio(client).lire("exemple-post-1");
      expect(r.etat).toBe("non-lisible");
      expect(r).not.toHaveProperty("valeurs");
    }
  });

  it("200 sans chiffre, réponse illisible ou panne réseau : non lisible", async () => {
    expect(valeursDepuisAnalyticsZernio({ analytics: {} })).toBeNull();
    expect(valeursDepuisAnalyticsZernio(null)).toBeNull();
    const { client } = creerFauxClientZernio([{ statut: 200, corps: { postId: "x" } }]);
    expect((await creerLecteurZernio(client).lire("x")).etat).toBe("non-lisible");
    const b = creerFauxClientZernio([{ erreur: "reseau" }]);
    expect((await creerLecteurZernio(b.client).lire("x")).etat).toBe("non-lisible");
  });

  it("une statistique absente reste absente (pas de 0 inventé) ; un vrai 0 reste 0", () => {
    expect(valeursDepuisAnalyticsZernio({ analytics: { likes: 5 } })?.valeurs).toEqual({ likes: 5 });
    expect(valeursDepuisAnalyticsZernio({ analytics: { likes: 0 } })?.valeurs).toEqual({ likes: 0 });
  });

  it("lecteur d'essai : ne lit rien", async () => {
    expect(lecteurZernioEssai.mode).toBe("simulation");
    expect((await lecteurZernioEssai.lire("x")).etat).toBe("non-lisible");
  });
});

const MDP = "essai-z4-import";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

describe("z4 · importerMesures", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
  });

  async function publication(via: "zernio" | "buffer", id: string) {
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: ["tiktok", "linkedin"], formatId: "avocat" });
    const e = await gen.ecrireSujetSimule(s.id);
    if (!e.ok) throw new Error("écriture refusée");
    const tt = (await gen.obtenirSujet(s.id))!.versions.find((v) => v.variante.reseau === "tiktok")!.variante;
    await gen.validerVersions([tt.id]);
    await gen.rangerVideo("v-02", tt.id);
    await depots().publications.enregistrer({ id, videoId: "v-02", reseau: "tiktok", statut: "publiee", via, date: "2026-10-28T07:00:00.000Z", texte: "", idExterne: "exemple-post-1", varianteId: tt.id, creeLe: "2026-10-28T00:00:00Z", modifieLe: "2026-10-28T00:00:00Z" });
  }

  it("source « zernio » ; Buffer inchangé (son lecteur ne lit pas une publication Zernio)", async () => {
    await publication("zernio", "exemple-pub");
    const { client } = creerFauxClientZernio([{ statut: 200, corps: CORPS }]);
    const lireBuffer = vi.fn(async () => null);
    const b = await mc.importerMesures({ zernio: creerLecteurZernio(client), buffer: { mode: "reel", lire: lireBuffer }, visites: { mode: "simulation", lire: async () => null }, instant: new Date("2026-11-01T10:00:00Z") });
    expect(b.zernio).toMatchObject({ lues: 1, ajoutees: 1, pasPretes: 0, nonLisibles: 0 });
    expect(lireBuffer).not.toHaveBeenCalled();
    const p = (await depots().publications.obtenir("exemple-pub"))!;
    expect(p.releves![0]).toMatchObject({ source: "zernio" });
    expect(Object.values(p.releves![0].definitions).join(" ")).toContain("Zernio");
    expect(p.stats).toMatchObject({ vues: 900, portee: 800 });
  });

  it("202 / 424 / 402 : aucun relevé, aucun zéro, message écrit", async () => {
    for (const [statut, cle] of [[202, "pasPretes"], [424, "nonLisibles"], [402, "nonLisibles"]] as const) {
      reinitialiserDepots();
      await publication("zernio", "exemple-pub");
      const { client } = creerFauxClientZernio([{ statut, corps: {} }]);
      const b = await mc.importerMesures({ zernio: creerLecteurZernio(client), visites: { mode: "simulation", lire: async () => null } });
      expect(b.zernio[cle]).toBe(1);
      expect(b.zernio.ajoutees).toBe(0);
      expect(b.zernio.message).toBe(statut === 202 ? mc.LIBELLE_PAS_PRETES : mc.LIBELLE_NON_LISIBLE);
      const p = (await depots().publications.obtenir("exemple-pub"))!;
      expect(p.releves ?? []).toHaveLength(0);
      expect(p.stats).toBeUndefined();
    }
  });

  it("publication Buffer : relevé « buffer » comme avant", async () => {
    await publication("buffer", "exemple-buf");
    const b = await mc.importerMesures({ buffer: { mode: "reel", lire: async () => ({ idExterne: "x", valeurs: { vues: 10, likes: 1, commentaires: 0, partages: 0 } }) }, visites: { mode: "simulation", lire: async () => null } });
    expect(b.buffer.ajoutees).toBe(1);
    expect((await depots().publications.obtenir("exemple-buf"))!.releves![0].source).toBe("buffer");
  });
});
