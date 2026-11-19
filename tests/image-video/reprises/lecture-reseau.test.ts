/**
 * S-04b · IV3 : une coupure réseau pendant la lecture de l'image déposée est une panne qui repart
 * (jamais « introuvable : déposez-la de nouveau »). Un vrai 404 reste « absent ».
 */
import { describe, expect, it } from "vitest";
import { lireOctets } from "@/services/image-video";
import { avancerIV, etatInitialIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "../doubles-fabrication";

describe("S-04b · lireOctets distingue absent et panne", () => {
  it("coupure réseau : lève une panne réessayable", async () => {
    const appeler = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(lireOctets("https://exemple.test/a", undefined, appeler, true)).rejects.toMatchObject({ reessayable: true });
  });
  it("5xx : lève une panne réessayable", async () => {
    const appeler = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(lireOctets("https://exemple.test/a", undefined, appeler, true)).rejects.toMatchObject({ reessayable: true });
  });
  it("sans l'option : null partout (appelants de mesure et d'écoute inchangés, jamais de levée)", async () => {
    const coupure = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await lireOctets("https://exemple.test/a", undefined, coupure)).toBeNull();
    expect(await lireOctets("https://exemple.test/a", undefined, (async () => new Response("", { status: 503 })) as unknown as typeof fetch)).toBeNull();
  });
  it("404 : null, comme avant ; octets : rendus", async () => {
    expect(await lireOctets("https://exemple.test/a", undefined, (async () => new Response("", { status: 404 })) as unknown as typeof fetch, true)).toBeNull();
    // Les autres 4xx (adresse signée expirée…) restent « null » aussi.
    expect(await lireOctets("https://exemple.test/a", undefined, (async () => new Response("", { status: 403 })) as unknown as typeof fetch, true)).toBeNull();
    const o = await lireOctets("https://exemple.test/a", undefined, (async () => new Response(new Uint8Array([1, 2, 3]))) as unknown as typeof fetch);
    expect(Array.from(o!)).toEqual([1, 2, 3]);
  });
});

describe("S-04b · par avancerIV", () => {
  it("coupure réseau à la lecture de l'image : pas de IV_IMAGE, panne réessayable", async () => {
    const carte = carteFixe("C");
    const base = outilsSimules(carte, monde());
    const o = {
      ...base,
      relancesAuto: false,
      lireImageSource: (cle: string) => lireOctets("https://exemple.test/" + cle, undefined, (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch, true),
    };
    const e = await avancerIV(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus?.code).toBe("IV_PANNE");
    expect(e.refus?.reessayable).toBe(true);
    expect(e.refus?.code).not.toBe("IV_IMAGE");
  });
});
