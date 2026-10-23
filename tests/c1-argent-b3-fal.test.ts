/**
 * CORRECTEUR 1 (argent) — B3 : fal.ai.
 *  - une soumission coupée ou hors délai APRÈS l'envoi (fal a pu mettre la demande en file, donc la facturer) n'est
 *    plus resoumise à l'aveugle : marquée « à vérifier » ; fal ne permet pas de la retrouver par notre clé, le plan
 *    garde donc le double et son prix est compté comme probablement payé (jamais payé deux ou trois fois) ;
 *  - le plafond `FAL_PLAFOND_USD` est calculé depuis les dépenses EN BASE (il tient après un redémarrage).
 * Faux `fetch`, aucune clé, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { FournisseurIllustrationEtendu } from "@/fournisseurs/illustration/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { creerFabricationFal } = await import("@/fournisseurs/illustration/fal");
const { illustrationsReelles } = await import("@/fournisseurs/illustration/inscription");
const illus = await import("@/moteurs/montage-avocat/fabrication-illustrations");
const { centimes } = await import("@/lib/montants");

const MDP = "c1-argent-b3";

beforeAll(async () => {
  process.env.SESSION_SECRET = "f".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("B3 · soumission fal.ai incertaine", () => {
  it("coupure pendant l'envoi : l'erreur dit « soumission incertaine » (pas une simple panne à relancer)", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    const fal = creerFabricationFal({ cle: "k", deposer: async (_, c) => c });
    const err = await fal.soumettre({ genre: "image", requete: "a contract", ratio: "9:16", cleIdempotence: "x" }).catch((e) => e);
    expect(err?.soumissionIncertaine).toBe(true);
  });

  it("réponse 503 à l'envoi : incertaine aussi ; un refus net (422) ne l'est pas", async () => {
    vi.stubGlobal("fetch", async () => new Response("oups", { status: 503 }));
    const fal = creerFabricationFal({ cle: "k", deposer: async (_, c) => c });
    expect((await fal.soumettre({ genre: "image", requete: "a contract", ratio: "9:16", cleIdempotence: "x" }).catch((e) => e))?.soumissionIncertaine).toBe(true);
    vi.stubGlobal("fetch", async () => new Response("non", { status: 422 }));
    expect((await fal.soumettre({ genre: "image", requete: "a contract", ratio: "9:16", cleIdempotence: "y" }).catch((e) => e))?.soumissionIncertaine).toBeFalsy();
  });

  it("moteur : une soumission incertaine n'est JAMAIS resoumise ; le plan garde le double, le prix est compté", async () => {
    let soumissions = 0;
    const f = {
      id: "reel",
      fabrication: {
        soumettre: async () => {
          soumissions++;
          throw Object.assign(new Error("fal.ai ne répond pas."), { erreur: { code: "indisponible", reessayable: true, message: "fal.ai ne répond pas." }, soumissionIncertaine: true });
        },
        suivre: async () => ({ statut: "en_cours" as const }),
      },
    } as unknown as FournisseurIllustrationEtendu;
    let e: import("@/moteurs/montage-avocat/fabrication-illustrations").EtatIllustrations = { plans: { "1": { phase: "image", requete: "a contract" } } };
    for (let i = 0; i < 6; i++) e = await illus.avancerIllustrations(e, f, "9:16", "t");
    expect(soumissions).toBe(1);
    expect(e.plans["1"].phase).toBe("abandon");
    expect(illus.coutReelCentimes(e)).toBeGreaterThan(0);
  });
});

describe("B3 · plafond FAL_PLAFOND_USD depuis les dépenses en base", () => {
  it("la dépense fal.ai déjà enregistrée compte (après un redémarrage, le compteur ne repart pas de zéro)", async () => {
    let posts = 0;
    vi.stubGlobal("fetch", async () => (posts++, Response.json({ request_id: "r", status_url: "s", response_url: "r" })));
    // Dépense fal.ai du mois déjà en base : 2 € (bien au-delà d'un plafond de 1 $).
    await depots().depenses.enregistrer({ id: "dep-fal", lignes: [{ etape: "Illustrations fabriquées", fournisseur: "fal.ai", unite: "image", quantite: 1, prixUnitaire: centimes(200), total: centimes(200), nature: "reel" }], total: centimes(200), date: new Date().toISOString(), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
    const reel = illustrationsReelles({ FAL_KEY: "cle-factice", FAL_PLAFOND_USD: "1" }).reel as FournisseurIllustrationEtendu;
    const err = await reel.fabrication!.soumettre({ genre: "image", requete: "a contract", ratio: "9:16", cleIdempotence: "z" }).catch((e) => e);
    expect(err).toMatchObject({ erreur: { code: "refuse" } });
    expect(posts).toBe(0);
  });
});
