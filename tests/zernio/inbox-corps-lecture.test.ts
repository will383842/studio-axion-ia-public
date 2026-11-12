/** Corps de lecture « inbox » : paramètres sortOrder et limit (refus avant le réseau). Données 100 % fictives. */
import { describe, expect, it } from "vitest";
import { verifierCorpsInbox } from "@/fournisseurs/publication/zernio-inbox-corps";

const COMPTE = "exemple-compte-1";
const verifier = (query: Record<string, string | number | boolean>) => () => verifierCorpsInbox("lire-messages", { corps: undefined, query: { accountId: COMPTE, ...query }, comptesPermis: [COMPTE] });

describe("lire-messages · sortOrder et limit", () => {
  it("valeurs valides acceptées", () => {
    const valides: Array<Record<string, string | number | boolean>> = [{ sortOrder: "asc" }, { sortOrder: "desc" }, { limit: 1 }, { limit: 100 }, { sortOrder: "desc", limit: 100, cursor: "suite-fictive" }, {}];
    for (const q of valides) expect(verifier(q)).not.toThrow();
  });
  it("sortOrder invalide refusé", () => {
    for (const v of ["DESC", "descendant", "", 1]) expect(verifier({ sortOrder: v })).toThrow(/sortOrder/);
  });
  it("limit hors bornes ou de mauvais type refusé", () => {
    for (const v of [0, 101, 1.5, -1, "100", true]) expect(verifier({ limit: v })).toThrow(/limit/);
  });
  it("clé inconnue refusée", () => {
    expect(verifier({ inconnue: "x" })).toThrow(/seuls accountId/);
    expect(verifier({ fields: "texte" })).toThrow(/seuls accountId/);
  });
});
