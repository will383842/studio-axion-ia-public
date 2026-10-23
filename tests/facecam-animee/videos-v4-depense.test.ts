/**
 * Contrôle visuel des vidéos d'illustration v4 : VRAI chemin de dépense (`executerRolePourVideo`) avec le plafond propre « favid »,
 * client Claude simulé (faux `fetch`, aucun réseau). 0,60 $ par vidéo finale, à part du plafond des textes de publication (0,30 $).
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
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { roleControleVideoV4 } = await import("@/moteurs/montage-facecam-animee/videos-v4-studio");
const { nouvelId } = await import("@/lib/ids");
import type { Video } from "@/domaine/types";

const MDP = "essai-depense-videos-v4";
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
  const appels: string[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(String(init?.body));
    return reponseFlux(fluxReussi({ texte: JSON.stringify({ verdict: "littéral", texte: false, logo: false, grosPlanVisage: false, raison: "ok" }), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

async function video(): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id: "v-fa-videos", estDemo: false, formatId: "facecam-animee" };
  await depots().videos.enregistrer(v);
  return v;
}

const entree = { contexte: {}, variable: "Consigne de contrôle", images: [{ type: "image/jpeg" as const, base64: "/9j/2Q==", legende: "planche" }] };
const ETAPE = `${dcv.PREFIXE_ETAPE_VIDEOS_FA} contrôle`;

async function depense(videoId: string, etape: string, centimesEur: number, date = new Date().toISOString()) {
  const ligne = { etape, fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: centimesEur, devise: "EUR" as const }, total: { centimes: centimesEur, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
}

describe("contrôle des vidéos d'illustration v4 · plafond propre « favid »", () => {
  it("défaut 0,60 $ (réglage lu), Sonnet, texte rendu ; le plafond des textes (0,30 $) ne bouge pas", async () => {
    expect(dcv.PLAFOND_VIDEOS_FA_USD).toBe(0.6);
    expect(await dcv.valeurPlafondPropre(dcv.plafondVideosFa())).toBe(0.6);
    await ecrireParametre(dcv.PARAM_PLAFOND_VIDEOS_FA, 0.9);
    expect(await dcv.valeurPlafondPropre(dcv.plafondVideosFa())).toBe(0.9);
    expect(await dcv.plafondKitUsd()).toBe(0.3);
    const v = await video();
    const appels = brancherClaude();
    const r = await dcv.executerRolePourVideo(v.id, roleControleVideoV4(), entree, { etape: ETAPE, plafondPropre: dcv.plafondVideosFa() });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.simule).toBe(false);
      expect(r.texte).toMatch(/littéral/);
      expect(r.coutUsd).toBeGreaterThan(0);
    }
    expect(appels).toHaveLength(1);
    expect(appels[0]).toMatch(/claude-sonnet-5-5/);
    expect(appels[0]).not.toMatch(/opus/);
  });

  it("ses dépenses et réservations ne comptent PAS dans le plafond des textes de publication (0,30 $)", async () => {
    const v = await video();
    brancherClaude();
    await dcv.executerRolePourVideo(v.id, roleControleVideoV4(), entree, { etape: ETAPE, plafondPropre: dcv.plafondVideosFa() });
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondVideosFa())).toBeGreaterThan(0);
    expect(await dcv.engageClaudeVideoCentimes(v.id)).toBe(0);
  });

  it("l'enveloppe commence au début de la version (`depuis`) : la dépense d'une version précédente ne compte pas ; plafond atteint → rien ne part", async () => {
    const v = await video();
    const appels = brancherClaude();
    await depense(v.id, ETAPE, 200, "2026-10-01T10:00:00.000Z"); // ancienne version : 2 € > 0,60 $
    const depuis = "2026-10-18T09:00:00.000Z";
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondVideosFa(depuis))).toBe(0);
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondVideosFa())).toBeGreaterThan(0);
    const bloque = await dcv.executerRolePourVideo(v.id, roleControleVideoV4(), entree, { etape: ETAPE, plafondPropre: dcv.plafondVideosFa() });
    expect(bloque).toMatchObject({ ok: false, arret: "plafond-video" });
    expect(appels).toHaveLength(0);
    const ok = await dcv.executerRolePourVideo(v.id, roleControleVideoV4(), entree, { etape: ETAPE, plafondPropre: dcv.plafondVideosFa(depuis) });
    expect(ok.ok).toBe(true);
    expect(appels).toHaveLength(1);
  });

  it("préfixes DISJOINTS : une dépense « favid » ne réduit pas le plafond du réalisateur (« faclaude »), et inversement", async () => {
    const faclaude = { id: "faclaude" as never, parametre: "facecamAnimee.plafondClaudeUsd", defautUsd: 4, prefixeEtape: "Face caméra animée ·" };
    const v = await video();
    await depense(v.id, ETAPE, 50);
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondVideosFa())).toBeGreaterThan(0);
    expect(await dcv.engagePlafondPropreCentimes(v.id, faclaude)).toBe(0);
    await depense(v.id, "Face caméra animée · mise en scène", 70);
    expect(await dcv.engagePlafondPropreCentimes(v.id, faclaude)).toBeGreaterThan(0);
    const videos = await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondVideosFa());
    await depense(v.id, "Face caméra animée · mise en scène", 70);
    expect(await dcv.engagePlafondPropreCentimes(v.id, dcv.plafondVideosFa())).toBe(videos);
  });

  it("plafond RESTANT du compteur local : réglage moins ce qui est déjà dépensé depuis le début de la version (jamais négatif)", async () => {
    const v = await video();
    const depuis = "2026-10-18T09:00:00.000Z";
    expect(await dcv.plafondRestantVideosFa(v.id, depuis)).toBeCloseTo(0.6, 5);
    await depense(v.id, ETAPE, 200, "2026-10-01T10:00:00.000Z"); // version précédente : ignorée
    expect(await dcv.plafondRestantVideosFa(v.id, depuis)).toBeCloseTo(0.6, 5);
    await depense(v.id, ETAPE, 20, "2026-10-18T10:00:00.000Z");
    const reste = await dcv.plafondRestantVideosFa(v.id, depuis);
    expect(reste).toBeGreaterThan(0);
    expect(reste).toBeLessThan(0.6);
    await depense(v.id, ETAPE, 500, "2026-10-18T11:00:00.000Z");
    expect(await dcv.plafondRestantVideosFa(v.id, depuis)).toBe(0);
  });
});
