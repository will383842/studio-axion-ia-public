import { describe, expect, it } from "vitest";
import { creerClientZernio, enteteIdempotenceStudio, type FetchZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { CLE_FICTIVE, creerFauxClientZernio, horlogeFictive, postExemple, type ReponsePreparee } from "./aides/faux-zernio";

const CLE = enteteIdempotenceStudio("e".repeat(64));
const BROUILLON = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };
const CLE_J = "studio-exemple-cle-journal";

/** Fetch dont la réponse arrive (200) mais dont le corps se coupe pendant la lecture. */
function fetchCorpsCoupe(): { fetch: FetchZernio; appels: number } {
  const etat = { appels: 0 };
  const fetch: FetchZernio = async () => {
    etat.appels++;
    const flux = new ReadableStream<Uint8Array>({
      start(c) {
        const e = new Error("The operation was aborted due to timeout");
        e.name = "TimeoutError";
        c.error(e);
      },
    });
    return new Response(flux, { status: 200 });
  };
  return {
    fetch,
    get appels() {
      return etat.appels;
    },
  };
}

describe("z1c · mineur 5 : coupure pendant la lecture du corps", () => {
  it("écriture : ErreurZernio a-verifier, lecture exigée, aucune seconde écriture", async () => {
    const f = fetchCorpsCoupe();
    const h = horlogeFictive();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: f.fetch, maintenant: h.maintenant, attendre: h.attendre });
    const e = await client.creerPost(BROUILLON, CLE).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurZernio);
    expect((e as ErreurZernio).code).toBe("a-verifier");
    expect(client.lectureExigee()).toBe(true);
    await expect(client.creerPost(BROUILLON, CLE)).rejects.toMatchObject({ code: "lecture-requise" });
    expect(f.appels).toBe(1);
  });

  it("lecture : ErreurZernio indisponible (pas d'erreur brute), aucune lecture exigée", async () => {
    const f = fetchCorpsCoupe();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: f.fetch });
    await expect(client.listerComptes()).rejects.toMatchObject({ code: "indisponible" });
    expect(client.lectureExigee()).toBe(false);
  });
});

describe("z1c · mineur 6 : 5xx ou délai sur le PUT { mediaItems } → état à vérifier", () => {
  const demande = {
    postId: "exemple-post-1",
    cleJournal: CLE_J,
    dateJournal: "2026-11-03T10:00:00Z",
    medias: { televerseLe: "2026-10-20T08:00:00Z", reteleverser: async () => [{ type: "image", url: "https://media.exemple/neuf.jpg" }] },
  };
  const brouillon = { statut: 200, corps: { post: postExemple({ metadata: { origine: "studio", studioCle: CLE_J } }) } };
  it.each<[string, ReponsePreparee]>([
    ["5xx", { statut: 503 }],
    ["délai", { erreur: "delai" }],
  ])("%s : { etat: a-verifier } avec alerte, aucun PUT de promotion", async (_nom, rep) => {
    const { client, faux, journal } = creerFauxClientZernio([brouillon, rep]);
    const r = await client.promouvoir(demande);
    expect(r.etat).toBe("a-verifier");
    expect(journal.lignes.some((l) => l.startsWith("alerte") && l.includes("médias"))).toBe(true);
    expect(faux.appels.map((a) => a.methode)).toEqual(["GET", "PUT"]);
    expect(client.lectureExigee()).toBe(true);
  });
});

describe("z1c · mineur 7 : état « à vérifier » exposé et repris", () => {
  it("lectureExigee() suit l'état ; une lecture de posts le lève", async () => {
    const { client } = creerFauxClientZernio([{ statut: 502 }, { statut: 200, corps: { posts: [] } }]);
    expect(client.lectureExigee()).toBe(false);
    await expect(client.creerPost(BROUILLON, CLE)).rejects.toMatchObject({ code: "a-verifier" });
    expect(client.lectureExigee()).toBe(true);
    await client.listerPosts();
    expect(client.lectureExigee()).toBe(false);
  });

  it("client recréé avec l'état persisté : écriture refusée avant lecture, sans appel réseau", async () => {
    const { client, faux } = creerFauxClientZernio([], { lectureRequiseInitiale: true });
    expect(client.lectureExigee()).toBe(true);
    await expect(client.creerPost(BROUILLON, CLE)).rejects.toMatchObject({ code: "lecture-requise" });
    expect(faux.appels).toHaveLength(0);
  });
});

describe("z1c · mineur 8 : valeur de x-request-id", () => {
  it.each([
    ["vide", ""],
    ["trop longue", "a".repeat(65)],
    ["retour à la ligne", "abc\r\nAuthorization: x"],
    ["espaces", "a b"],
    ["caractères spéciaux", "abc;def"],
  ])("refusée (%s), sans appel réseau", async (_nom, valeur) => {
    const { client, faux } = creerFauxClientZernio([]);
    await expect(client.requete({ methode: "GET", chemin: "/v1/accounts", entetes: { "x-request-id": valeur } })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });

  it("forme permise transmise", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: { accounts: [] } }]);
    await client.requete({ methode: "GET", chemin: "/v1/accounts", entetes: { "X-Request-Id": "exemple-0123-ABC" } });
    expect(faux.appels[0].entetes["X-Request-Id"]).toBe("exemple-0123-ABC");
  });
});
