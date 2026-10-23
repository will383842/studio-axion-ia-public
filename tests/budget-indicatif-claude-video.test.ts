/**
 * Budget INDICATIF — plafonds Claude par vidéo (monteur face caméra, textes de publication, plafond du mois Claude).
 * Mode indicatif : au-dessus du plafond, le studio journalise et CONTINUE ; l'arrêt « plafond-video » ne vient plus qu'au-delà
 * de 5 × le plafond (arrêt de sécurité). Le plafond Claude du mois ne bloque plus. Mode bloquant : inchangé.
 * Faux `fetch`, aucun réseau, 0 €.
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

const MDP = "essai-budget-indicatif-claude";
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
  const v: Video = { ...modele, id: "v-bi-fc", estDemo: false, formatId: "facecam" };
  await depots().videos.enregistrer(v);
  return v;
}

async function depenseMonteur(videoId: string, centimesEur: number, date = new Date().toISOString()) {
  const ligne = { etape: "Monteur · consignes", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: centimesEur, devise: "EUR" as const }, total: { centimes: centimesEur, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
}

const entree = { contexte: {}, variable: "<elements>\n</elements>" };
const options = () => ({ etape: "Monteur · relecture des images", facecam: { depuis: new Date(Date.now() - 60_000).toISOString() } });

describe("plafond du monteur face caméra en mode indicatif", () => {
  it("au-dessus du plafond (1,5 $) mais sous 5 ×, le monteur continue et Will est prévenu", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    await depenseMonteur(v.id, 140, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, options());
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect((await depots().notifications.lister()).filter((x) => x.type === "budget" && /Prix annoncé/.test(x.titre))).toHaveLength(1);
  });

  it("au-delà de 5 × le plafond : arrêt de sécurité, aucun appel", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    await depenseMonteur(v.id, 800, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, options());
    expect(r).toMatchObject({ ok: false, arret: "plafond-video" });
    expect(!r.ok && r.message).toMatch(/Arrêt de sécurité/);
    expect(appels).toHaveLength(0);
  });

  it("le plafond Claude du MOIS ne bloque plus (pas de plafond mensuel en indicatif)", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    await ecrireParametre("claude.plafondMensuelUsd", 0.0001);
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, options());
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  });

  it("commande de l'Usine : le plafond du monteur reste BLOQUANT même en indicatif", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    await depenseMonteur(v.id, 140, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, { ...options(), origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "plafond-video" });
    expect(appels).toHaveLength(0);
  });

  it("mode bloquant : plafond atteint → arrêt « plafond-video » comme avant", async () => {
    await ecrireParametre("budget.mode", "bloquant");
    const appels = brancherClaude();
    const v = await video();
    await depenseMonteur(v.id, 140, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, options());
    expect(r).toMatchObject({ ok: false, arret: "plafond-video" });
    expect(appels).toHaveLength(0);
  });
});
