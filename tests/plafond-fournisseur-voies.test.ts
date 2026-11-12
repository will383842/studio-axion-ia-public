/**
 * L2-13 (correction après relecture) — TOUTES les voies qui atteignent fal.ai posent l'origine du lancement.
 * Avant : l'origine « usine » n'était posée nulle part, donc le quota de quantité ne comptait rien et, au-delà du
 * plafond technique, la fabrication automatique passait. Voies (grep `fabrication.soumettre({ genre:`) :
 *  1. `demanderDecor` (services/decors.ts), origine portée par `options.origine` ;
 *  2. `avancerIllustrations` (moteurs/montage-avocat), origine figée dans la commande (`commande.origine`).
 * Chaque test passe par le vrai fournisseur inscrit (faux fetch, dépôts en mémoire, aucune clé, aucun réseau).
 */
import { hash } from "@node-rs/argon2";
import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  mockHeaders,
  mockNavigation,
  reinitialiserRequete,
} from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

process.env.FAL_KEY = "cle-factice";
process.env.FAL_PLAFOND_USD = "1";
process.env.FOURNISSEUR_ILLUSTRATION = "reel";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const decors = await import("@/services/decors");
const pf = await import("@/services/plafond-fournisseur");
const { ecrireParametre } = await import("@/services/_commun");
const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
const { moisParis } = await import("@/services/couts");
const { centimes } = await import("@/lib/montants");
const { resoudreFournisseur } = await import("@/fournisseurs");
const illus =
  await import("@/moteurs/montage-avocat/fabrication-illustrations");
import type { FournisseurIllustrationEtendu } from "@/fournisseurs/illustration/types";

const MDP = "l2-13-voies";
let posts = 0;
let n = 0;
const image = () => ({
  genre: "image" as const,
  requete: "a contract",
  ratio: "9:16" as const,
  cleIdempotence: `k-${++n}`,
});
const reel = async () =>
  resoudreFournisseur("illustration", "reel") as FournisseurIllustrationEtendu;
const unPlan = () => ({
  plans: { "1": { phase: "image" as const, requete: "a contract" } },
});

beforeAll(async () => {
  process.env.SESSION_SECRET = "v".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(
    await hash(MDP, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }),
  ).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  posts = 0;
  vi.stubGlobal("fetch", async (_u: unknown, init?: { method?: string }) => {
    // Seules les soumissions (POST) comptent ; le suivi tombe en panne tout de suite (pas d'attente de 3 minutes).
    if ((init?.method ?? "GET") !== "POST")
      throw new Error("fal.ai ne répond pas.");
    posts++;
    return Response.json({
      request_id: "r",
      status_url: "s",
      response_url: "r",
    });
  });
  await auth.seConnecter(MDP, false);
  await ecrireParametre("budget.seuilConfirmation", centimes(1_000_000));
  await ecrireParametre("budget.mensuel", centimes(1_000_000));
  await reglerBudgetUsine({ budget_mensuel_cents: 500_000, mois: moisParis() });
});
afterEach(() => vi.unstubAllGlobals());

/** Une unité du quota est déjà consommée : le quota (limite 1) est atteint pour l'usine. */
async function quotaAtteint() {
  await ecrireParametre(pf.CLE_QUOTAS_USINE, [
    { periode: "jour", reseau: "fal", type: "image", limite: 1 },
  ]);
  await pf.avecOrigineFournisseur("usine", async () =>
    (await reel()).fabrication!.soumettre(image()),
  );
  expect(posts).toBe(1);
}

/** Dépense fal.ai déjà en base au-delà du plafond technique. */
async function plafondTechniqueDepasse() {
  const t = new Date().toISOString();
  await depots().depenses.enregistrer({
    id: "dep-fal",
    lignes: [
      {
        etape: "Illustrations fabriquées",
        fournisseur: "fal.ai",
        unite: "image",
        quantite: 1,
        prixUnitaire: centimes(5000),
        total: centimes(5000),
        nature: "reel",
      },
    ],
    total: centimes(5000),
    date: t,
    creeLe: t,
    modifieLe: t,
  });
}

describe("voie 1 · demanderDecor", () => {
  it("origine « usine », quota atteint : refus, zéro envoi de plus", async () => {
    await quotaAtteint();
    await decors
      .demanderDecor("un bureau de direction avec une baie vitrée", {
        confirme: true,
        origine: "usine",
      })
      .catch(() => undefined);
    expect(posts).toBe(1);
  });

  it("origine « usine », au-delà du plafond technique : refus, zéro envoi", async () => {
    await plafondTechniqueDepasse();
    await decors
      .demanderDecor("un bureau de direction avec une baie vitrée", {
        confirme: true,
        origine: "usine",
      })
      .catch(() => undefined);
    expect(posts).toBe(0);
  });

  it("origine du fondateur (rien de précisé) : jamais bloquée, même quota atteint", async () => {
    await quotaAtteint();
    await decors
      .demanderDecor("un bureau de direction avec une baie vitrée", {
        confirme: true,
      })
      .catch(() => undefined);
    expect(posts).toBe(1 + 3);
  });
});

describe("voie 2 · avancerIllustrations (montage)", () => {
  it("origine « usine », quota atteint : refus, zéro envoi de plus, le plan garde le double", async () => {
    await quotaAtteint();
    const e = await illus.avancerIllustrations(
      unPlan(),
      await reel(),
      "9:16",
      "t",
      undefined,
      "usine",
    );
    expect(posts).toBe(1);
    expect(e.plans["1"].phase).toBe("abandon");
  });

  it("origine « usine », au-delà du plafond technique : refus, zéro envoi", async () => {
    await plafondTechniqueDepasse();
    await illus.avancerIllustrations(
      unPlan(),
      await reel(),
      "9:16",
      "t",
      undefined,
      "usine",
    );
    expect(posts).toBe(0);
  });

  it("origine du fondateur ou non précisée : jamais bloquée, même quota atteint", async () => {
    await quotaAtteint();
    await illus.avancerIllustrations(
      unPlan(),
      await reel(),
      "9:16",
      "t-a",
      undefined,
      "studio",
    );
    await illus.avancerIllustrations(unPlan(), await reel(), "9:16", "t-b");
    expect(posts).toBe(1 + 2);
  });
});
