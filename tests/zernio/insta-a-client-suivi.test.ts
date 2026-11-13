/** INSTA-A · client « follow-status » : lecture seule, liste fermée, jamais de nom ni de pseudo. Données fictives. */
import { describe, expect, it } from "vitest";
import { creerClientZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { CLE_FICTIVE, creerFauxClientZernio, fetchInterdit } from "./aides/faux-zernio";

const CHEMIN = "/v1/accounts/exemple-compte-1/follow-status/exemple-user-1";

async function refus(req: Parameters<ReturnType<typeof creerClientZernio>["requete"]>[0]) {
  const faux = fetchInterdit();
  const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
  const e = await client.requete(req).then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(ErreurZernio);
  expect((e as ErreurZernio).code).toBe("chemin-refuse");
  expect(faux.appels).toHaveLength(0);
}

describe("insta-a · route follow-status", () => {
  it("accepte GET avec refresh=true, sans corps", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: { isFollower: true } }]);
    await client.requete({ methode: "GET", chemin: CHEMIN, query: { refresh: "true" } });
    expect(faux.appels).toHaveLength(1);
    expect(faux.appels[0].methode).toBe("GET");
    expect(faux.appels[0].url).toContain("/follow-status/exemple-user-1?refresh=true");
  });
  it.each(["POST", "PUT", "DELETE"] as const)("refuse %s sans réseau", async (methode) => {
    await refus({ methode, chemin: CHEMIN, ...(methode === "DELETE" ? {} : { corps: {} }) });
  });
  it("refuse tout autre paramètre, et refresh différent de true", async () => {
    await refus({ methode: "GET", chemin: CHEMIN, query: { refresh: "true", autre: "x" } });
    await refus({ methode: "GET", chemin: CHEMIN, query: { autre: "x" } });
    await refus({ methode: "GET", chemin: CHEMIN, query: { refresh: "false" } });
  });
  it("refuse un segment invalide", async () => {
    await refus({ methode: "GET", chemin: "/v1/accounts/exemple-compte-1/follow-status/a b", query: { refresh: "true" } });
    await refus({ methode: "GET", chemin: "/v1/accounts/exemple-compte-1/follow-status/", query: { refresh: "true" } });
  });
});

describe("insta-a · suiviInstagram", () => {
  it("n'envoie aucun corps ni idempotence, avec refresh=true", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: { isFollower: false } }]);
    await client.suiviInstagram("exemple-compte-1", "exemple-user-1");
    expect(faux.appels[0].corps).toBeUndefined();
    expect(faux.appels[0].entetes["Idempotency-Key"]).toBeUndefined();
    expect(faux.appels[0].url).toContain("refresh=true");
  });
  it("refuse un identifiant invalide avant le réseau", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    await expect(client.suiviInstagram("exemple-compte-1", "../x")).rejects.toBeInstanceOf(ErreurZernio);
    await expect(client.suiviInstagram("a/b", "exemple-user-1")).rejects.toBeInstanceOf(ErreurZernio);
    expect(faux.appels).toHaveLength(0);
  });
  const cas: [string, unknown, boolean | null][] = [
    ["vrai", { isFollower: true }, true],
    ["faux", { isFollower: false }, false],
    ["null", { isFollower: null }, null],
    ["absent", {}, null],
    ["chaîne", { isFollower: "true" }, null],
    ["corps illisible", "pas un objet", null],
  ];
  it.each(cas)("correspondance : %s", async (_n, corps, attendu) => {
    const { client } = creerFauxClientZernio([{ statut: 200, corps }]);
    expect(await client.suiviInstagram("exemple-compte-1", "exemple-user-1")).toEqual({ suit: attendu });
  });
  it("ne rend que « suit », même si la réponse contient username et name", async () => {
    const { client } = creerFauxClientZernio([{ statut: 200, corps: { isFollower: true, username: "pseudo_fictif", name: "Nom Fictif" } }]);
    const r = await client.suiviInstagram("exemple-compte-1", "exemple-user-1");
    expect(Object.keys(r)).toEqual(["suit"]);
    expect(JSON.stringify(r)).not.toMatch(/pseudo_fictif|Nom Fictif/);
  });
});
