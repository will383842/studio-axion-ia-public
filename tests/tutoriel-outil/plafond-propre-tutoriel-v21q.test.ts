/**
 * TUTO-DEPENSE-PROPRE-v21q : le plafond propre du tutoriel (« tuto ») entre dans les listes fermées des plafonds propres.
 * Ses dépenses (« Tutoriel · … ») et ses réservations (« txtpub-tuto-… ») ne mangent plus le plafond des textes de
 * publication (0,30 $) ; elles restent comptées dans le plafond « tuto ». Dépôts mémoire, vrai module de dépense,
 * faux `fetch`, aucun appel réseau ni à Claude, 0 €.
 */
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
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
const { plafondPropreTutoriel, PREFIXE_ETAPE_TUTORIEL } = await import("@/services/tutoriel-claude");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ecrireParametre } = await import("@/services/_commun");
const { nouvelId } = await import("@/lib/ids");
const { moisParis } = await import("@/services/couts");
import type { DefinitionRole } from "@/generateur/roles/types";
import type { Video } from "@/domaine/types";

const MDP = "essai-plafond-propre-tutoriel";
const ETAPE_PLAN = "Tutoriel · plan de scènes";
const ETAPE_MAQUETTISTE = "Tutoriel · maquettiste";
const ETAPE_TEXTE = "Texte de publication · LinkedIn";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

/** Lecture du préfixe exporté par le fichier d'argent ; la conversion ne sert qu'à compiler avant le code. */
const prefixeArgent = () => (dcv as unknown as { PREFIXE_ETAPE_TUTORIEL_PLAFOND?: string }).PREFIXE_ETAPE_TUTORIEL_PLAFOND;

const roleTexte: DefinitionRole = { id: "texte-essai-tuto", version: 1, consigne: "Consigne d'essai.", modele: "claude-sonnet-5-5", effort: "low", maxTokens: 100, sansPhrasesFixes: true, simuler: () => "" };

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
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

async function video(): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id: "v-tuto-plafond", estDemo: false, formatId: "tutoriel-outil" };
  await depots().videos.enregistrer(v);
  return v;
}

async function depense(videoId: string, etape: string, centimesEur: number) {
  const date = new Date().toISOString();
  const ligne = { etape, fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: centimesEur, devise: "EUR" as const }, total: { centimes: centimesEur, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
}

async function reservation(videoId: string, travailId: string, centimes: number) {
  const date = new Date().toISOString();
  await depots().reservations.enregistrer({ id: `res-${travailId}`, fournisseur: "anthropic", videoId, travailId, centimes, devise: "USD", statut: "active", creeLe: date, modifieLe: date });
}

describe("TUTO-DEPENSE-PROPRE-v21q · plafond propre du tutoriel (« tuto ») dans les listes fermées", () => {
  it("a) des dépenses « Tutoriel · plan de scènes » et « Tutoriel · maquettiste » ne changent pas le plafond des textes", async () => {
    const v = await video();
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    await depense(v.id, ETAPE_PLAN, 8);
    await depense(v.id, ETAPE_MAQUETTISTE, 5);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
  });

  it("b) une réservation active « txtpub-tuto-… » ne change pas le plafond des textes ; un témoin « txtpub-… » le change", async () => {
    const v = await video();
    await reservation(v.id, "txtpub-tuto-essai1", 9);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    await reservation(v.id, "txtpub-essai2", 5);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(5);
  });

  it("c) dépenses et réservations du tutoriel comptent dans le plafond « tuto »", async () => {
    const v = await video();
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondPropreTutoriel())).toBe(0);
    await reservation(v.id, "txtpub-tuto-essai3", 9);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondPropreTutoriel())).toBe(9);
    await depense(v.id, ETAPE_PLAN, 8);
    await depense(v.id, ETAPE_MAQUETTISTE, 5);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondPropreTutoriel())).toBeGreaterThan(9);
  });

  it("d) disjoint : tbdec, tbscr, favid, rtcht, tbreg ne comptent pas dans « tuto », et inversement", async () => {
    const v = await video();
    await depense(v.id, "Tableau · découpage", 20);
    await depense(v.id, "Tableau · script", 20);
    await depense(v.id, `${dcv.PREFIXE_ETAPE_VIDEOS_FA} x`, 20);
    await depense(v.id, `${dcv.PREFIXE_ETAPE_RETOUCHE_CHAT} lecture`, 20);
    await depense(v.id, `${dcv.PREFIXE_ETAPE_REGARD_TABLEAU} de la vidéo finie`, 20);
    for (const id of ["tbdec", "tbscr", "favid", "rtcht", "tbreg"]) await reservation(v.id, `txtpub-${id}-essai`, 7);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondPropreTutoriel())).toBe(0);
    const voisins = [dcv.PLAFOND_DECOUPAGE_TABLEAU, dcv.plafondScriptTableau(1), dcv.plafondVideosFa()];
    const avant = await Promise.all(voisins.map((p) => dcv.engagePlafondPropreCentimes(v.id, p)));
    await depense(v.id, ETAPE_PLAN, 30);
    await reservation(v.id, "txtpub-tuto-essai4", 11);
    expect(await Promise.all(voisins.map((p) => dcv.engagePlafondPropreCentimes(v.id, p)))).toEqual(avant);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondPropreTutoriel())).toBeGreaterThan(11);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
  });

  it("e) plafond « tuto » et étape « Texte de publication · LinkedIn » : ETAPE_INVALIDE, 0 réservation, 0 dépense, 0 appel", async () => {
    const v = await video();
    const appels: unknown[] = [];
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async () => { appels.push(1); throw new Error("réseau interdit"); }) as typeof fetch, attenteMs: () => 0 });
    await expect(dcv.executerRolePourVideo(v.id, roleTexte, { contexte: {}, variable: "demande" }, { etape: ETAPE_TEXTE, plafondPropre: plafondPropreTutoriel(), origine: "usine" })).rejects.toMatchObject({ code: "ETAPE_INVALIDE" });
    expect(appels).toHaveLength(0);
    expect(await depots().reservations.lister((r) => r.videoId === v.id)).toHaveLength(0);
    expect(await depots().depenses.lister((x) => x.videoId === v.id)).toHaveLength(0);
  });

  it("f) le préfixe du fichier d'argent est exactement celui du tutoriel (« Tutoriel · »)", () => {
    expect(prefixeArgent()).toBe(PREFIXE_ETAPE_TUTORIEL);
    expect(PREFIXE_ETAPE_TUTORIEL).toBe("Tutoriel ·");
    expect(plafondPropreTutoriel().prefixeEtape).toBe(prefixeArgent());
  });

  it("g) aucun plafond existant ne bouge (0,3 / 1,5 / 0,6 / 0,6)", async () => {
    expect(dcv.PLAFOND_KIT_USD).toBe(0.3);
    expect(dcv.PLAFOND_FACECAM_VERSION_USD).toBe(1.5);
    expect(await dcv.plafondFacecamVersionUsd()).toBe(1.5);
    expect(dcv.PLAFOND_VIDEOS_FA_USD).toBe(0.6);
    expect(dcv.PLAFOND_DECOUPAGE_TABLEAU_USD).toBe(0.6);
    expect(dcv.PLAFOND_DECOUPAGE_TABLEAU).toMatchObject({ defautUsd: 0.6 });
  });

  it("h) après plus de 0,40 $ dépensés « Tutoriel · … » sur la vidéo, un texte de publication passe encore (Usine, bloquant)", async () => {
    void credits.declarerRecharge("anthropic", 500);
    const appels: unknown[] = [];
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async (_u: string | URL | Request, init?: RequestInit) => (appels.push(init?.body), reponseFlux(fluxReussi({ texte: "Un texte.", modele: "claude-sonnet-5-5" })))) as typeof fetch, attenteMs: () => 0 });
    await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
    await ecrireParametre(`budget.usine.${moisParis()}`, { mois: moisParis(), budget_mensuel_cents: 1_000_000 });
    const v = await video();
    await depense(v.id, ETAPE_PLAN, 25);
    await depense(v.id, ETAPE_MAQUETTISTE, 20);
    expect(await dcv.engagePlafondPropreCentimes(v.id, plafondPropreTutoriel())).toBeGreaterThanOrEqual(40);
    const r = await dcv.executerRolePourVideo(v.id, roleTexte, { contexte: {}, variable: "demande" }, { etape: ETAPE_TEXTE, origine: "usine" });
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
    expect(appels).toHaveLength(1);
  });

  it("h) témoin : le plafond des textes tient toujours — 45 ¢ dépensés en « Texte de publication · … » : refus, rien n'est parti", async () => {
    void credits.declarerRecharge("anthropic", 500);
    const appels: unknown[] = [];
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: (async () => (appels.push(1), reponseFlux(fluxReussi({ texte: "Un texte.", modele: "claude-sonnet-5-5" })))) as typeof fetch, attenteMs: () => 0 });
    await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
    await ecrireParametre(`budget.usine.${moisParis()}`, { mois: moisParis(), budget_mensuel_cents: 1_000_000 });
    const v = await video();
    await depense(v.id, "Texte de publication · Instagram", 45);
    const r = await dcv.executerRolePourVideo(v.id, roleTexte, { contexte: {}, variable: "demande" }, { etape: ETAPE_TEXTE, origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "plafond-video" });
    expect(appels).toHaveLength(0);
  });
});
