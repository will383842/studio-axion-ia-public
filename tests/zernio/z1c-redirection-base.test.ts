import { describe, expect, it } from "vitest";
import { creerClientZernio, enteteIdempotenceStudio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { CLE_FICTIVE, creerFauxClientZernio, fetchInterdit, postExemple } from "./aides/faux-zernio";

const CLE = enteteIdempotenceStudio("d".repeat(64));
const BROUILLON = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };

describe("z1c · bloquant 3 : aucune redirection suivie", () => {
  it("API : redirect « error » transmis à fetch (lecture et écriture)", async () => {
    const { client, faux } = creerFauxClientZernio([
      { statut: 200, corps: { accounts: [] } },
      { statut: 201, corps: { post: postExemple() } },
    ]);
    await client.listerComptes();
    await client.creerPost(BROUILLON, CLE);
    expect(faux.appels.map((a) => a.redirect)).toEqual(["error", "error"]);
  });

  it("téléversement : redirect « error » transmis à fetch", async () => {
    const { client, faux } = creerFauxClientZernio([
      { statut: 200, corps: { uploadUrl: "https://stockage.exemple/x", publicUrl: "https://media.exemple/x" } },
      { statut: 200 },
    ]);
    const p = await client.preparerTeleversement({ filename: "a.png", contentType: "image/png" });
    await client.televerser({ uploadUrl: p.uploadUrl, corps: new Uint8Array([1]), contentType: "image/png", contentLength: 1 });
    expect(faux.appels).toHaveLength(2);
    expect(faux.appels[1].redirect).toBe("error");
    expect(faux.appels[1].entetes.Authorization).toBeUndefined();
  });

  it("une redirection refusée par fetch sur une écriture : à vérifier, lecture exigée, aucun renvoi", async () => {
    const { client, faux } = creerFauxClientZernio([{ erreur: "reseau", message: "unexpected redirect" }]);
    await expect(client.creerPost(BROUILLON, CLE)).rejects.toMatchObject({ code: "a-verifier" });
    await expect(client.creerPost(BROUILLON, CLE)).rejects.toMatchObject({ code: "lecture-requise" });
    expect(faux.appels).toHaveLength(1);
  });
});

describe("z1c · mineur 4 : baseUrl https sans identifiants", () => {
  it.each([
    ["http", "http://zernio.exemple/api"],
    ["identifiants", "https://u:p@zernio.exemple/api"],
    ["illisible", "zernio.exemple/api"],
    ["requête", "https://zernio.exemple/api?x=1"],
  ])("refusée (%s) : ErreurZernio acces, sans appel réseau", (_nom, baseUrl) => {
    const faux = fetchInterdit();
    let e: unknown;
    try {
      creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch, baseUrl });
    } catch (x) {
      e = x;
    }
    expect(e).toBeInstanceOf(ErreurZernio);
    expect((e as ErreurZernio).code).toBe("acces");
    expect(String((e as ErreurZernio).message)).not.toContain(CLE_FICTIVE);
    expect(faux.appels).toHaveLength(0);
  });

  it("https propre acceptée (et la base par défaut aussi)", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: { accounts: [] } }], { baseUrl: "https://zernio.exemple/api/" });
    await client.listerComptes();
    expect(faux.appels[0].url).toBe("https://zernio.exemple/api/v1/accounts");
    expect(() => creerClientZernio({ cle: CLE_FICTIVE, fetch: fetchInterdit().fetch })).not.toThrow();
  });
});
