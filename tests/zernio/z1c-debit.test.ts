import { describe, expect, it } from "vitest";
import { enteteIdempotenceStudio, LimiteurDebitZernio, type CorpsPostZernio } from "@/fournisseurs/publication/zernio-client";
import { creerFauxClientZernio, horlogeFictive, postExemple } from "./aides/faux-zernio";

const CLE = enteteIdempotenceStudio("b".repeat(64));
const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

function brouillon(platform: string, accountId = "exemple-compte-1", type?: "video" | "image"): CorpsPostZernio {
  return {
    content: "Bonjour",
    isDraft: true,
    platforms: [{ platform, accountId }],
    ...(type ? { mediaItems: [{ type, url: "https://media.exemple/x" }] } : {}),
  };
}

describe("z1c · débit : plafonds locaux, refus avant le réseau", () => {
  it("60 requêtes/min avec 2 comptes ou moins : la 61e est refusée sans appel réseau", async () => {
    const { client, faux, horloge } = creerFauxClientZernio(() => ({ statut: 200, corps: { posts: [] } }), { nombreComptes: 2 });
    for (let i = 0; i < 60; i++) await client.listerPosts();
    await expect(client.listerPosts()).rejects.toMatchObject({ code: "debit", reessayable: true });
    expect(faux.appels).toHaveLength(60);
    horloge.avancer(MINUTE);
    await client.listerPosts();
    expect(faux.appels).toHaveLength(61);
  });

  it("600 requêtes/min au-delà de 2 comptes (nombre lu par listerComptes)", async () => {
    const comptes = [1, 2, 3].map((n) => ({ _id: `exemple-compte-${n}`, platform: "instagram" }));
    const { client, faux } = creerFauxClientZernio((a) => (a.url.endsWith("/v1/accounts") ? { statut: 200, corps: { accounts: comptes } } : { statut: 200, corps: { posts: [] } }), { nombreComptes: 1 });
    await client.listerComptes();
    for (let i = 0; i < 100; i++) await client.listerPosts();
    expect(faux.appels).toHaveLength(101);
  });

  it("25 posts par heure et par compte ; un autre compte reste libre", async () => {
    const { client, faux, horloge } = creerFauxClientZernio(() => ({ statut: 201, corps: { post: postExemple() } }), { nombreComptes: 5 });
    for (let i = 0; i < 25; i++) await client.creerPost(brouillon("instagram"), CLE);
    await expect(client.creerPost(brouillon("instagram"), CLE)).rejects.toMatchObject({ code: "debit" });
    await client.creerPost(brouillon("instagram", "exemple-compte-2"), CLE);
    expect(faux.appels).toHaveLength(26);
    horloge.avancer(HEURE);
    await client.creerPost(brouillon("instagram"), CLE);
    expect(faux.appels).toHaveLength(27);
  });

  it("LinkedIn : 50 posts par jour et par compte", () => {
    const h = horlogeFictive();
    const l = new LimiteurDebitZernio({ nombreComptes: 5, maintenant: h.maintenant });
    for (let i = 0; i < 50; i++) {
      if (i > 0 && i % 25 === 0) h.avancer(HEURE);
      l.reserver("creer-post", brouillon("linkedin"));
    }
    h.avancer(2 * HEURE);
    expect(() => l.reserver("creer-post", brouillon("linkedin"))).toThrow(expect.objectContaining({ code: "debit" }));
    h.avancer(24 * HEURE);
    expect(() => l.reserver("creer-post", brouillon("linkedin"))).not.toThrow();
  });

  it("Instagram et Facebook : 100 posts par jour et par compte", () => {
    for (const reseau of ["instagram", "facebook"]) {
      const h = horlogeFictive();
      const l = new LimiteurDebitZernio({ nombreComptes: 5, maintenant: h.maintenant });
      for (let i = 0; i < 100; i++) {
        if (i > 0 && i % 25 === 0) h.avancer(HEURE);
        l.reserver("creer-post", brouillon(reseau));
      }
      h.avancer(HEURE);
      expect(() => l.reserver("creer-post", brouillon(reseau))).toThrow(expect.objectContaining({ code: "debit" }));
    }
  });

  it("TikTok : 15 vidéos et 15 photos par 24 h, comptées à part", () => {
    const h = horlogeFictive();
    const l = new LimiteurDebitZernio({ nombreComptes: 5, maintenant: h.maintenant });
    for (let i = 0; i < 15; i++) l.reserver("creer-post", brouillon("tiktok", "exemple-compte-1", "video"));
    expect(() => l.reserver("creer-post", brouillon("tiktok", "exemple-compte-1", "video"))).toThrow(expect.objectContaining({ code: "debit" }));
    h.avancer(HEURE); // vélocité horaire libérée
    for (let i = 0; i < 15; i++) l.reserver("creer-post", brouillon("tiktok", "exemple-compte-1", "image"));
    expect(() => l.reserver("creer-post", brouillon("tiktok", "exemple-compte-1", "image"))).toThrow(expect.objectContaining({ code: "debit" }));
  });

  it("un refus ne compte rien (tout ou rien)", () => {
    const h = horlogeFictive();
    const l = new LimiteurDebitZernio({ nombreComptes: 1, maintenant: h.maintenant });
    for (let i = 0; i < 60; i++) l.reserver("lister-posts");
    expect(() => l.reserver("creer-post", brouillon("instagram"))).toThrow();
    h.avancer(MINUTE);
    for (let i = 0; i < 25; i++) l.reserver("creer-post", brouillon("instagram"));
  });
});

describe("z1c · 429 : rejoué UNE fois après Retry-After, jamais en boucle", () => {
  it("429 puis 201 : une attente de Retry-After, puis succès", async () => {
    const { client, faux, horloge } = creerFauxClientZernio([
      { statut: 429, corps: { error: "trop" }, entetes: { "Retry-After": "7" } },
      { statut: 201, corps: { post: postExemple() } },
    ]);
    await client.creerPost(brouillon("instagram"), CLE);
    expect(horloge.attentes).toEqual([7000]);
    expect(faux.appels).toHaveLength(2);
    expect(faux.appels[1].entetes["Idempotency-Key"]).toBe(CLE);
  });

  it("429 deux fois : erreur de débit, deux appels seulement", async () => {
    const { client, faux } = creerFauxClientZernio([
      { statut: 429, entetes: { "Retry-After": "2" } },
      { statut: 429, entetes: { "Retry-After": "2" } },
      { statut: 201, corps: { post: postExemple() } },
    ]);
    await expect(client.creerPost(brouillon("instagram"), CLE)).rejects.toMatchObject({ code: "debit", statut: 429 });
    expect(faux.appels).toHaveLength(2);
  });

  it("Retry-After démesuré : aucun rejeu", async () => {
    const { client, faux, horloge } = creerFauxClientZernio([{ statut: 429, entetes: { "Retry-After": "3600" } }]);
    await expect(client.listerPosts()).rejects.toMatchObject({ code: "debit", attenteMs: 3_600_000 });
    expect(faux.appels).toHaveLength(1);
    expect(horloge.attentes).toEqual([]);
  });
});
