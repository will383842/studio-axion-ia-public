/**
 * CORRECTEUR 1 (argent) — B11 : en production, une fabrication PAYANTE ne part jamais si un maillon nécessaire est
 * encore en simulation (montage sans serveur de rendu, moteur d'essai, voix d'essai…) : aucune voix ni image payée
 * pour sortir une vidéo de démonstration. Refus avant toute réservation, phrase simple. Faux lecteurs de solde, aucune
 * clé, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const credits = await import("@/services/credits");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "c1-argent-b11";

beforeAll(async () => {
  process.env.SESSION_SECRET = "d".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.unstubAllEnvs();
});

function heygen(solde: number): LecteurCredit {
  return {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      return { fournisseur: "heygen", centimes: solde, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…essai", message: "ok", testeLe: new Date().toISOString() };
    },
  };
}

/** v-03 devient une vraie vidéo dont la voix est payante (HeyGen), sans voix déjà faite. */
async function videoAVoixPayante() {
  credits.injecterLecteursPourEssai([heygen(1_000_000)], ["heygen"]);
  for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
  await depots().videos.modifier("v-03", { estDemo: false });
}

describe("B11 · aucune fabrication payante pour sortir une démo en production", () => {
  it("moteur avocat forcé SANS serveur de rendu : refus clair, rien de réservé, aucun travail", async () => {
    await videoAVoixPayante();
    await ecrireParametre("moteur.avocat", "montage-avocat");
    vi.stubEnv("STUDIO_RENDU_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const travauxAvant = await depots().travaux.compter((t) => t.cibleId === "v-03");
    const err = await fabrication.lancerFabrication("v-03", { confirme: true }).catch((e) => e);
    vi.unstubAllEnvs();
    expect(err).toMatchObject({ code: "SIMULATION_EN_PRODUCTION" });
    expect(String(err.message)).toMatch(/Rien n'a été payé/);
    expect(String(err.message)).toMatch(/montage/);
    expect(await depots().travaux.compter((t) => t.cibleId === "v-03")).toBe(travauxAvant);
    expect(await depots().reservations.compter((r) => r.videoId === "v-03" && r.statut === "active")).toBe(0);
  });

  it("moteur d'essai (sortie de démonstration) avec une voix payante : refus en production", async () => {
    await videoAVoixPayante();
    vi.stubEnv("NODE_ENV", "production");
    const err = await fabrication.lancerFabrication("v-03", { confirme: true }).catch((e) => e);
    vi.unstubAllEnvs();
    expect(err).toMatchObject({ code: "SIMULATION_EN_PRODUCTION" });
  });

  it("hors production, les essais restent possibles (rien ne change)", async () => {
    await videoAVoixPayante();
    const r = await fabrication.lancerFabrication("v-03", { confirme: true });
    expect(r.travailId).toBeTruthy();
  });

  it("en production, un essai entièrement simulé (rien de payé) n'est pas bloqué par cette règle", async () => {
    await depots().videos.modifier("v-03", { estDemo: false });
    vi.stubEnv("NODE_ENV", "production");
    const err = await fabrication.lancerFabrication("v-03", { confirme: true }).catch((e) => e);
    vi.unstubAllEnvs();
    expect(err?.code).not.toBe("SIMULATION_EN_PRODUCTION");
  });
});
