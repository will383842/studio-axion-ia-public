/**
 * PLAFONDS PROPRES DU TABLEAU ANIMÉ (11/10) : le découpage (0,60 $ par défaut, une relance possible) et l'écriture du
 * script (défaut : le pire cas d'une génération, marge de réservation comprise) ont chacun leur plafond par vidéo, lu
 * dans les réglages, à part du plafond des textes de publication ; les autres plafonds ne bougent pas. Faux `fetch`.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { exemplesCommeVraies } from "../../helpers/videos-reelles";
import { preparerMotDePasse } from "../../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../../helpers/g0";
import { DEMANDE_MODELE } from "../../tableau-scripts/modele-valide";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const dcv = await import("@/services/depense-claude-video");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { roleDecoupageTableau, ETAPE_DECOUPAGE } = await import("@/moteurs/montage-tableau/decoupage");
const { coutDecoupageCentimes } = await import("@/services/tableau-creation");
const { genererScriptTableau } = await import("@/services/tableau-scripts");
const { clientScriptsStudio, ETAPE_SCRIPT_TABLEAU } = await import("@/services/tableau-scripts/client-studio");
const { nouvelId } = await import("@/lib/ids");
import type { Video } from "@/domaine/types";

const MDP = "essai-plafonds-tableau";
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
  const v: Video = { ...modele, id: "v-tbp", estDemo: false, formatId: "tableau-anime" };
  await depots().videos.enregistrer(v);
  return v;
}

async function depense(videoId: string, etape: string, centimesEur: number) {
  const date = new Date().toISOString();
  const ligne = { etape, fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: centimesEur, devise: "EUR" as const }, total: { centimes: centimesEur, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
}

const entree = { contexte: {}, variable: "<script>\nUn texte court.\n</script>" };

describe("plafonds propres du tableau animé", () => {
  it("défauts : 0,60 $ pour le découpage, relevé au prix confirmé (deux appels au pire, marge comprise) ; les autres plafonds ne bougent pas", async () => {
    expect(dcv.PLAFOND_DECOUPAGE_TABLEAU).toMatchObject({ parametre: "tableau.plafondDecoupageUsd", defautUsd: 0.6 });
    expect(await dcv.valeurPlafondPropre(dcv.PLAFOND_DECOUPAGE_TABLEAU)).toBe(0.6);
    // Budget du découpage revu le 12/10 : son pire cas (premier appel et relance) dépasse 0,60 $ ; l'enveloppe d'un
    // découpage est alors son prix confirmé, marge de réservation comprise (`appelStudio`), jamais moins de 0,60 $.
    const pire = coutDecoupageCentimes(1) / 100;
    expect(await dcv.valeurPlafondPropre({ ...dcv.PLAFOND_DECOUPAGE_TABLEAU, defautUsd: Math.max(0.6, pire * 1.2) })).toBeGreaterThanOrEqual(pire * 1.2);
    expect(await dcv.plafondKitUsd()).toBe(dcv.PLAFOND_KIT_USD);
    expect(dcv.PLAFOND_KIT_USD).toBe(0.3);
    expect(await dcv.plafondFacecamVersionUsd()).toBe(1.5);
    // Écriture : défaut fourni (le pire cas d'une génération), réglage lu s'il existe.
    expect(await dcv.valeurPlafondPropre(dcv.plafondScriptTableau(0.9))).toBe(0.9);
    await ecrireParametre("tableau.plafondScriptUsd", 2);
    expect(await dcv.valeurPlafondPropre(dcv.plafondScriptTableau(0.9))).toBe(2);
  });

  it("leurs dépenses ne comptent pas dans le plafond des textes, ni l'un dans l'autre", async () => {
    const v = await video();
    await depense(v.id, ETAPE_DECOUPAGE, 40);
    await depense(v.id, `${ETAPE_SCRIPT_TABLEAU} · écriture`, 30);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
    const decoupage = await dcv.engagePlafondPropreCentimes(v.id, dcv.PLAFOND_DECOUPAGE_TABLEAU);
    const ecriture = await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondScriptTableau(1));
    expect(decoupage).toBeGreaterThan(40);
    expect(ecriture).toBeGreaterThan(30);
    expect(ecriture).toBeLessThan(decoupage);
  });

  it("plafond des textes à 0 : le découpage passe sur son propre plafond ; le sien atteint : arrêt, aucun appel", async () => {
    const appels = brancherClaude();
    const v = await video();
    await ecrireParametre("claude.plafondKitUsd", 0);
    const r = await dcv.executerRolePourVideo(v.id, roleDecoupageTableau, entree, { etape: ETAPE_DECOUPAGE, plafondPropre: dcv.PLAFOND_DECOUPAGE_TABLEAU });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    const reservations = await depots().reservations.lister((x) => x.videoId === v.id);
    expect(reservations.every((x) => x.travailId?.startsWith("txtpub-tbdec-"))).toBe(true);

    await ecrireParametre("tableau.plafondDecoupageUsd", 0.01);
    const refus = await dcv.executerRolePourVideo(v.id, roleDecoupageTableau, entree, { etape: ETAPE_DECOUPAGE, plafondPropre: dcv.PLAFOND_DECOUPAGE_TABLEAU });
    expect(refus).toMatchObject({ ok: false, arret: "plafond-video", message: expect.stringMatching(/rien n'a été payé/) });
    expect(appels).toHaveLength(1);
  });

  it("une étape mal nommée est refusée (elle échapperait à son plafond)", async () => {
    brancherClaude();
    const v = await video();
    await expect(dcv.executerRolePourVideo(v.id, roleDecoupageTableau, entree, { etape: "Autre chose", plafondPropre: dcv.PLAFOND_DECOUPAGE_TABLEAU })).rejects.toThrow(/mal nommée/);
  });

  it("le générateur passe par le chemin plafonné : son plafond atteint, refus expliqué, aucun appel", async () => {
    const appels = brancherClaude();
    const v = await video();
    await ecrireParametre("tableau.plafondScriptUsd", 0);
    const r = await genererScriptTableau(DEMANDE_MODELE, { client: clientScriptsStudio(v.id, 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motifs[0]).toMatch(/Plafond de cette vidéo atteint/);
    expect(appels).toHaveLength(0);
  });

  it("le générateur dépense par le chemin plafonné : la dépense est rattachée à la vidéo, sur son étape propre", async () => {
    const appels = brancherClaude();
    const v = await video();
    const r = await genererScriptTableau(DEMANDE_MODELE, { client: clientScriptsStudio(v.id, 5) });
    // La réponse du double n'est pas un angle : refus propre, après UN appel payé et enregistré.
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motifs[0]).toMatch(/passe « angle » ne suit pas le format attendu/);
    expect(appels).toHaveLength(1);
    const depenses = await depots().depenses.lister((x) => x.videoId === v.id);
    expect(depenses.flatMap((x) => x.lignes.map((l) => l.etape))).toEqual([`${ETAPE_SCRIPT_TABLEAU} · accroches`]);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
  });
});
