import { describe, expect, it } from "vitest";
import { PROMOTION_MARGE_MIN_MS, verifierRequete, type RequeteZernio } from "@/fournisseurs/publication/zernio-client";
import { creerFauxClientZernio, postExemple, type ReponsePreparee } from "./aides/faux-zernio";

// Horloge fictive : 2026-11-01T08:00:00Z.
const MAINTENANT = Date.parse("2026-11-01T08:00:00Z");
const CLE_J = "studio-exemple-cle-journal";
const brouillon = { statut: 200, corps: { post: postExemple({ metadata: { origine: "studio", studioCle: CLE_J } }) } };
const OK_PUT: ReponsePreparee = { statut: 200, corps: { post: postExemple() } };
const promotion = (scheduledFor: string): RequeteZernio => ({ methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps: { isDraft: false, scheduledFor } });
const medias = (url: string): RequeteZernio => ({ methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps: { mediaItems: [{ type: "image", url }] } });

describe("z1c · bloquant 1 : PUT de promotion hors promouvoir()", () => {
  it.each([
    ["date passée", "2020-01-01T00:00:00Z"],
    ["date à moins de 30 min", "2026-11-01T08:29:59Z"],
    ["date future valable", "2026-11-03T10:00:00Z"],
  ])("PUT direct par requete() (%s) : chemin-refuse, aucun appel réseau", async (_nom, date) => {
    const { client, faux } = creerFauxClientZernio([OK_PUT]);
    await expect(client.requete(promotion(date))).rejects.toMatchObject({ code: "chemin-refuse", avantReseau: true });
    expect(faux.appels).toHaveLength(0);
  });

  it("verifierRequete refuse la forme promotion si la date est passée ou à moins de 30 min", () => {
    expect(() => verifierRequete(promotion("2020-01-01T00:00:00Z"), new Set(), MAINTENANT)).toThrow(/30 min/);
    const limite = new Date(MAINTENANT + PROMOTION_MARGE_MIN_MS - 1000).toISOString().replace(/\.000Z$/, "Z");
    expect(() => verifierRequete(promotion(limite), new Set(), MAINTENANT)).toThrow(/30 min/);
    expect(verifierRequete(promotion("2026-11-03T10:00:00Z"), new Set(), MAINTENANT)).toBe("promouvoir-post");
  });

  it("promouvoir() reste la seule voie : GET avant, PUT, GET après", async () => {
    const programme = { statut: 200, corps: { post: postExemple({ status: "scheduled", scheduledFor: "2026-11-03T10:00:00Z" }) } };
    const { client, faux } = creerFauxClientZernio([brouillon, OK_PUT, programme]);
    expect((await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: "2026-11-03T10:00:00Z" })).etat).toBe("programme");
    expect(faux.appels.map((a) => a.methode)).toEqual(["GET", "PUT", "GET"]);
  });
});

describe("z1c · bloquant 2 : PUT { mediaItems } hors promouvoir() et adresses des médias", () => {
  it("PUT { mediaItems } direct par requete() : chemin-refuse, aucun appel réseau", async () => {
    const { client, faux } = creerFauxClientZernio([OK_PUT]);
    await expect(client.requete(medias("https://media.exemple/a.jpg"))).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });

  it.each([["http", "http://media.exemple/a.jpg"], ["illisible", "pas une adresse"], ["avec identifiants", "https://u:p@media.exemple/a.jpg"]])(
    "verifierRequete refuse un média %s",
    (_nom, url) => {
      expect(() => verifierRequete(medias(url), new Set(), MAINTENANT)).toThrow(/https/);
    },
  );

  it("promouvoir() avec un média re-téléversé en http : refusé avant le PUT, aucun PUT envoyé", async () => {
    const { client, faux } = creerFauxClientZernio([brouillon, OK_PUT]);
    await expect(
      client.promouvoir({
        postId: "exemple-post-1",
        cleJournal: CLE_J,
        dateJournal: "2026-11-03T10:00:00Z",
        medias: { televerseLe: "2026-10-20T08:00:00Z", reteleverser: async () => [{ type: "image", url: "http://media.exemple/neuf.jpg" }] },
      }),
    ).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels.map((a) => a.methode)).toEqual(["GET"]);
  });
});
