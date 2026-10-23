/**
 * PLAN FACECAM v4 — LOT G : le monteur face caméra (monteur, relecture, cartes sur mesure) a son PROPRE plafond par
 * version (1,50 $ par défaut, `facecam.plafondVersionUsd`), à part du plafond des textes de publication (0,30 $) ; jamais
 * affiché ; atteint → arrêt « plafond-video » sans appel (le monteur sort la version simple). Faux `fetch`, aucun réseau.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const dcv = await import("@/services/depense-claude-video");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { roleRelectureFacecam } = await import("@/moteurs/montage-facecam/monteur");
const { nouvelId } = await import("@/lib/ids");
import type { Video } from "@/domaine/types";

const MDP = "essai-facecam-plafond";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(init?.body);
    return reponseFlux(fluxReussi({ texte: JSON.stringify({ ok: true, defauts: [], corrections: [] }), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

async function video(): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id: "v-fcp", estDemo: false, formatId: "facecam" };
  await depots().videos.enregistrer(v);
  return v;
}

/** Dépense du monteur déjà faite pour cette vidéo (0,80 $ en euros au taux par défaut, étape « Monteur · … »). */
async function depenseMonteur(videoId: string, centimesEur: number, date = new Date().toISOString()) {
  const ligne = { etape: "Monteur · consignes", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: centimesEur, devise: "EUR" as const }, total: { centimes: centimesEur, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
}

const entree = { contexte: {}, variable: "<elements>\n</elements>" };

describe("lot G · plafond du monteur face caméra", () => {
  it("les dépenses du monteur ne comptent pas dans le plafond des textes de publication (0,30 $)", async () => {
    const v = await video();
    await depenseMonteur(v.id, 70);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    expect(await dcv.engageFacecamVersionCentimes(v.id, "2000-01-01T00:00:00.000Z")).toBeGreaterThan(70);
  });

  it("au-delà du plafond des textes, le monteur passe encore (son plafond par version est à part)", async () => {
    const appels = brancherClaude();
    const v = await video();
    await ecrireParametre("claude.plafondKitUsd", 0);
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, { etape: "Monteur · relecture des images", facecam: { depuis: new Date(Date.now() - 1000).toISOString() } });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  });

  it("plafond de la version atteint → aucun appel, arrêt « plafond-video » sans montant ; une nouvelle version repart à zéro", async () => {
    const appels = brancherClaude();
    const v = await video();
    const avant = new Date(Date.now() - 60_000).toISOString();
    await depenseMonteur(v.id, 140, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, { etape: "Monteur · relecture des images", facecam: { depuis: avant } });
    expect(r).toMatchObject({ ok: false, arret: "plafond-video" });
    expect(!r.ok && r.message).not.toMatch(/€|\$|\d/);
    expect(appels).toHaveLength(0);
    // Version suivante (le tour commence maintenant) : la dépense d'avant ne compte plus.
    const suivante = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, { etape: "Monteur · relecture des images", facecam: { depuis: new Date().toISOString() } });
    expect(suivante.ok).toBe(true);
    expect(appels).toHaveLength(1);
  });

  it("réglable en base (`facecam.plafondVersionUsd`), 1,50 $ par défaut", async () => {
    expect(await dcv.plafondFacecamVersionUsd()).toBe(1.5);
    await ecrireParametre(dcv.PARAM_PLAFOND_FACECAM, 3);
    expect(await dcv.plafondFacecamVersionUsd()).toBe(3);
  });
});
