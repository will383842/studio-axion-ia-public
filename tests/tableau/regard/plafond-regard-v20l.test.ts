/**
 * S-10-PLAFOND-v20l : le regard du tableau a son PROPRE plafond par vidéo (« tbreg », 0,65 $) et ne mange plus le plafond
 * des textes de publication (0,30 $). Dépôts mémoire, vrai module de dépense, faux `fetch`, aucun appel réseau ni à Claude.
 */
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { exemplesCommeVraies } from "../../helpers/videos-reelles";
import { preparerMotDePasse } from "../../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../../helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const dcv = await import("@/services/depense-claude-video");
const { PLAFOND_REGARD_TABLEAU, PLAFOND_REGARD_TABLEAU_USD, PARAM_PLAFOND_REGARD_TABLEAU } = await import("@/services/plafond-regard-tableau");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { roleRegard, variableRegard, coutPireRegardUsd } = await import("@/briques/regardeur");
const { ecrireParametre } = await import("@/services/_commun");
const { nouvelId } = await import("@/lib/ids");
const { moisParis } = await import("@/services/couts");
import type { Video } from "@/domaine/types";

const MDP = "essai-plafond-regard";
const ETAPE = "Tableau · regard de la vidéo finie";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

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

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(init?.body);
    return reponseFlux(fluxReussi({ texte: JSON.stringify({ rien: true }), modele: "claude-opus-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

async function video(): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id: "v-regard-plafond", estDemo: false, formatId: "tableau-anime" };
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

/** Une demande de regard à 24 images (le pire cas de la fiche), sans octets : le faux `fetch` ne les lit pas. */
const entree24 = () => ({
  contexte: {},
  variable: variableRegard(Array.from({ length: 24 }, (_, i) => ({ nom: `i${i + 1}`, instantSec: i }))),
  images: Array.from({ length: 24 }, () => ({ type: "image/jpeg" as const, base64: "" })),
});

describe("S-10-PLAFOND-v20l · plafond propre du regard du tableau (« tbreg »)", () => {
  it("a) une dépense « Tableau · regard … » ne change pas le plafond des textes ; elle compte dans celui du regard", async () => {
    const v = await video();
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    await depense(v.id, ETAPE, 8);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    expect(await dcv.engagePlafondPropreCentimes(v.id, PLAFOND_REGARD_TABLEAU)).toBeGreaterThan(0);
  });

  it("b) une réservation « txtpub-tbreg-… » ne change pas le plafond des textes", async () => {
    const v = await video();
    await reservation(v.id, "txtpub-tbreg-abc", 30);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    await reservation(v.id, "txtpub-xyz", 30);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBeGreaterThan(0);
  });

  it("c) disjoint des plafonds propres voisins : tbdec, tbscr, favid, rtcht ne comptent pas dans tbreg, et inversement", async () => {
    const v = await video();
    await depense(v.id, "Tableau · découpage", 20);
    await depense(v.id, `${dcv.PREFIXE_ETAPE_VIDEOS_FA} · x`, 20);
    await depense(v.id, "Retouche chat · lecture", 20);
    expect(await dcv.engagePlafondPropreCentimes(v.id, PLAFOND_REGARD_TABLEAU)).toBe(0);
    await depense(v.id, ETAPE, 20);
    expect(await dcv.engagePlafondPropreCentimes(v.id, PLAFOND_REGARD_TABLEAU)).toBeGreaterThan(0);
    const avant = await dcv.engagePlafondPropreCentimes(v.id, dcv.PLAFOND_DECOUPAGE_TABLEAU);
    await depense(v.id, ETAPE, 20);
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.PLAFOND_DECOUPAGE_TABLEAU)).toBe(avant);
  });

  it("d) étape mal nommée : ETAPE_INVALIDE (elle échapperait à son plafond)", async () => {
    brancherClaude();
    const v = await video();
    await expect(dcv.executerRolePourVideo(v.id, roleRegard, entree24(), { etape: "Autre chose", plafondPropre: PLAFOND_REGARD_TABLEAU })).rejects.toThrow(/mal nommée/);
  });

  it("e) l'objet est sans conversion de type, à 0,65 $ ; les autres plafonds ne bougent pas (0,3 / 1,5 / 0,6 / 0,6)", async () => {
    expect(PLAFOND_REGARD_TABLEAU).toMatchObject({ id: "tbreg", parametre: "tableau.plafondRegardUsd", defautUsd: 0.65, prefixeEtape: dcv.PREFIXE_ETAPE_REGARD_TABLEAU });
    expect(PLAFOND_REGARD_TABLEAU_USD).toBe(0.65);
    expect(PARAM_PLAFOND_REGARD_TABLEAU).toBe("tableau.plafondRegardUsd");
    expect(ETAPE.startsWith(dcv.PREFIXE_ETAPE_REGARD_TABLEAU)).toBe(true);
    expect(dcv.PLAFOND_KIT_USD).toBe(0.3);
    expect(await dcv.plafondFacecamVersionUsd()).toBe(1.5);
    expect(dcv.PLAFOND_DECOUPAGE_TABLEAU).toMatchObject({ defautUsd: 0.6 });
    expect(dcv.PLAFOND_VIDEOS_FA_USD).toBe(0.6);
    expect(await dcv.valeurPlafondPropre(PLAFOND_REGARD_TABLEAU)).toBe(0.65);
  });

  it("f) deux regards à 24 images au pire passent sur le plafond du regard ; avec 62 ¢ déjà engagés, un troisième est refusé en mode bloquant (Usine), rien n'est parti", async () => {
    const appels = brancherClaude();
    const v = await video();
    await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
    await ecrireParametre(`budget.usine.${moisParis()}`, { mois: moisParis(), budget_mensuel_cents: 1_000_000 });
    expect(coutPireRegardUsd(24)).toBeGreaterThan(0);
    // Deux regards au plus (28 ¢ puis 34 ¢ au pire, fiche) : le premier part, rien d'autre n'est engagé.
    const un = await dcv.executerRolePourVideo(v.id, roleRegard, entree24(), { etape: ETAPE, plafondPropre: PLAFOND_REGARD_TABLEAU, origine: "usine" });
    expect(un, JSON.stringify(un)).toMatchObject({ ok: true });
    expect(appels).toHaveLength(1);
    // 62 ¢ de dollar déjà dépensés par les deux regards : le troisième dépasse 0,65 $ et l'Usine s'arrête.
    await depense(v.id, ETAPE, 56);
    const refus = await dcv.executerRolePourVideo(v.id, roleRegard, entree24(), { etape: ETAPE, plafondPropre: PLAFOND_REGARD_TABLEAU, origine: "usine" });
    expect(refus).toMatchObject({ ok: false, arret: "plafond-video" });
    expect(appels).toHaveLength(1);
    // Et rien de tout cela n'a touché le plafond des textes.
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
  });

  it("g) regardeur-tableau.ts passe ce plafond au seul appel, par l'import dynamique (jamais d'import statique du fichier d'argent)", () => {
    const src = readFileSync(new URL("../../../src/services/regardeur-tableau.ts", import.meta.url), "utf8");
    expect(src).toMatch(/executerRolePourVideo\(videoId, roleRegard, entree, \{[^\n]*import\("\.\/plafond-regard-tableau"\)\)\.PLAFOND_REGARD_TABLEAU/);
    expect(src).not.toMatch(/^import .*from "\.\/depense-claude-video"/m);
  });
});
