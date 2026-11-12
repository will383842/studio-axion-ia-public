/**
 * L3-02 (correction après relecture) — chemin RÉEL de `executerRolePourVideo` derrière la porte contenu, Claude simulé
 * (faux fetch, aucune clé réelle, aucun réseau). Prouve : en origine usine, ni le budget usine, ni le plafond par vidéo,
 * ni la limite du mois en argent n'arrêtent la fabrication (seul le quota d'appels le fait) ; l'origine Studio n'est
 * jamais bloquée par ce chemin.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const dcv = await import("@/services/depense-claude-video");
const m = await import("@/services/depense-claude-contenu");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { roleRelectureFacecam } = await import("@/moteurs/montage-facecam/monteur");
const { nouvelId } = await import("@/lib/ids");

const MDP = "essai-contenu-reel";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;
const entree = { contexte: {}, variable: "<elements>\n</elements>" };
const contenu = { type: "video" as const, id: "v-cr" };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await ecrireParametre(m.PARAM_QUOTA_APPELS_JOUR, 1000);
  const modele = (await depots().videos.obtenir("v-04"))!;
  await depots().videos.enregistrer({ ...modele, id: contenu.id, estDemo: false, formatId: "facecam" });
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

async function depenseTexte(centimesEur: number) {
  const date = new Date(Date.now() - 30_000).toISOString();
  const total = { centimes: centimesEur, devise: "EUR" as const };
  const l = { etape: "Texte de publication", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: total, total, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId: contenu.id, lignes: [l], total, date, creeLe: date, modifieLe: date } as never);
}

describe("L3-02 · chemin réel derrière la porte contenu", () => {
  it("usine, aucun budget usine reçu, quota non atteint → la fabrication passe (pas de « budget-usine »)", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const r = await m.executerRolePourContenu(contenu, roleRelectureFacecam, entree, { etape: "Texte", origine: "usine" });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  }, 30_000);

  it("usine, plafond par vidéo dépassé, quota non atteint → la fabrication passe (pas de « plafond-video »)", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("claude.plafondKitUsd", 0.0001);
    await depenseTexte(500);
    const appels = brancherClaude();
    const r = await m.executerRolePourContenu(contenu, roleRelectureFacecam, entree, { etape: "Texte", origine: "usine" });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  }, 30_000);

  it("usine, limite Claude du mois dépassée, quota non atteint → la fabrication passe", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("claude.plafondMensuelUsd", 0.0001);
    await depenseTexte(500);
    const appels = brancherClaude();
    const r = await m.executerRolePourContenu(contenu, roleRelectureFacecam, entree, { etape: "Texte", origine: "usine" });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  }, 30_000);

  it("origine Studio : plafonds dépassés, jamais bloquée par le chemin réel", async () => {
    await ecrireParametre("claude.plafondKitUsd", 0.0001);
    await ecrireParametre("claude.plafondMensuelUsd", 0.0001);
    await depenseTexte(500);
    const appels = brancherClaude();
    const r = await m.executerRolePourContenu(contenu, roleRelectureFacecam, entree, { etape: "Texte", origine: "studio" });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  }, 30_000);

  it("le chemin vidéo seul garde son comportement : usine sans budget reçu → budget-usine", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const r = await dcv.executerRolePourVideo(contenu.id, roleRelectureFacecam, entree, { etape: "Texte", origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "budget-usine" });
    expect(appels).toHaveLength(0);
  }, 30_000);

  it.each(["usine", "studio"] as const)("%s, plafond de la vidéo dépassé : la cloche et le journal créés ne contiennent aucun montant", async (origine) => {
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("claude.plafondKitUsd", 0.0001);
    await depenseTexte(500);
    brancherClaude();
    const r = await m.executerRolePourContenu(contenu, roleRelectureFacecam, entree, { etape: "Texte", origine });
    expect(r.ok).toBe(true);
    const notifs = await depots().notifications.lister((n) => n.type === "credit" && !n.estDemo);
    const evenements = await depots().evenements.lister((e) => e.type === "budget");
    const textes = [...notifs.map((n) => `${n.titre} ${n.message}`), ...evenements.map((e) => e.message)];
    expect(textes.length).toBeGreaterThan(0);
    for (const t of textes) expect(t, t).not.toMatch(/\d|€|\$|euro|dollar/i);
  }, 30_000);
});
