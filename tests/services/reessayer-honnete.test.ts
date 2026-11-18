/**
 * S-02 · « Reprendre » n'est plus proposé pour rien. Par le chemin réel : la vraie action partagée `reessayerTravailAction`
 * (celle de l'accueil), des dépôts en mémoire, une vraie vidéo lancée par le service du cas concret, aucun appel réel.
 *  a) refus définitif du cas concret : rien n'est relancé, la phrase dit quoi faire, le travail est INCHANGÉ ;
 *  b) refus TABLEAU_ : même refus par l'action ; contre-épreuve : `relancerTableau` passe toujours par `reessayerTravail` ;
 *  c) échec réessayable et attente de validation : l'action relance comme avant ;
 *  d) tâche de découpage bloquée : « Le découpage ne répond plus » ; écriture : phrase d'avant.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { ErreurTravail, Travail } from "@/domaine/types";
import { RELU_RECRUTEMENT } from "../helpers/script-relu";
import { DEMANDE_MODELE } from "../tableau-scripts/modele-valide";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ replace() {}, push() {}, refresh() {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: () => true };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const creation = await import("@/services/tableau-creation");
const taches = await import("@/services/tableau-taches");
const { reessayerTravailAction } = await import("@/app/(studio)/actions");
const { ecrireParametre } = await import("@/services/_commun");
const { ETAPES_CAS_CONCRET } = await import("@/moteurs/montage-cas-concret/outils");

const MDP = "reessayer-honnete";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

beforeAll(async () => {
  process.env.SESSION_SECRET = "x".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

let appelsReseau = 0;
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  taches.tachesEnCours().clear();
  appelsReseau = 0;
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", (async () => {
    appelsReseau++;
    throw new Error("réseau interdit");
  }) as typeof fetch);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Une vraie vidéo du cas concret, lancée par le service ; son travail. */
async function lancerUneVideo(): Promise<Travail> {
  const r = await service.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: false, accordCentimes: 100_000, empreinteScriptRelu: RELU_RECRUTEMENT });
  expect(r.statut).toBe("lancee");
  const [t] = await depots().travaux.lister((x) => x.type === "fabrication" && x.cibleId === (r as { videoId: string }).videoId);
  return t;
}

/** Le travail arrêté à `etape` avec l'erreur donnée, comme le moteur la laisse (voix payée gardée au journal). */
async function arreter(t: Travail, etape: (typeof ETAPES_CAS_CONCRET)[number], erreur: ErreurTravail): Promise<Travail> {
  const rang = ETAPES_CAS_CONCRET.indexOf(etape);
  const arrete: Travail = {
    ...t,
    statut: "echec",
    erreur,
    etapes: t.etapes.map((e, i) => (i < rang ? { ...e, statut: "terminee" as const, progression: 100 } : i === rang ? { ...e, statut: "echec" as const, erreur } : { ...e, statut: "en_attente" as const })),
    parametres: { ...t.parametres, casConcret: { atteinte: rang - 1, journal: { version: "x", etapes: {}, voix: { empreinte: "v", etat: { payees: [{ fournisseur: "heygen", caracteres: 900, coutCentimes: 42 }] } } } } },
  };
  await depots().travaux.enregistrer(arrete);
  return arrete;
}

const FICHE_REFUSEE: ErreurTravail = { code: "CAS_CONCRET_FICHE_REFUSEE", reessayable: false, messagePourWill: "La fiche du cas est refusée." };

describe("a) refus définitif : « Reprendre » ne relance plus rien", () => {
  it("CAS_CONCRET_FICHE_REFUSEE : phrase d'action, travail inchangé, rien dépensé, aucun appel réseau", async () => {
    const t = await arreter(await lancerUneVideo(), "fiche", FICHE_REFUSEE);
    const depenses = await depots().depenses.compter();
    const r = await reessayerTravailAction(t.id);
    expect(r).toEqual({ ok: false, message: "La fiche du cas est refusée. Ce refus reviendrait à l'identique : reprenez le cas ou la fiche depuis la page de la vidéo." });
    expect(await depots().travaux.obtenir(t.id)).toEqual(t);
    expect(await depots().depenses.compter()).toBe(depenses);
    expect(appelsReseau).toBe(0);
  });
});

describe("b) refus TABLEAU_ non réessayable", () => {
  const TABLEAU: ErreurTravail = { code: "TABLEAU_ECHEC", reessayable: false, messagePourWill: "Le calage sur la voix n'a pas abouti." };

  it("l'action refuse avec la phrase du tableau, travail inchangé", async () => {
    const t = await arreter(await lancerUneVideo(), "calage", TABLEAU);
    const r = await reessayerTravailAction(t.id);
    expect(r).toEqual({ ok: false, message: "Le calage sur la voix n'a pas abouti. Ce refus reviendrait à l'identique : ouvrez la vidéo, corrigez la fiche ou touchez « Relancer » sur sa page." });
    expect(await depots().travaux.obtenir(t.id)).toEqual(t);
  });

  it("contre-épreuve : « Relancer » du tableau (relancerTableau) relance le même travail comme avant, par reessayerTravail", async () => {
    const base = await lancerUneVideo();
    const video = (await depots().videos.obtenir(base.cibleId))!;
    await depots().videos.enregistrer({ ...video, formatId: "tableau-anime" });
    const version = (await depots().versions.obtenir(base.versionId!))!;
    await depots().versions.enregistrer({ ...version, commande: { ...version.commande, formatId: "tableau-anime" } });
    const arret = await arreter(base, "calage", TABLEAU);
    const r = await creation.relancerTableau(arret.id, undefined, {});
    expect(r).toMatchObject({ statut: "relancee", travailId: arret.id });
    const apres = (await depots().travaux.obtenir(arret.id))!;
    expect(apres).toMatchObject({ statut: "en_cours", erreur: undefined, tentatives: arret.tentatives + 1 });
  });
});

describe("c) échec réessayable ou attente de validation : l'action relance comme avant", () => {
  it.each([
    ["FACECAM_NON_RELIE", { code: "FACECAM_NON_RELIE", reessayable: true, messagePourWill: "Le montage n'est pas relié." }],
    ["PANNE_SANS_NOUVELLE", { code: "PANNE_SANS_NOUVELLE", reessayable: true, messagePourWill: "Plus de nouvelles." }],
    ["attente de validation", { code: "CAS_CONCRET_SCRIPT_A_VALIDER", reessayable: true, messagePourWill: "Le script attend votre validation." }],
  ] as const)("%s", async (_nom, erreur) => {
    const t = await arreter(await lancerUneVideo(), "ecriture", erreur);
    const r = await reessayerTravailAction(t.id);
    if (!r.ok) throw new Error(`relance refusée : ${r.message}`);
    const apres = (await depots().travaux.obtenir(t.id))!;
    expect(apres).toMatchObject({ statut: "en_cours", tentatives: t.tentatives + 1 });
  });
});

describe("d) tâche du tableau bloquée 30 min : le message dit la bonne tâche", () => {
  async function bloquer(type: "ecriture" | "decoupage"): Promise<string> {
    const prix = (await creation.ecranCreationTableau()).ecriture.coutCentimes;
    const r = await creation.ecrireScriptTableau({ ...DEMANDE_MODELE, vraiCas: null }, { accord: prix }, { client: { simule: true, appeler: () => new Promise<never>(() => undefined) } });
    if (r.statut !== "en-cours") throw new Error(JSON.stringify(r));
    if (type === "decoupage") await taches.modifierTache(r.videoId, null, (t) => t && { ...t, type: "decoupage", etape: "decoupage" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const travail = taches.travaillerTaches(() => new Promise<void>(() => undefined));
    await vi.advanceTimersByTimeAsync(taches.DELAI_TACHE_TABLEAU_MS + 1_000);
    await travail;
    return r.videoId;
  }
  const messageDe = async (videoId: string) => taches.tacheDe(await depots().videos.obtenir(videoId))?.message;

  it("découpage : « Le découpage ne répond plus : reprenez-le. »", async () => {
    expect(await messageDe(await bloquer("decoupage"))).toBe("Le découpage ne répond plus : reprenez-le.");
  });

  it("écriture : le message d'avant, mot pour mot", async () => {
    expect(await messageDe(await bloquer("ecriture"))).toBe("L'écriture ne répond plus : reprenez-la.");
  });
});
