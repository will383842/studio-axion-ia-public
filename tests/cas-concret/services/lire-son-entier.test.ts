/**
 * Essai réel du 14/10 (v-e99a49ee86cb) : le son des mesures était lu par `lireDebut` (4 096 octets au plus) ; le contrôle
 * de fin de voix voyait 0,04 s et refusait une voix entière. Le son est maintenant lu EN ENTIER.
 */
import { describe, expect, it } from "vitest";
import { lireSonEntier, SON_MAX_OCTETS } from "@/services/cas-concret-branchements";

const reponse = (octets: number, ok = true, annonce?: number) =>
  (async () => new Response(new Uint8Array(octets), { status: ok ? 200 : 404, headers: annonce !== undefined ? { "content-length": String(annonce) } : {} })) as unknown as typeof fetch;

describe("lecture d'un son en entier", () => {
  it("un son de 2 Mo est lu en entier (pas 4 096 octets)", async () => {
    const lu = await lireSonEntier("https://stockage.test/son.wav", reponse(2_000_000));
    expect(lu?.byteLength).toBe(2_000_000);
  });

  it("introuvable, vide, ou annoncé trop gros : rien (aucune mesure fausse)", async () => {
    expect(await lireSonEntier("https://x/a", reponse(10, false))).toBeNull();
    expect(await lireSonEntier("https://x/a", reponse(0))).toBeNull();
    expect(await lireSonEntier("https://x/a", reponse(10, true, SON_MAX_OCTETS + 1))).toBeNull();
    expect(await lireSonEntier("https://x/a", (async () => { throw new Error("réseau"); }) as unknown as typeof fetch)).toBeNull();
  });
});
