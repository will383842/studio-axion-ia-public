/**
 * X11 · un format qui écrit lui-même ses textes de publication (`ecranVideo.publication: "aucune"`, ici `cas-concret`)
 * n'a ni la ligne « Textes des réseaux » à l'estimation, ni l'écriture automatique par Claude en fin de fabrication.
 * Les autres formats (face caméra, avocat, tableau animé) gardent l'une et l'autre. Claude répond par un faux `fetch`
 * (réponses enregistrées à la main) : aucun service réel, rien de payé.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { exemplesCommeVraies } from "../../helpers/videos-reelles";
import { preparerMotDePasse } from "../../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../../helpers/g0";
import type { Video } from "@/domaine/types";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const pub = await import("@/services/publications");
const travaux = await import("@/services/travaux");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { trouverFormat } = await import("@/formats");

const MDP = "cas-concret-x11";

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

/** Claude répond un texte de publication valide ; chaque requête est comptée. */
async function brancherClaude() {
  await credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    appels.push(init?.body);
    const texte = "Ce que coûtent vraiment les outils d'équipe.\n\nLe point en une minute, sans jargon.";
    const sortie = { premiereLigne: texte.split("\n")[0], texte, motsDiese: ["#PME"], titres: ["Les outils de l'équipe"], justifications: [] };
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

/** Une vraie vidéo prête du format donné, SANS kit (copie de la démo v-04, hors exemples). */
async function videoDuFormat(formatId: string): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id: `v-x11-${formatId}`, formatId, estDemo: false, titre: "Les outils de l'équipe" };
  await depots().videos.enregistrer(v);
  return v;
}

const suite = (v: Video) => travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0], textes: true }]);

describe("X11 · un format sans publication n'a ni la ligne ni l'appel", () => {
  it("cas-concret : pas de ligne « Textes des réseaux », estimation inchangée, aucun appel Claude en fin de fabrication", async () => {
    expect(trouverFormat("cas-concret")?.ecranVideo?.publication).toBe("aucune");
    const appels = await brancherClaude();
    const v = await videoDuFormat("cas-concret");
    expect(await pub.ligneTextesDesReseaux(v.id)).toBeNull();
    const estimation = { lignes: [], total: { centimes: 89, devise: "EUR" as const } };
    expect(await pub.avecTextesDesReseaux(v.id, estimation)).toEqual(estimation);
    await suite(v);
    expect(appels).toHaveLength(0);
    expect(await depots().reservations.compter((r) => r.videoId === v.id && r.fournisseur === "anthropic")).toBe(0);
  });
});

describe("X11 · les autres formats gardent la ligne et l'appel", () => {
  for (const formatId of ["facecam", "avocat", "tableau-anime"]) {
    it(`${formatId} : la ligne « Textes des réseaux » est annoncée et Claude écrit en fin de fabrication`, async () => {
      expect(trouverFormat(formatId)?.ecranVideo?.publication).not.toBe("aucune");
      const appels = await brancherClaude();
      const v = await videoDuFormat(formatId);
      expect(await pub.ligneTextesDesReseaux(v.id)).toMatchObject({ etape: "Textes des réseaux", facultative: true });
      await suite(v);
      expect(appels.length).toBeGreaterThan(0);
    });
  }
});

describe("X11 · cas-concret : montant confirmé, réservé et affiché sans la ligne", () => {
  it("Claude choisi pour les textes : l'accord au montant de la feuille suffit, le lancement et l'aperçu disent le même montant", async () => {
    await brancherClaude();
    const service = await import("@/services/cas-concret");
    const { apercuFabrication } = await import("@/services/fabrication");
    const reseaux = ["facebook", "instagram", "tiktok", "linkedin"];
    const feuille = (await service.estimerCas("recrutement-apporteurs", reseaux, false)).centimes;
    const lancer = vi.fn(async () => ({ travailId: "t-x11" }));
    const issue = await service.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux, mot: "IA", avecMot: false, accordCentimes: feuille, empreinteScriptRelu: RELU_RECRUTEMENT }, { lancer });
    expect(issue.statut).toBe("lancee");
    expect(lancer).toHaveBeenCalledWith(expect.any(String), feuille);
    if (issue.statut !== "lancee") return;
    expect(await pub.ligneTextesDesReseaux(issue.videoId)).toBeNull();
    const apercu = await apercuFabrication(issue.videoId);
    expect(apercu.textesReseaux).toBeUndefined();
    expect(apercu.estimation.lignes.map((l) => l.etape)).not.toContain("Textes des réseaux");
    expect(apercu.estimation.total.centimes).toBe(feuille);
  });
});
