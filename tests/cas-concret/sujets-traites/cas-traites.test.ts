/**
 * CAS TRAITÉS (ordre de Will, 23/10/2026) : un cas dont la vidéo est allée au bout n'est plus disponible : estimation et
 * lancement refusent net (avant le prix, sans brouillon ni dépense), même avec un jeton ou le réglage `sujets.garde` éteint ;
 * Will peut le remettre en stock. Base en mémoire, lancement simulé : aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Petite banque de l'Usine : jamais d'import à froid du fichier de 2,8 Mo dans ces tests.
vi.mock("@/donnees/bases-usine", () => ({ metiers: () => [], casUsage: () => [] }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const scripts = await import("@/services/cas-concret-scripts");
const service = await import("@/services/cas-concret");
const { ecrireParametre } = await import("@/services/_commun");
await import("@/services/videos");
const traites = await import("@/services/cas-concret-traites");
const { SCRIPT_V4_RECRUTEMENT } = await import("@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs");

import type { Video } from "@/domaine/types";
import { PHRASE_CAS_TRAITE } from "@/domaine/cas-traites";

const MDP = "cas-sujets-traites";
const CAS = "recrutement-apporteurs";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());
beforeEach(() => lancer.mockClear());

const RELU = scripts.empreinteScriptValide(SCRIPT_V4_RECRUTEMENT);
let n = 0;
const lancer = vi.fn(async () => ({ travailId: `t-sj-${++n}` }));
const demande = (o: Partial<Parameters<typeof service.preparerEtLancer>[0]> = {}) => ({ casId: CAS, reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 10_000, empreinteScriptRelu: RELU, ...o });

function video(id: string, extra: Partial<Video> = {}): Video {
  const maintenant = new Date().toISOString();
  return { id, titre: "Recruter des apporteurs", sujet: "x", formatId: "cas-concret", statut: "prete", entrees: { casConcret: { casId: CAS } }, creeLe: maintenant, modifieLe: maintenant, ...extra } as unknown as Video;
}
const nombre = (c: "videos" | "depenses" | "travaux") => depots()[c].compter();

const PHRASE = PHRASE_CAS_TRAITE;
const compter = async () => ({ videos: await nombre("videos"), depenses: await nombre("depenses"), travaux: await nombre("travaux") });

describe("cas traité : refus net côté serveur", () => {
  it("estimer renvoie le refus, sans rien créer", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const avant = await compter();
    const e = await service.estimerCas(CAS, RESEAUX, false);
    expect(e.refus).toBe(PHRASE);
    expect(e.dejaTraite).toBeUndefined();
    expect(await compter()).toEqual(avant);
  });

  it("lancer renvoie `refusee`, sans brouillon, sans dépense, sans lancement", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const avant = await compter();
    const r = await service.preparerEtLancer(demande(), { lancer });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASE });
    expect(await compter()).toEqual(avant);
    expect(lancer).not.toHaveBeenCalled();
  });

  it("aucun jeton « refaire » ni « nouvel angle » ne contourne le refus", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    for (const choix of ["refaire", "nouvel-angle"] as const) {
      const r = await service.preparerEtLancer(demande({ sujet: { choix, jeton: "0123456789abcdef" }, nouveauScript: choix === "nouvel-angle" }), { lancer });
      expect(r).toEqual({ statut: "refusee", phrase: PHRASE });
    }
    expect(lancer).not.toHaveBeenCalled();
  });

  it("même avec un brouillon repris du même cas", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    await depots().videos.enregistrer(video("v-brouillon", { statut: "brouillon" }));
    const r = await service.preparerEtLancer(demande(), { lancer });
    expect(r).toEqual({ statut: "refusee", phrase: PHRASE });
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
  });

  it("même si le réglage `sujets.garde` est éteint", async () => {
    await ecrireParametre("sujets.garde", "eteint");
    await depots().videos.enregistrer(video("v-prete"));
    expect(await service.preparerEtLancer(demande(), { lancer })).toEqual({ statut: "refusee", phrase: PHRASE });
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
  });

  it("la corbeille compte ; vidéo finie supprimée pour de bon (même sans inscription préalable) : le cas reste traité", async () => {
    await depots().videos.enregistrer(video("v-corbeille", { statut: "archivee", statutAvantArchive: "prete" } as Partial<Video>));
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
    // Finie AVANT la mise en place de l'inscription : seule la suppression doit l'inscrire.
    expect((await depots().parametres.obtenir("casConcret.casTraites"))?.valeur).toBeUndefined();
    const { supprimerVideosSansSession } = await import("@/services/videos");
    expect((await supprimerVideosSansSession(["v-corbeille"])).supprimees).toBe(1);
    expect(await depots().videos.obtenir("v-corbeille")).toBeNull();
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
    expect((await service.preparerEtLancer(demande(), { lancer })).statut).toBe("refusee");
  });

  it("suppression d'une vidéo finie avant la PR (hors corbeille) : le cas reste traité", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const { supprimerVideosSansSession } = await import("@/services/videos");
    await supprimerVideosSansSession(["v-prete"]);
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
  });

  it("purge automatique de la corbeille (30 jours, sans session) : le cas reste traité", async () => {
    const vieux = new Date(Date.now() - 31 * 86_400_000).toISOString();
    await depots().videos.enregistrer(video("v-purge", { statut: "archivee", statutAvantArchive: "prete", corbeilleLe: vieux } as Partial<Video>));
    const { purgerCorbeille } = await import("@/services/corbeille");
    expect((await purgerCorbeille()).supprimees).toBe(1);
    expect(await depots().videos.obtenir("v-purge")).toBeNull();
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
  });

  it("supprimer une vidéo en panne ou une démonstration n'inscrit rien", async () => {
    const { supprimerVideosSansSession } = await import("@/services/videos");
    await depots().videos.enregistrer(video("v-panne", { statut: "echec" }));
    await depots().videos.enregistrer(video("v-demo", { estDemo: true }));
    await supprimerVideosSansSession(["v-panne", "v-demo"]);
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBeUndefined();
  });

  it("passe d'inscription unique : une vidéo finie avant la PR est inscrite, ajouts seulement, idempotente", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    const src = { ...traites.SOURCES_CAS_TRAITES };
    expect(await traites.inscrireLesCasDejaTraites(src)).toBe(1);
    expect(await traites.inscrireLesCasDejaTraites(src)).toBe(0);
    await depots().videos.supprimer("v-prete");
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
  });

  it("porte B : une vidéo finie de la porte B ne rend aucun cas traité, le lancement reste permis", async () => {
    await depots().videos.enregistrer(video("v-b", { entrees: { casConcret: { casId: CAS, porte: "porte-b" } } }));
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBeUndefined();
    expect(await traites.noterCasTraite({ id: "v-b", titre: "B", formatId: "cas-concret", entrees: { casConcret: { casId: CAS, porte: "porte-b" } } })).toBe(false);
  });

  it("en file, en fabrication, en panne : le cas n'est PAS traité (le contrôle à trois choix reste pour en cours)", async () => {
    await depots().videos.enregistrer(video("v-cours", { statut: "en_fabrication" }));
    const e = await service.estimerCas(CAS, RESEAUX, false);
    expect(e.refus).toBeUndefined();
    expect(e.dejaTraite).toMatchObject({ niveau: "identique" });
    await depots().videos.supprimer("v-cours");
    await depots().videos.enregistrer(video("v-panne", { statut: "echec" }));
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBeUndefined();
  });

  it("une démonstration ou un autre cas ne retire pas ce cas", async () => {
    await depots().videos.enregistrer(video("v-demo", { estDemo: true }));
    await depots().videos.enregistrer(video("v-autre", { entrees: { casConcret: { casId: "autre-cas" } } }));
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBeUndefined();
  });

  it("remis en stock par Will : le cas est de nouveau libre ; une nouvelle vidéo finie le retire de nouveau", async () => {
    await depots().videos.enregistrer(video("v-prete"));
    await traites.remettreEnStock(CAS);
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBeUndefined();
    await depots().videos.enregistrer(video("v-neuve", { terminee: new Date(Date.now() + 60_000).toISOString() }));
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
  });
});

describe("action « Remettre en stock »", () => {
  it("sans session : refus, le cas reste traité", async () => {
    const { remettreEnStockAction } = await import("@/app/(studio)/cas-concret/actions");
    await depots().videos.enregistrer(video("v-prete"));
    await auth.seDeconnecter();
    // Sans session, `exigerSession` redirige vers la connexion : rien n'est écrit.
    await expect(remettreEnStockAction(CAS)).rejects.toThrow(/REDIRECT/);
    await auth.seConnecter(MDP, false);
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBe(PHRASE);
  });

  it("avec session : le cas réapparaît, une trace est journalisée, la vidéo reste", async () => {
    const { remettreEnStockAction } = await import("@/app/(studio)/cas-concret/actions");
    await depots().videos.enregistrer(video("v-prete"));
    const r = await remettreEnStockAction(CAS);
    expect(r.ok).toBe(true);
    expect((await service.estimerCas(CAS, RESEAUX, false)).refus).toBeUndefined();
    expect(await depots().videos.obtenir("v-prete")).toBeTruthy();
    expect(await depots().evenements.trouver((e) => e.type === "cas-concret" && e.message.includes(CAS))).toBeTruthy();
  });

  it("un identifiant qui n'est pas un cas du catalogue, ou un cas pas traité : refus propre, rien d'écrit", async () => {
    const { remettreEnStockAction } = await import("@/app/(studio)/cas-concret/actions");
    const inconnu = await remettreEnStockAction("<script>alert(1)</script>");
    expect(inconnu).toMatchObject({ ok: false, code: "CAS_INCONNU" });
    expect(await remettreEnStockAction("x".repeat(1000))).toMatchObject({ ok: false, code: "CAS_INCONNU" });
    expect(await remettreEnStockAction(CAS)).toMatchObject({ ok: false, code: "CAS_INCONNU" });
    expect((await depots().parametres.obtenir("casConcret.casRemis"))?.valeur).toBeUndefined();
    expect(JSON.stringify(await depots().evenements.lister())).not.toContain("<script>");
  });
});
