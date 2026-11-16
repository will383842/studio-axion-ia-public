import { describe, expect, it } from "vitest";
import { CATALOGUE, reglagesManquants } from "@/fournisseurs/catalogue";
import { publicationBuffer, publicationZernio } from "@/fournisseurs/publication/inscription";

describe("z1p · inscription et catalogue", () => {
  it("sans ZERNIO_API_KEY : rien d'inscrit (simulation)", () => {
    expect(publicationZernio({})).toEqual({});
    expect(publicationZernio({ ZERNIO_API_KEY: "   " })).toEqual({});
    expect(publicationBuffer({})).toEqual({});
  });
  it("avec la clé : « zernio » seul ; Buffer n'est plus inscrit, même avec sa clé (L0-13a)", () => {
    const e = publicationZernio({ ZERNIO_API_KEY: "exemple-cle-fictive-0001" });
    expect(Object.keys(e)).toEqual(["zernio"]);
    expect(e.zernio).toMatchObject({ id: "zernio", type: "publication", mode: "reel" });
    expect(Object.keys(publicationBuffer({ BUFFER_API_KEY: "exemple-cle-fictive-0002" }))).toEqual([]);
    expect(Object.keys(publicationBuffer({ BUFFER_API_KEY: "a-exemple", ZERNIO_API_KEY: "b-exemple" }))).toEqual(["zernio"]);
  });
  it("catalogue : entrée zernio", () => {
    const z = CATALOGUE.publication.find((i) => i.id === "zernio")!;
    expect(z.ensembles).toEqual([["ZERNIO_API_KEY"]]);
    expect(reglagesManquants(z, {})).toEqual(["ZERNIO_API_KEY"]);
    expect(reglagesManquants(z, { ZERNIO_API_KEY: "exemple" })).toEqual([]);
    expect(CATALOGUE.publication.some((i) => i.id === "buffer")).toBe(true);
  });
});
