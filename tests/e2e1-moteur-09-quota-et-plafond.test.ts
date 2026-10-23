/**
 * E2E-1 n° 9 (MINEUR, 03/10) — HeyGen 429 (« trop de demandes ») dont le message parle de « quota » = indisponible
 * passager (reprise courte), jamais « crédit épuisé » ; le plafond de dépense des illustrations du studio n'est pas un
 * crédit fal.ai épuisé (une recharge n'y change rien) : message propre, pas d'attente de crédit.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const { erreurDepuisReponse } = await import("@/fournisseurs/heygen/client");
const { creerFabricationFal } = await import("@/fournisseurs/illustration/fal");
const { estCreditInsuffisant } = await import("@/services/credits");

afterEach(() => vi.unstubAllGlobals());

describe("E2E-1 n° 9 · 429 et plafond ne sont pas un crédit épuisé", () => {
  it("HeyGen 429 avec « quota » dans le message : indisponible, réessayable, pas « crédit insuffisant »", () => {
    for (const corps of [{ error: { code: "rate_limit", message: "Request quota exceeded, slow down" } }, { error: { code: "quota_exceeded", message: "too many requests" } }]) {
      const e = erreurDepuisReponse(429, corps);
      expect(e.erreur).toMatchObject({ code: "indisponible", reessayable: true });
      expect(estCreditInsuffisant(e)).toBe(false);
    }
    // Un vrai crédit épuisé reste reconnu.
    expect(estCreditInsuffisant(erreurDepuisReponse(402, null))).toBe(true);
  });

  it("plafond FAL_PLAFOND_USD atteint : refus propre, jamais « crédit épuisé »", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ request_id: "r", status_url: "s", response_url: "r" }));
    const fal = creerFabricationFal({ cle: "k", deposer: async (_, c) => c, plafondUsdCentimes: 5 });
    await fal.soumettre({ genre: "image", requete: "a contract", ratio: "9:16", cleIdempotence: "b" });
    // Le second envoi dépasse le plafond : il DOIT être refusé (null = accepté, le test rougit).
    const e = (await fal.soumettre({ genre: "image", requete: "a contract", ratio: "9:16", cleIdempotence: "c" }).then(
      () => null,
      (x: unknown) => x,
    )) as { erreur: unknown; message: string } | null;
    expect(e).not.toBeNull();
    if (!e) return;
    expect(e.erreur).toMatchObject({ code: "refuse", reessayable: false });
    expect(e.message).toMatch(/plafond/i);
    expect(estCreditInsuffisant(e)).toBe(false);
  });
});
