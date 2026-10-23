/**
 * Suppression définitive · chaque refus a une issue (2e relecture PR #334, défauts bloquants A et B).
 *  - A : une finition (miniatures, kit) qui échoue à chaque fois ne bloque plus la suppression à vie : seul le passage
 *    EN COURS des finitions refuse ; la note ratée part avec la vidéo ;
 *  - B : un brouillon du tableau animé abandonné (archivé) avec une tâche en attente part ; seul un appel vraiment en
 *    cours refuse ;
 *  - envoi Buffer « à vérifier » ou interrompu que le studio ne peut plus relire (compte retiré de Buffer, Buffer
 *    déconnecté) : refusé une heure au plus.
 * Dépôts en mémoire, doubles (aucun réseau réel), rien de payé.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { repereTexte } from "@/domaine/relecture-tableau";
import { AUJOURDHUI_EXEMPLES, ficheErreurCorrigee, texteScriptDe } from "./tableau/regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const creation = await import("@/services/tableau-creation");
const taches = await import("@/services/tableau-taches");
const travaux = await import("@/services/travaux");
const miniatures = await import("@/services/miniatures");

const MDP = "essai-suppression-issues";
const ID = "v-01";
const H = { creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" };
const PREPARATION = /est en cours de préparation : attendez la fin\./;
const fetchInterdit = () => Promise.reject(new Error("fetch interdit dans les tests"));

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  taches.tachesEnCours().clear();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", fetchInterdit);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function brouillonEnDecoupage(): Promise<string> {
  const fiche = ficheErreurCorrigee;
  const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: null, reseaux: ["verticaux"] };
  const relu = repereTexte(donnees.texte);
  const p = await creation.decouperScriptTableau(donnees, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (p.statut !== "accord-requis") throw new Error(JSON.stringify(p));
  const r = await creation.decouperScriptTableau(donnees, { accord: p.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
  return r.videoId;
}

describe("A · finition ratée à chaque fois", () => {
  it("la note ratée ne bloque plus : la suppression passe et emporte le travail et la note", async () => {
    const d = depots();
    const suite = { type: "finition" as const, videoId: ID, titre: "t", ratio: "9:16" as const, travailId: "trv-fin" };
    await d.travaux.enregistrer({ id: "trv-fin", type: "fabrication", cibleId: ID, titre: "t", etapes: [], statut: "termine", progression: 100, tentatives: 1, cleIdempotence: "k", fournisseurUtilise: "simulation", finitionAFaire: [suite], ...H });
    await d.parametres.enregistrer({ id: "fabrication.finitionAFaire.trv-fin", valeur: { le: H.creeLe, suites: [suite] }, ...H });
    const rate = vi.spyOn(miniatures, "creerMiniaturesSiAbsentes").mockRejectedValue(new Error("miniatures en panne"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await travaux.executerSuites([suite]);
    await travaux.rattraperFinitions();
    expect(rate).toHaveBeenCalled();
    expect((await d.travaux.obtenir("trv-fin"))?.finitionAFaire).toHaveLength(1);
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
    expect(await d.videos.obtenir(ID)).toBeNull();
    expect(await d.travaux.obtenir("trv-fin")).toBeNull();
    expect(await d.parametres.obtenir("fabrication.finitionAFaire.trv-fin")).toBeNull();
  });

  it("pendant l'exécution des finitions : refusée ; finie (même en échec) : acceptée", async () => {
    let lacher!: () => void;
    const bloque = new Promise<void>((ok) => (lacher = ok));
    let entree!: () => void;
    const dedans = new Promise<void>((ok) => (entree = ok));
    vi.spyOn(miniatures, "creerMiniaturesSiAbsentes").mockImplementation(async () => {
      entree();
      await bloque;
      throw new Error("miniatures en panne");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const enCours = travaux.executerSuites([{ type: "finition", videoId: ID, titre: "t", ratio: "9:16", travailId: "trv-x" }]);
    await dedans;
    await expect(videos.supprimerVideoDefinitivement(ID)).rejects.toMatchObject({ code: "EN_FABRICATION", message: expect.stringMatching(PREPARATION) });
    lacher();
    await enCours;
    expect(travaux.finitionsEnCours().size).toBe(0);
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
  });
});

describe("B · brouillon du tableau abandonné", () => {
  it("tâche en attente sur un brouillon archivé : la boucle ne la traite pas, la suppression passe", async () => {
    const videoId = await brouillonEnDecoupage();
    await videos.abandonnerBrouillon(videoId);
    const executer = vi.fn(async () => undefined);
    expect(await taches.travaillerTaches(executer)).toBe(0);
    expect(executer).not.toHaveBeenCalled();
    expect(taches.tacheActive(taches.tacheDe(await depots().videos.obtenir(videoId)))).toBe(true);
    expect(await videos.supprimerVideoDefinitivement(videoId)).toBe(true);
    expect(await depots().videos.obtenir(videoId)).toBeNull();
  });

  it("tâche en attente sur un brouillon : la suppression passe (rien n'est encore payé)", async () => {
    const videoId = await brouillonEnDecoupage();
    expect(await videos.supprimerVideoDefinitivement(videoId)).toBe(true);
  });

  it("appel vraiment en cours (tâche traitée par la boucle) : refusée, même archivée ; fini : acceptée", async () => {
    const videoId = await brouillonEnDecoupage();
    const tache = (await taches.lireTache(videoId))!;
    taches.tachesEnCours().add(tache.id);
    await expect(videos.supprimerVideoDefinitivement(videoId)).rejects.toMatchObject({ code: "EN_FABRICATION", message: expect.stringMatching(PREPARATION) });
    await videos.abandonnerBrouillon(videoId);
    await expect(videos.supprimerVideoDefinitivement(videoId)).rejects.toMatchObject({ code: "EN_FABRICATION" });
    taches.tachesEnCours().delete(tache.id);
    expect(await videos.supprimerVideoDefinitivement(videoId)).toBe(true);
  });

  it("tâche en attente supprimée juste avant que la boucle la prenne : aucun appel payé, rien n'est recréé", async () => {
    const videoId = await brouillonEnDecoupage();
    const tache = (await taches.lireTache(videoId))!;
    expect(await videos.supprimerVideoDefinitivement(videoId)).toBe(true);
    const appeler = vi.fn(async () => ({ ok: false, arret: "appel", message: "x" }) as never);
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await creation.executerTacheTableau(videoId, tache, { aujourdhui: AUJOURDHUI_EXEMPLES, appeler });
    expect(appeler).not.toHaveBeenCalled();
    expect(journal).not.toHaveBeenCalled();
    expect(await depots().videos.obtenir(videoId)).toBeNull();
    expect(await depots().tracesScriptsTableau.compter((x) => x.videoId === videoId)).toBe(0);
    // Le client qui rejoue ne lance jamais un appel neuf pour une vidéo disparue (course plus serrée).
    const appelerRejoue = taches.appelerRejoue(videoId, tache.id, appeler, []);
    await expect(appelerRejoue({ id: "decoupeur" } as never, {} as never)).rejects.toThrow(/supprimée/);
    expect(appeler).not.toHaveBeenCalled();
  });

  it("« en cours » sur un brouillon (la boucle va la reprendre ou la marquer interrompue) : refusée ; sur un brouillon archivé : acceptée", async () => {
    const videoId = await brouillonEnDecoupage();
    const tache = (await taches.lireTache(videoId))!;
    await taches.modifierTache(videoId, tache.id, (t) => t && { ...t, statut: "en-cours", enVol: { etape: "decoupage", le: H.creeLe } });
    await expect(videos.supprimerVideoDefinitivement(videoId)).rejects.toMatchObject({ code: "EN_FABRICATION" });
    await videos.abandonnerBrouillon(videoId);
    expect(await videos.supprimerVideoDefinitivement(videoId)).toBe(true);
  });
});

describe("envoi Buffer à vérifier", () => {
  const publication = (envoiCommenceLe: string) => ({
    id: "pub-av", videoId: ID, reseau: "linkedin" as const, statut: "brouillon" as const, via: "buffer" as const, date: H.creeLe, texte: "t",
    etatEnvoi: "a-verifier" as const, canalId: "canal-retire", envoiCommenceLe, ...H,
  });

  it("récent : refusée (le studio relit Buffer) ; plus d'une heure sans réponse (compte retiré) : acceptée", async () => {
    const d = depots();
    await d.publications.enregistrer(publication(new Date(Date.now() - 5 * 60_000).toISOString()) as never);
    await expect(videos.supprimerVideoDefinitivement(ID)).rejects.toMatchObject({ code: "PUBLICATION_PROGRAMMEE", message: expect.stringMatching(/envoi vers Buffer à vérifier/) });
    await d.publications.enregistrer(publication(new Date(Date.now() - 2 * 60 * 60_000).toISOString()) as never);
    expect(await videos.supprimerVideoDefinitivement(ID)).toBe(true);
  });
});
