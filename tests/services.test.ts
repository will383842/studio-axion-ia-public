/**
 * Tests ciblés de la passe qualité (B.9 + AV2.6 lot 3) :
 * moteur simulé via le contrat partagé, blocage budgétaire, limitation des essais, session.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete, Redirection, etatRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { construireCommande, lancerFabrication } = await import("@/services/fabrication");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { moteurSimulation } = await import("@/moteurs/simulation");
const { testerMoteurVideo } = await import("@/moteurs/contrat");
const { NOM_COOKIE_SESSION, verifierJeton } = await import("@/lib/jeton-session");

// Mot de passe de test, propre à ce fichier (jamais celui de Will).
const MDP_TEST = "essai-qualite-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "x".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
});

/* ---------------- Moteur simulé : contrat partagé ---------------- */
testerMoteurVideo(moteurSimulation, async () => {
  reinitialiserDepots();
  return construireCommande("v-03");
});

/* ---------------- Session ---------------- */
describe("session", () => {
  it("sans cookie : exigerSession redirige vers /connexion", async () => {
    await expect(auth.exigerSession()).rejects.toMatchObject({ vers: "/connexion" });
  });

  it("bon mot de passe : cookie signé posé, session lisible ; déconnexion : révoquée", async () => {
    const r = await auth.seConnecter(MDP_TEST, false);
    expect(r.ok).toBe(true);
    const jeton = etatRequete.cookies.get(NOM_COOKIE_SESSION);
    expect(jeton).toBeTruthy();
    expect(await verifierJeton(jeton)).toMatchObject({ rc: false });
    const s = await auth.exigerSession();
    expect(s.appareil).toBe("iPhone");
    await auth.seDeconnecter();
    expect(etatRequete.cookies.has(NOM_COOKIE_SESSION)).toBe(false);
    const ligne = await depots().sessions.obtenir(s.id);
    expect(ligne?.revoqueeLe).toBeTruthy();
  });

  it("une session révoquée n'ouvre plus rien, même avec un jeton valide", async () => {
    await auth.seConnecter(MDP_TEST, true);
    const jeton = etatRequete.cookies.get(NOM_COOKIE_SESSION)!;
    const s = await auth.exigerSession();
    await depots().sessions.modifier(s.id, { revoqueeLe: new Date().toISOString() });
    etatRequete.cookies.set(NOM_COOKIE_SESSION, jeton);
    await expect(auth.exigerSession()).rejects.toBeInstanceOf(Redirection);
  });

  it("un jeton falsifié est refusé", async () => {
    expect(await verifierJeton("eyJhbGciOiJIUzI1NiJ9.e30.faux")).toBeNull();
  });
});

/* ---------------- Limitation des essais ---------------- */
describe("limitation des essais de connexion", () => {
  it("5 échecs en 15 min bloquent l'IP, même avec le bon mot de passe ; une autre IP passe", async () => {
    reinitialiserRequete("10.0.0.9");
    for (let i = 0; i < 5; i++) {
      const r = await auth.seConnecter("mauvais", false);
      expect(r.ok).toBe(false);
    }
    expect((await auth.etatLimitation("10.0.0.9")).bloque).toBe(true);
    const bloque = await auth.seConnecter(MDP_TEST, false);
    expect(bloque).toMatchObject({ ok: false });
    expect(etatRequete.cookies.has(NOM_COOKIE_SESSION)).toBe(false);

    reinitialiserRequete("10.0.0.10");
    expect((await auth.seConnecter(MDP_TEST, false)).ok).toBe(true);
  }, 30_000);

  it("temps de réponse constant (≥ 800 ms) sur un échec", async () => {
    const debut = Date.now();
    await auth.seConnecter("mauvais", false);
    expect(Date.now() - debut).toBeGreaterThanOrEqual(780);
  });
});

/* ---------------- Blocage budgétaire ---------------- */
describe("blocage budgétaire", () => {
  async function connecter() {
    expect((await auth.seConnecter(MDP_TEST, false)).ok).toBe(true);
  }

  it("refuse de lancer si le budget du mois serait dépassé", async () => {
    await connecter();
    await ecrireParametre("budget.mensuel", { centimes: 1, devise: "EUR" });
    await expect(lancerFabrication("v-03", { confirme: true })).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    expect(await depots().travaux.compter((t) => t.cibleId === "v-03" && t.statut !== "termine" && t.statut !== "echec")).toBe(0);
  });

  it("au-delà du seuil, exige une confirmation, puis lance", async () => {
    await connecter();
    await ecrireParametre("budget.mensuel", { centimes: 10_000_000, devise: "EUR" });
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1, devise: "EUR" });
    const refus = await lancerFabrication("v-03").catch((e: { code?: string; montant?: number }) => e);
    expect(refus).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    // Seconde relecture paquet 4 (R2) : au-delà du seuil, c'est le MONTANT vu qui confirme (`true` ne suffit plus).
    await expect(lancerFabrication("v-03", { confirme: true })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    const r = await lancerFabrication("v-03", { confirme: (refus as { montant: number }).montant });
    expect(r.travailId).toBeTruthy();
    expect((await depots().videos.obtenir("v-03"))?.statut).toBe("en_file");
  });

  it("sans session, lancer est refusé", async () => {
    await expect(lancerFabrication("v-03", { confirme: true })).rejects.toBeInstanceOf(Redirection);
  });
});
