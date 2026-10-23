/**
 * INTÉGRATION FINALE — fal.ai : identifiant de demande conservé, vérification avant toute nouvelle soumission
 * (VERIF-E2E-1 : « fal.ai sans idempotence : si le serveur meurt entre la soumission et l'écriture, l'illustration
 * est payée deux fois et n'est pas comptée »).
 *
 * Le vrai fournisseur (`illustrationsReelles`, trace en base) avec un faux `fetch` : aucune clé réelle, aucun réseau.
 * Un « redémarrage » = un fournisseur neuf (la mémoire du processus est perdue) et l'état du travail d'AVANT le tour
 * (le tour n'a pas eu le temps d'écrire le sien).
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { FournisseurIllustrationEtendu } from "@/fournisseurs/illustration/types";
import type { EtatIllustrations } from "@/moteurs/montage-avocat/fabrication-illustrations";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { illustrationsReelles } = await import("@/fournisseurs/illustration/inscription");
const illus = await import("@/moteurs/montage-avocat/fabrication-illustrations");

const MDP = "integration-finale-fal";
const ENV = { FAL_KEY: "cle-fal-essai" };
const DEPART: EtatIllustrations = { plans: { "1": { phase: "image", requete: "a paper contract on a desk" } } };

/** Faux fal.ai : compte les soumissions (POST) ; `pendant` : la soumission ne revient jamais (serveur tué pendant l'envoi). */
const fal = { soumissions: 0, pendant: false, etat: "IN_PROGRESS" };
function fauxFal(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = String(url instanceof Request ? url.url : url);
  if (!u.startsWith("https://queue.fal.run/")) return Promise.reject(new Error(`Adresse inattendue : ${u}`));
  if ((init?.method ?? "GET") === "POST") {
    fal.soumissions++;
    if (fal.pendant) return new Promise<Response>(() => undefined);
    const n = fal.soumissions;
    return Promise.resolve(Response.json({ request_id: `dem-${n}`, status_url: `https://queue.fal.run/statut/${n}`, response_url: `https://queue.fal.run/reponse/${n}` }));
  }
  return Promise.resolve(Response.json({ status: fal.etat }));
}

const fournisseurNeuf = () => illustrationsReelles(ENV).reel as FournisseurIllustrationEtendu;

beforeAll(async () => {
  process.env.SESSION_SECRET = "f".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  Object.assign(fal, { soumissions: 0, pendant: false, etat: "IN_PROGRESS" });
  vi.stubGlobal("fetch", fauxFal);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("INTÉGRATION FINALE · fal.ai : une demande soumise n'est jamais renvoyée", () => {
  it("serveur tué APRÈS la soumission, avant l'écriture de l'état : le tour suivant retrouve la même demande (une seule soumission payée)", async () => {
    const avant = await illus.avancerIllustrations(DEPART, fournisseurNeuf(), "9:16", "trav-1");
    const id = (avant.plans["1"] as { idDemande?: string }).idDemande;
    expect(id).toBeTruthy();
    // Redémarrage : l'état écrit est celui d'AVANT ce tour, le processus a tout oublié.
    const apres = await illus.avancerIllustrations(DEPART, fournisseurNeuf(), "9:16", "trav-1");
    expect(fal.soumissions).toBe(1);
    expect((apres.plans["1"] as { idDemande?: string }).idDemande).toBe(id);
    // Et la dépense engagée est comptée (plafond calculé en base).
    expect(illus.engagementFal(apres).usdCentimes).toBeGreaterThan(0);
  });

  it("serveur tué PENDANT l'envoi : la demande n'est pas renvoyée à l'aveugle ; le plan garde le double et son prix compte comme payé", async () => {
    fal.pendant = true;
    void illus.avancerIllustrations(DEPART, fournisseurNeuf(), "9:16", "trav-2");
    for (let i = 0; i < 20 && fal.soumissions === 0; i++) await new Promise((r) => setTimeout(r, 5));
    expect(fal.soumissions).toBe(1);
    fal.pendant = false;
    const apres = await illus.avancerIllustrations(DEPART, fournisseurNeuf(), "9:16", "trav-2");
    expect(fal.soumissions).toBe(1);
    expect(apres.plans["1"].phase).toBe("abandon");
    expect(illus.coutReelCentimes(apres)).toBeGreaterThan(0);
  });

  it("une demande en ÉCHEC chez fal.ai se refait avec une clé neuve (une vraie nouvelle tentative, pas la demande ratée)", async () => {
    const f = fournisseurNeuf();
    let e = await illus.avancerIllustrations(DEPART, f, "9:16", "trav-3");
    fal.etat = "FAILED";
    e = await illus.avancerIllustrations(e, f, "9:16", "trav-3");
    expect(e.plans["1"]).toMatchObject({ phase: "image", essais: 1 });
    fal.etat = "IN_PROGRESS";
    e = await illus.avancerIllustrations(e, fournisseurNeuf(), "9:16", "trav-3");
    expect(fal.soumissions).toBe(2);
    expect((e.plans["1"] as { idDemande?: string }).idDemande).toContain("statut/2");
  });
});
