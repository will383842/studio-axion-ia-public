/** INSTA-A · port : lireSuiviInstagram. Aucun envoi réel : faux fetch. Données fictives. */
import { describe, expect, it } from "vitest";
import { creerPortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { creerFauxClientZernio, type ReponsePreparee } from "./aides/faux-zernio";

const COMPTES = ["exemple-compte-1"];
const P = { idCompte: "exemple-compte-1", idUtilisateur: "exemple-user-1" };
function fabrique(reps: ReponsePreparee[]) {
  const b = creerFauxClientZernio(reps);
  return { faux: b.faux, port: creerPortInboxZernio({ client: b.client, comptesPermis: COMPTES }) };
}

describe("insta-a · port suivi", () => {
  it("compte non permis : panne définitive, 0 appel", async () => {
    const { port, faux } = fabrique([{ statut: 200, corps: { isFollower: true } }]);
    expect(await port.lireSuiviInstagram!({ ...P, idCompte: "exemple-autre" })).toEqual({ statut: "panne", definitive: true, code: "compte-non-permis" });
    expect(faux.appels).toHaveLength(0);
  });
  it("identifiant illisible : panne définitive, 0 appel", async () => {
    const { port, faux } = fabrique([]);
    for (const id of ["", "a b", "../x", "x".repeat(129)]) {
      expect(await port.lireSuiviInstagram!({ ...P, idUtilisateur: id })).toEqual({ statut: "panne", definitive: true, code: "identifiant-illisible" });
    }
    expect(faux.appels).toHaveLength(0);
  });
  it.each<[unknown, string]>([
    [{ isFollower: true }, "suit"],
    [{ isFollower: false }, "ne_suit_pas"],
    [{ isFollower: null }, "inconnu"],
    [{}, "inconnu"],
  ])("correspondance %j → %s", async (corps, statut) => {
    const { port } = fabrique([{ statut: 200, corps }]);
    expect(await port.lireSuiviInstagram!(P)).toEqual({ statut });
  });
  it("erreurs passagères : definitive false", async () => {
    for (const r of [{ statut: 500 }, { statut: 503 }, { erreur: "delai" as const }]) {
      const { port } = fabrique([r, r, r, r]);
      const res = await port.lireSuiviInstagram!(P);
      expect(res).toMatchObject({ statut: "panne", definitive: false });
    }
  });
  it("429 (débit) et envoi coupé : non définitives", async () => {
    const { port } = fabrique([{ statut: 429, corps: {}, entetes: { "retry-after": "1" } }, { statut: 429, corps: {}, entetes: { "retry-after": "1" } }]);
    expect(await port.lireSuiviInstagram!(P)).toMatchObject({ statut: "panne", definitive: false });
    const { client } = creerFauxClientZernio([]);
    const coupe = creerPortInboxZernio({ client: { ...client, suiviInstagram: async () => { throw new ErreurZernio("envoi-coupe", "coupé"); } }, comptesPermis: COMPTES });
    expect(await coupe.lireSuiviInstagram!(P)).toEqual({ statut: "panne", definitive: false, code: "envoi-coupe" });
  });
  it("erreurs définitives : 401, 403, 404", async () => {
    for (const s of [401, 403, 404]) {
      const { port } = fabrique([{ statut: s, corps: {} }]);
      expect(await port.lireSuiviInstagram!(P)).toMatchObject({ statut: "panne", definitive: true });
    }
  });
  it("erreur non Zernio : erreur-inconnue, non définitive", async () => {
    const { client } = creerFauxClientZernio([]);
    const port = creerPortInboxZernio({ client: { ...client, suiviInstagram: async () => { throw new Error("boom"); } }, comptesPermis: COMPTES });
    expect(await port.lireSuiviInstagram!(P)).toEqual({ statut: "panne", definitive: false, code: "erreur-inconnue" });
  });
  it("aucun nom ni identifiant dans le résultat", async () => {
    const { port } = fabrique([{ statut: 200, corps: { isFollower: true, username: "pseudo_fictif", name: "Nom Fictif" } }]);
    const r = await port.lireSuiviInstagram!(P);
    expect(JSON.stringify(r)).not.toMatch(/pseudo_fictif|Nom Fictif|exemple-user-1|exemple-compte-1/);
    const { port: p2 } = fabrique([{ statut: 403, corps: { error: "pseudo_fictif" } }]);
    expect(JSON.stringify(await p2.lireSuiviInstagram!(P))).not.toMatch(/pseudo_fictif|exemple-user-1/);
  });
});
