/** Finitions · relectures #154 et Z2-S : forme de la catégorie d'échec, x-request-id et filtre des mots interdits. */
import { describe, expect, it } from "vitest";
import { categorieSure } from "@/fournisseurs/publication/zernio-client";
import { creerFauxClientZernio, J } from "./aides/faux-zernio";

describe("finitions · client Zernio", () => {
  it("categorieSure garde un code court et écarte le reste", () => {
    expect(categorieSure("rate_limit")).toBe("rate_limit");
    expect(categorieSure("a b")).toBeUndefined();
    expect(categorieSure("x".repeat(65))).toBeUndefined();
    expect(categorieSure("ligne\nsuivante")).toBeUndefined();
    expect(categorieSure(42)).toBeUndefined();
    expect(categorieSure(undefined)).toBeUndefined();
  });

  it("x-request-id : une valeur qui contient un mot interdit est refusée avant tout appel", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: { posts: [] } }]);
    const motInterdit = J("Quali", "opi");
    await expect(client.requete({ methode: "GET", chemin: "/v1/accounts", entetes: { "x-request-id": motInterdit } })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
    // Une valeur correcte passe toujours.
    await client.requete({ methode: "GET", chemin: "/v1/accounts", entetes: { "x-request-id": "exemple-1" } });
    expect(faux.appels).toHaveLength(1);
  });
});
