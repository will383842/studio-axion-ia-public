/**
 * T-EXT-47 · Contrat avec l'usine : une vidéo « tutoriel-outil » validée par Williams suit le chemin des autres vidéos.
 *   validée → « À publier » (`listerAPublier`) → programmation PROPOSÉE par l'usine (appel 4) → entrée « a_valider »,
 *   aucun envoi ; rejeu sans doublon ; « Tout arrêter » = 423, rien d'écrit ; budget bloquant pour l'origine « usine ».
 * LECTURE SEULE : aucun code de production n'est modifié. Dépôts en mémoire, 0 €, aucun réseau, aucun navigateur.
 */
import { hash } from "@node-rs/argon2";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import type { LigneCout } from "@/domaine/types";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const envoi = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.stubGlobal("fetch", envoi.fetch);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { listerAPublier } = await import("@/services/publications");
const { POST } = await import("@/app/api/usine/programmations/route");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const budget = await import("@/services/budget-mensuel");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "essai-contrat-usine-tutoriel";
const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const VIDEO = "v-15";
const RATIOS = ["4:5", "9:16", "1:1"] as const;
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  reinitialiserRequete();
  envoi.fetch.mockReset();
  vi.unstubAllEnvs();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  vi.stubEnv("USINE_TOUT_ARRETER", "");
  await exemplesCommeVraies(depots(), { plusExemples: true });
  // Une vidéo tutoriel prête, aux trois formats du tutoriel.
  await depots().videos.modifier(VIDEO, { formatId: "tutoriel-outil", statut: "prete", ratios: [...RATIOS], etapeEditoriale: "a_relire" } as never);
  await auth.seConnecter(MDP, false);
});
afterEach(() => credits.injecterLecteursPourEssai(null));

const dansAPublier = async () => (await listerAPublier()).find((c) => c.id === VIDEO);
const creneaux = () => depots().creneauxEditoriaux.lister();

function appel(corps: unknown): NextRequest {
  return new NextRequest("http://studio.test/api/usine/programmations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(corps),
  });
}
const programmation = (extra: Record<string, unknown> = {}) => ({
  contrat: 2, cle: "prog-tuto-0001", reseau: "linkedin", jour: "2026-12-10", instant: "2026-12-10T08:30:00.000Z", compteCible: "compte-fictif-1", videoId: VIDEO, ...extra,
});

describe("« À publier » accepte le tutoriel comme les autres formats", () => {
  it("une étape éditoriale autre que « validée » : la vidéo est absente de « À publier »", async () => {
    for (const etape of ["a_relire", "brouillon", undefined]) {
      await depots().videos.modifier(VIDEO, { etapeEditoriale: etape } as never);
      expect(await dansAPublier(), String(etape)).toBeUndefined();
    }
  });

  it("« validée » : la vidéo est présente, avec ses formats 4:5, 9:16 et 1:1", async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    const carte = await dansAPublier();
    expect(carte).toBeDefined();
    expect(carte?.famille).toBe("video");
    expect([...(carte?.ratios ?? [])].sort()).toEqual([...RATIOS].sort());
  });

  it("une vidéo tutoriel non prête reste absente, même validée", async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee", statut: "en_cours" } as never);
    expect(await dansAPublier()).toBeUndefined();
  });
});

describe("l'usine PROPOSE une date (appel 4), Williams décide", () => {
  beforeEach(async () => {
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
  });

  it("crée une entrée d'origine usine « a_valider » pour ce videoId ; aucune publication ni appel réseau", async () => {
    const r = await POST(appel(programmation()));
    expect(r.status).toBe(201);
    const l = await creneaux();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ statut: "a_valider", origine: "usine", videoId: VIDEO, jourVise: "2026-12-10" });
    expect(l[0].valideeLe).toBeUndefined();
    expect(envoi.fetch).not.toHaveBeenCalled();
    expect(await depots().publications.compter((p) => p.videoId === VIDEO)).toBe(0);
    expect((await depots().envoisPlanifies.lister()).length).toBe(0);
  });

  it("rejeu de la même clé : aucune seconde entrée", async () => {
    expect((await POST(appel(programmation()))).status).toBe(201);
    const second = await POST(appel(programmation()));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ etat: "recue", deja: true });
    expect(await creneaux()).toHaveLength(1);
  });

  it("« Tout arrêter » : refus 423, rien n'est écrit", async () => {
    vi.stubEnv("USINE_TOUT_ARRETER", "1");
    const r = await POST(appel(programmation()));
    expect(r.status).toBe(423);
    expect((await r.json()).code).toBe("tout_arrete");
    expect(await creneaux()).toHaveLength(0);
    expect(envoi.fetch).not.toHaveBeenCalled();
  });
});

describe("une commande d'origine « usine » garde un budget bloquant (même chemin que les autres formats)", () => {
  // Lecteur de solde factice (aucun réseau) : une ligne HeyGen est alors réservée comme pour les autres formats.
  const lecteurHeygen: LecteurCredit = {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      return { fournisseur: "heygen", centimes: 1_000_000, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…essai", message: "ok", testeLe: new Date().toISOString() };
    },
  };
  const ligne: LigneCout = { etape: "voix", fournisseur: "heygen", unite: "caractere", quantite: 100, prixUnitaire: eur(1), total: eur(10), nature: "estime" };
  const estimation = { lignes: [ligne], total: eur(10) };
  const demande = () => ({ videoId: VIDEO, travailId: "trv-tuto-1" });

  beforeEach(async () => {
    credits.injecterLecteursPourEssai([lecteurHeygen], ["heygen"]);
    await ecrireParametre("budget.seuilConfirmation", eur(1_000_000));
    await ecrireParametre("budget.mensuel", eur(100));
  });

  it("sans budget reçu de l'usine : refusée, rien n'est réservé", async () => {
    await expect(credits.verifierEtReserverSelonOrigine("usine", estimation, true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    expect(await depots().reservations.lister()).toEqual([]);
  });

  it("budget du mois atteint : refusée ; sous son budget : passe", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 5, mois: couts.moisParis() });
    await expect(credits.verifierEtReserverSelonOrigine("usine", estimation, true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_MENSUEL_ATTEINT" });
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 100, mois: couts.moisParis() });
    await credits.verifierEtReserverSelonOrigine("usine", estimation, true, "Cette vidéo", demande());
    expect((await depots().reservations.lister()).length).toBeGreaterThan(0);
  });
});
