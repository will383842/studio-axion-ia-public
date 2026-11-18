/**
 * PR-B · ESSAI BORNÉ D'UN BROUILLON chez le diffuseur : UN créneau, UN compte, brouillon seulement, 24 h au plus.
 * Dépôts en mémoire, faux diffuseur, faux client (compteur d'appels), `fetch` global qui lève, données fictives.
 * Règle de fond : jamais un réglage simulé ouvert ; chaque porte = condition générale OU essai couvrant CE créneau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import type { PostZernio } from "@/fournisseurs/publication/zernio-client";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import { creerFauxClientZernio, postExemple, CLE_FICTIVE, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";
import { serveurSimule } from "./aides/serveur-simule";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({ id: "s1" })) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO, injecterClientZernio } = await import("@/services/zernio");
const { tourEnvoisCalendrierServeur, reinitialiserTourEnvoisCalendrier } = await import("@/services/branchement-envoi-calendrier");
const essai = await import("@/services/essai-zernio");
const { envoyerVisuelDuCreneau } = await import("@/services/envoi-visuel-creneau");
const { retirerProgrammationServeur, annulerRetraitServeur } = await import("@/services/retirer-programmation");
const { deplacerProgrammation, depsDeplacementServeur, PHRASES_DEPLACEMENT } = await import("@/services/deplacer-programmation");
const { PHRASES_RETRAIT_PROGRAMMATION } = await import("@/services/retirer-programmation");
const { promouvoirBrouillons } = await import("@/services/import-buffer/promotion");
const { envoiAutoriseCalendrierClient } = await import("@/fournisseurs/publication/inscription");
const { poserEssaiZernioAction, retirerEssaiZernioAction } = await import("../../src/app/(studio)/reglages/actions-zernio");

const MIN = 60_000;
const H = 60 * MIN;
const JOUR = 24 * H;
const COMPTE_A = "compte-1:li:42";
const COMPTE_B = "compte-1:li:99";
const CLE_DIFF = "a".repeat(64);
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;
const arrondi = (t: number): number => Math.floor(t / MIN) * MIN;
const iso = (t: number): string => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
const heureDans = (jours: number): string => iso(arrondi(Date.now() + jours * JOUR));

let appelsFournisseur: DemandePublication[];
let posts: Map<string, PostZernio>;
let faux: ReturnType<typeof creerFauxClientZernio>["faux"];
let clientBrut: ReturnType<typeof creerFauxClientZernio>["client"];
let methodesClient: string[];

function fauxFournisseur(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [{ id: COMPTE_A, organisationId: "zernio", nom: "Page LinkedIn", service: "linkedin", genre: "page" }],
    envoyer: async (d: DemandePublication) => {
      appelsFournisseur.push(d);
      posts.set(`post-${appelsFournisseur.length}`, postExemple({ _id: `post-${appelsFournisseur.length}`, status: "draft", metadata: { origine: "studio", studioCle: d.cleEnvoi } }));
      return { idExterne: `ext-${appelsFournisseur.length}`, via: "zernio", statut: "brouillon" };
    },
  } as unknown as FournisseurPublication;
}

function monterClient(): void {
  posts = new Map();
  methodesClient = [];
  const reponse = (a: AppelEnregistre): ReponsePreparee => {
    const chemin = new URL(a.url).pathname.replace(/^\/api/, "");
    if (a.methode === "GET" && chemin === "/v1/posts") {
      const statut = new URL(a.url).searchParams.get("status");
      return { statut: 200, corps: { posts: [...posts.values()].filter((p) => !statut || p.status === statut) } };
    }
    const id = chemin.split("/").pop() as string;
    const p = posts.get(id);
    if (!p) return { statut: 404, corps: { error: "introuvable" } };
    if (a.methode === "DELETE") { posts.delete(id); return { statut: 200, corps: {} }; }
    if (a.methode === "PUT") { posts.set(id, { ...p, status: "scheduled" }); return { statut: 200, corps: { post: posts.get(id) } }; }
    return { statut: 200, corps: { post: p } };
  };
  const c = creerFauxClientZernio(reponse);
  faux = c.faux;
  clientBrut = c.client;
  c.horloge.avancer(Date.now() - c.horloge.maintenant());
}
const client = () =>
  new Proxy(clientBrut, { get: (cible, nom: string) => (typeof (cible as never)[nom] === "function" ? (...a: unknown[]) => { methodesClient.push(nom); return ((cible as never)[nom] as (...x: unknown[]) => unknown)(...a); } : (cible as never)[nom]) });

async function creerVisuel(): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_1", famille: "carrousel", titre: "Cinq erreurs", entree: { type: "sujet", sujet: "exemple" }, statut: "valide",
    modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le, spec: { alt: "Alt" },
    rendu: { empreinte: "e1", pdfCle: "visuels/vis_1/c.pdf", vignetteCle: "visuels/vis_1/v.png", pages: [1, 2].map((i) => ({ index: i, x1Cle: `v/p${i}.png`, x2Cle: `v/p${i}2.png` })), renduLe: le },
  } as never);
}
async function creerCreneau(id: string, p: Record<string, unknown> = {}): Promise<void> {
  await depots().creneauxEditoriaux.enregistrer({
    id, jourVise: heureDans(2).slice(0, 10), heuresParReseau: { linkedin: heureDans(2) }, compteCible: COMPTE_A, visuelId: "vis_1",
    textes: { linkedin: { texte: "Texte", premierCommentaire: "" } }, statut: "valide", decalages: 0, valideeLe: "2026-11-12T10:00:00Z", valideePar: "le fondateur", ...p,
  } as never);
}
/** Essai sur `creneauId`, posé il y a `ilYa` ms, valable `duree` ms ; `sur` écrase un champ. */
async function poserEssai(creneauId = "A", duree = 4 * H, ilYa = 10 * MIN, sur: Record<string, unknown> = {}): Promise<void> {
  const pose = Date.now() - ilYa;
  await ecrireParametre(essai.PARAM_ESSAI_BROUILLON, { version: 1, creneauId, compte: COMPTE_A, reseau: "linkedin", poseLe: iso(pose), expireLe: iso(pose + duree), ...sur });
}
const options = (extra: Record<string, unknown> = {}) => ({
  service: () => fauxFournisseur(), client: client(), maintenant: () => Date.now(), lireUrl, fichierExiste: async () => true, notifier: async () => undefined, ...extra,
});
const tour = () => tourEnvoisCalendrierServeur(options() as never);

beforeEach(async () => {
  appelsFournisseur = [];
  monterClient();
  reinitialiserDepots();
  reinitialiserRequete();
  reinitialiserTourEnvoisCalendrier();
  injecterClientZernio(client());
  vi.stubGlobal("fetch", () => Promise.reject(new Error("appel réseau réel interdit")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await creerVisuel();
});
afterEach(() => {
  injecterClientZernio(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ lecture du réglage : tout ce qui est louche = fermé */
describe("essai · lecture du réglage : toute anomalie = fermé, zéro requête", () => {
  const cas: [string, () => Promise<void>][] = [
    ["réglage absent", async () => undefined],
    ["null", async () => ecrireParametre(essai.PARAM_ESSAI_BROUILLON, null)],
    ["chaîne", async () => ecrireParametre(essai.PARAM_ESSAI_BROUILLON, "A")],
    ["version 2", async () => poserEssai("A", 4 * H, 10 * MIN, { version: 2 })],
    ["expireLe illisible", async () => poserEssai("A", 4 * H, 10 * MIN, { expireLe: "demain" })],
    ["expiré d'une seconde", async () => poserEssai("A", 4 * H, 4 * H + 1000)],
    ["durée de 24 h + 1 s", async () => poserEssai("A", 24 * H + 1000, 30 * MIN)],
    ["poseLe dans le futur", async () => poserEssai("A", 4 * H, -10 * MIN)],
    ["créneau inexistant", async () => poserEssai("fantome")],
    ["compte différent", async () => poserEssai("A", 4 * H, 10 * MIN, { compte: COMPTE_B })],
    ["réseau différent de celui du créneau", async () => poserEssai("A", 4 * H, 10 * MIN, { reseau: "instagram" })],
    ["« Tout arrêter » actif", async () => { await poserEssai(); await ecrireParametre(PARAM_ARRET_ZERNIO, false); }],
    ["lecture du dépôt qui lève", async () => { await poserEssai(); vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("lecture impossible")); }],
  ];
  it.each(cas)("%s", async (_n, preparer) => {
    await creerCreneau("A");
    await preparer();
    expect(await essai.lireEssai()).toBeNull();
    expect(await essai.essaiCouvre("A", "brouillon")).toBe(false);
    expect(await essai.essaiCouvre("A", "deplacement")).toBe(false);
    expect(faux.appels).toHaveLength(0);
  });

  it("créneau vidéo : illisible, donc fermé (v1 : visuels seulement)", async () => {
    await creerCreneau("A", { visuelId: undefined, videoId: "v1" });
    await poserEssai();
    expect(await essai.lireEssai()).toBeNull();
  });

  it("créneau portant deux réseaux : fermé", async () => {
    await creerCreneau("A", { heuresParReseau: { linkedin: heureDans(2), instagram: heureDans(2) } });
    await poserEssai();
    expect(await essai.lireEssai()).toBeNull();
  });

  it("essai valide : couvre A (brouillon, déplacement, retrait), jamais un autre identifiant", async () => {
    await creerCreneau("A");
    await creerCreneau("B");
    await poserEssai();
    expect(await essai.lireEssai()).toMatchObject({ creneauId: "A", compte: COMPTE_A });
    for (const g of ["brouillon", "deplacement", "retrait"] as const) {
      expect(await essai.essaiCouvre("A", g)).toBe(true);
      expect(await essai.essaiCouvre("B", g)).toBe(false);
      expect(await essai.essaiCouvre("A-reprise", g)).toBe(false);
    }
  });

  it("fenêtre : brouillon et déplacement jusqu'à l'expiration, retrait 24 h de plus, puis plus rien", async () => {
    await creerCreneau("A");
    await poserEssai("A", 2 * H, 3 * H);
    expect(await essai.essaiCouvre("A", "brouillon")).toBe(false);
    expect(await essai.essaiCouvre("A", "deplacement")).toBe(false);
    expect(await essai.essaiCouvre("A", "retrait")).toBe(true);
    await poserEssai("A", 2 * H, 2 * H + 24 * H + MIN);
    expect(await essai.essaiCouvre("A", "retrait")).toBe(false);
  });
});

/* ------------------------------------------------------------------ portée du tour */
describe("essai · portée : UN créneau, brouillon seulement", () => {
  it("1. portes générales fermées, A et B validés : un seul brouillon, pour A ; B : rien", async () => {
    await creerCreneau("A");
    await creerCreneau("B");
    await poserEssai("A");
    const r = await tour();
    expect(r).toMatchObject({ essai: { creneauId: "A", etat: "brouillon-cree" } });
    expect(appelsFournisseur).toHaveLength(1);
    expect(appelsFournisseur[0].cleEnvoi).toContain("vis_1");
    const envois = await depots().envoisPlanifies.lister();
    expect(envois.every((e) => e.creneauId === "A")).toBe(true);
  });

  it("2. aucune promotion, aucun PUT, même si le brouillon de A existe déjà", async () => {
    await creerCreneau("A");
    await creerCreneau("B");
    await poserEssai("A");
    await tour();
    reinitialiserTourEnvoisCalendrier();
    const r2 = await tour();
    expect(r2).toMatchObject({ essai: { creneauId: "A", etat: "deja-cree" } });
    expect(appelsFournisseur).toHaveLength(1);
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
    expect(methodesClient).not.toContain("promouvoir");
  });

  it("3. promotion d'import et promotion des envois restent fermées avec un essai valide", async () => {
    await creerCreneau("A");
    await poserEssai("A");
    const res = await promouvoirBrouillons({ client: clientBrut, postsBuffer: [], aBlanc: false, maintenant: () => Date.now() } as never);
    expect(res.refusLot).toMatch(/fermée/);
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
  });

  it("le proxy du client refuse `promouvoir` dans le contexte d'essai", async () => {
    await creerCreneau("A");
    await poserEssai("A");
    const { construireDepsEnvoiCalendrier } = await import("@/services/branchement-envoi-calendrier");
    const deps = construireDepsEnvoiCalendrier(options() as never);
    const r = await essai.dansEssai("A", () => deps.client.promouvoir({ postId: "post-1", cleJournal: CLE_DIFF, scheduledFor: heureDans(2) } as never));
    expect(r).toMatchObject({ etat: "refuse" });
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
  });

  it("5. un autre créneau pendant le contexte d'essai de A : ENVOI_CALENDRIER_FERME ; et sans contexte, même A est fermé", async () => {
    await creerCreneau("A");
    await creerCreneau("B");
    await poserEssai("A");
    await expect(essai.dansEssai("A", () => envoyerVisuelDuCreneau(fauxFournisseur(), "B", "linkedin", { lireUrl, fichierExiste: async () => true }))).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    await expect(envoyerVisuelDuCreneau(fauxFournisseur(), "A", "linkedin", { lireUrl, fichierExiste: async () => true })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appelsFournisseur).toHaveLength(0);
  });

  it("la porte du client du fournisseur suit le même principe (essai en contexte seulement)", async () => {
    await creerCreneau("A");
    await poserEssai("A");
    expect(await envoiAutoriseCalendrierClient()).toBe(false);
    expect(await essai.dansEssai("A", () => envoiAutoriseCalendrierClient())).toBe(true);
    expect(await essai.dansEssai("B", () => envoiAutoriseCalendrierClient())).toBe(false);
  });

  it("8. contexte hérité : une tâche détachée exécutée après l'expiration ne passe aucune porte", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = Date.now();
    vi.setSystemTime(t0);
    await creerCreneau("A", { heuresParReseau: { linkedin: iso(t0 + 2 * JOUR) } });
    await poserEssai("A", 1 * H, 1 * MIN);
    let liberer: () => void = () => undefined;
    const portail = new Promise<void>((r) => { liberer = r; });
    let tache!: Promise<boolean>;
    await essai.dansEssai("A", async () => {
      expect(await essai.porteCalendrierPour("A")).toBe(true);
      tache = (async () => { await portail; return essai.porteCalendrierPour("A"); })();
    });
    vi.setSystemTime(t0 + 2 * H);
    liberer();
    expect(await tache).toBe(false);
  });

  it("9. portes générales ouvertes : comportement actuel, essai présent ou non", async () => {
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
    await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
    await ecrireParametre(PARAM_ARRET_ZERNIO, true);
    await creerCreneau("A");
    await creerCreneau("B");
    await poserEssai("A");
    const r = await tour();
    expect(r.saute).toBeUndefined();
    expect(r).not.toHaveProperty("essai");
    // Tour général : les deux créneaux sont traités, comme avant.
    expect(appelsFournisseur).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ forme de la requête (fournisseur réel) */
describe("essai · la requête de création : isDraft vrai seulement, compte de l'essai seulement", () => {
  const DATE = iso(arrondi(Date.now() + 2 * JOUR));
  const fichier = "https://exemple-r2.test/v.pdf";
  const lire = async () => ({ corps: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } }), taille: 1 });
  function fournisseurReel() {
    const serveur = serveurSimule();
    const t = creerFauxClientZernio(serveur.repondre);
    return { ...t, f: creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire: lire as never, maintenant: () => Date.now() }) };
  }
  const demande = (p: Record<string, unknown> = {}) => ({ reseau: "linkedin", texte: "Texte", date: DATE, fichierCle: fichier, cible: COMPTE_A, cleEnvoi: "envoi:vis_1:linkedin:v0", ...p }) as never;
  const creations = (f: { appels: AppelEnregistre[] }) => f.appels.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));

  it("4a. brouillon du bon compte sous essai : créé avec isDraft vrai", async () => {
    await creerCreneau("A");
    await poserEssai("A");
    const { f, faux: fx } = fournisseurReel();
    await essai.dansEssai("A", () => f.envoyer(demande()));
    expect(creations(fx)).toHaveLength(1);
    expect((creations(fx)[0].json as { isDraft: boolean }).isDraft).toBe(true);
  });

  it("4b. isDraft: false sous essai : refus AVANT tout appel de création", async () => {
    await creerCreneau("A");
    await poserEssai("A");
    const { f, faux: fx } = fournisseurReel();
    await expect(essai.dansEssai("A", () => f.envoyer(demande({ mode: "programme" })))).rejects.toThrow();
    expect(creations(fx)).toHaveLength(0);
  });

  it("4c. compte du corps différent du compte de l'essai : refus avant appel de création", async () => {
    await creerCreneau("A");
    await poserEssai("A");
    const { f, faux: fx } = fournisseurReel();
    await expect(essai.dansEssai("A", () => f.envoyer(demande({ cible: "autre-compte" })))).rejects.toThrow();
    expect(creations(fx)).toHaveLength(0);
  });

  it("hors essai, le fournisseur garde son comportement (programmé possible, autre compte possible)", async () => {
    const { f, faux: fx } = fournisseurReel();
    await f.envoyer(demande({ mode: "programme", cible: "autre-compte" }));
    expect(creations(fx)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ retrait et déplacement */
describe("essai · retrait et déplacement de A seulement", () => {
  async function creerEnvoi(creneauId: string): Promise<void> {
    await depots().envoisPlanifies.enregistrer({
      id: `envoi:vis_1:linkedin:v0:${creneauId}`, cle: `envoi:vis_1:linkedin:v0:${creneauId}`, videoId: "vis_1", nature: "visuel", creneauId, cleDiffuseur: CLE_DIFF,
      reseau: "linkedin", versionCreneau: 0, jour: heureDans(2).slice(0, 10), heure: "10:00", statut: "brouillon", valideeLe: "2026-11-12T10:00:00Z", valideePar: "le fondateur",
      creeLe: "2026-11-12T10:00:00Z", modifieLe: "2026-11-12T10:00:00Z",
    } as never);
    posts.set("post-x", postExemple({ _id: "post-x", status: "draft", metadata: { studioCle: CLE_DIFF }, platforms: [{ platform: "linkedin", accountId: "compte-1", status: "draft" }] as never }));
  }

  it("6a. retrait de A sous essai : la porte s'ouvre (le diffuseur est lu) ; B : éteint", async () => {
    await creerCreneau("A");
    await creerCreneau("B");
    await creerEnvoi("A");
    await poserEssai("A");
    const rB = await retirerProgrammationServeur("B");
    expect(rB).toMatchObject({ ok: false });
    const rA = await retirerProgrammationServeur("A");
    expect(rA.ok === false && rA.message === PHRASES_RETRAIT_PROGRAMMATION.eteint).toBe(false);
    expect(faux.appels.length).toBeGreaterThan(0);
  });

  it("6b. retrait : fermé sur B même pendant l'essai de A, rien n'est lu chez le diffuseur", async () => {
    await creerCreneau("A");
    await creerCreneau("B");
    await creerEnvoi("B");
    await poserEssai("A");
    const r = await retirerProgrammationServeur("B");
    expect(r).toMatchObject({ ok: false, etat: "reste-programme", message: PHRASES_RETRAIT_PROGRAMMATION.eteint });
    expect(faux.appels).toHaveLength(0);
  });

  it("6c. retrait de A : permis 24 h après l'expiration, refusé ensuite", async () => {
    await creerCreneau("A");
    await creerEnvoi("A");
    await poserEssai("A", 2 * H, 3 * H);
    const r = await retirerProgrammationServeur("A");
    expect(r.ok === false && r.message === PHRASES_RETRAIT_PROGRAMMATION.eteint).toBe(false);
    reinitialiserDepots();
    await creerVisuel();
    await creerCreneau("A");
    await creerEnvoi("A");
    await poserEssai("A", 2 * H, 2 * H + 25 * H);
    const apres = await retirerProgrammationServeur("A");
    expect(apres).toMatchObject({ ok: false, message: PHRASES_RETRAIT_PROGRAMMATION.eteint });
  });

  const portFaux = () => ({ appels: [] as string[], port: { retirer: async (e: { cle: string }) => { portFaux.derniers.push(e.cle); return "retire" as const; } } });
  portFaux.derniers = [] as string[];

  it("6d. déplacement de A sous essai : permis jusqu'à l'expiration ; B : éteint, aucune écriture", async () => {
    portFaux.derniers = [];
    await creerCreneau("A");
    await creerCreneau("B");
    await creerEnvoi("A");
    await creerEnvoi("B");
    await poserEssai("A");
    const d = await depsDeplacementServeur(portFaux().port);
    const avantB = JSON.stringify(await depots().creneauxEditoriaux.obtenir("B"));
    const rB = await deplacerProgrammation(d, { creneauId: "B", nouveauJour: heureDans(4).slice(0, 10), cle: "f-b" });
    expect(rB).toMatchObject({ ok: false, message: PHRASES_DEPLACEMENT.eteint });
    expect(JSON.stringify(await depots().creneauxEditoriaux.obtenir("B"))).toBe(avantB);
    const rA = await deplacerProgrammation(d, { creneauId: "A", nouveauJour: heureDans(4).slice(0, 10), cle: "f-a" });
    expect(rA.ok).toBe(true);
    expect(portFaux.derniers).toEqual(["envoi:vis_1:linkedin:v0:A"]);
  });

  it("6e. déplacement de A après l'expiration : éteint, aucune écriture", async () => {
    portFaux.derniers = [];
    await creerCreneau("A");
    await creerEnvoi("A");
    await poserEssai("A", 2 * H, 3 * H);
    const d = await depsDeplacementServeur(portFaux().port);
    const avant = JSON.stringify(await depots().creneauxEditoriaux.obtenir("A"));
    const r = await deplacerProgrammation(d, { creneauId: "A", nouveauJour: heureDans(4).slice(0, 10), cle: "f-a" });
    expect(r).toMatchObject({ ok: false, message: PHRASES_DEPLACEMENT.eteint });
    expect(JSON.stringify(await depots().creneauxEditoriaux.obtenir("A"))).toBe(avant);
    expect(portFaux.derniers).toEqual([]);
  });

  it("7. « Annuler » un retrait de A : A-reprise recréé, le tour d'essai suivant ne crée aucun brouillon", async () => {
    await creerCreneau("A");
    await creerEnvoi("A");
    await poserEssai("A");
    const r = await retirerProgrammationServeur("A");
    expect(r.ok).toBe(true);
    const a = await annulerRetraitServeur("A");
    expect(a.ok).toBe(true);
    expect(await essai.essaiCouvre("A-reprise", "brouillon")).toBe(false);
    appelsFournisseur = [];
    reinitialiserTourEnvoisCalendrier();
    await tour();
    expect(appelsFournisseur).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ actions d'écran */
describe("essai · actions d'écran", () => {
  it("10a. sans session : refus, rien n'est écrit", async () => {
    const { exigerSession } = await import("@/services/auth");
    vi.mocked(exigerSession).mockRejectedValueOnce(new Error("non connecté"));
    await creerCreneau("A");
    await expect(poserEssaiZernioAction({ creneauId: "A", dureeHeures: 4 })).rejects.toThrow();
    expect(await depots().parametres.obtenir(essai.PARAM_ESSAI_BROUILLON)).toBeUndefined();
  });

  it("10b. pose : compte et réseau LUS du créneau, durée bornée, journal ; essai actif ensuite", async () => {
    await creerCreneau("A", { heuresParReseau: { linkedin: heureDans(3) } });
    const r = await poserEssaiZernioAction({ creneauId: "A", dureeHeures: 4 });
    expect(r.ok).toBe(true);
    const lu = await depots().parametres.obtenir(essai.PARAM_ESSAI_BROUILLON);
    expect(lu?.valeur).toMatchObject({ version: 1, creneauId: "A", compte: COMPTE_A, reseau: "linkedin" });
    expect(await essai.essaiCouvre("A", "brouillon")).toBe(true);
  });

  it.each([0, 25, 1.5, Number.NaN])("10c. durée %s : refus", async (h) => {
    await creerCreneau("A");
    const r = await poserEssaiZernioAction({ creneauId: "A", dureeHeures: h });
    expect(r.ok).toBe(false);
    expect(await depots().parametres.obtenir(essai.PARAM_ESSAI_BROUILLON)).toBeUndefined();
  });

  it("10d. second essai pendant un essai actif : refus", async () => {
    await creerCreneau("A");
    await creerCreneau("B");
    expect((await poserEssaiZernioAction({ creneauId: "A", dureeHeures: 4 })).ok).toBe(true);
    const r = await poserEssaiZernioAction({ creneauId: "B", dureeHeures: 4 });
    expect(r.ok).toBe(false);
    expect((await depots().parametres.obtenir(essai.PARAM_ESSAI_BROUILLON))?.valeur).toMatchObject({ creneauId: "A" });
  });

  it.each([
    ["non validé", { statut: "a_valider", valideeLe: undefined }],
    ["vidéo", { visuelId: undefined, videoId: "v1" }],
    ["deux réseaux", { heuresParReseau: { linkedin: heureDans(2), instagram: heureDans(2) } }],
    ["trop lointain (J+10)", { heuresParReseau: { linkedin: heureDans(10) } }],
    ["passé", { heuresParReseau: { linkedin: heureDans(-1) } }],
    ["dans moins d'un jour", { heuresParReseau: { linkedin: iso(Date.now() + 6 * H) } }],
  ])("10e. créneau non éligible (%s) : refus avec phrase", async (_n, p) => {
    await creerCreneau("A", p as Record<string, unknown>);
    const r = await poserEssaiZernioAction({ creneauId: "A", dureeHeures: 4 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message.length).toBeGreaterThan(10);
    expect(await depots().parametres.obtenir(essai.PARAM_ESSAI_BROUILLON)).toBeUndefined();
  });

  it("10f. retirer l'essai écrit null ; le tour suivant rend « porte fermée »", async () => {
    await creerCreneau("A");
    await poserEssai("A");
    const r = await retirerEssaiZernioAction();
    expect(r.ok).toBe(true);
    expect((await depots().parametres.obtenir(essai.PARAM_ESSAI_BROUILLON))?.valeur).toBeNull();
    expect(await tour()).toEqual({ saute: "porte-fermee" });
    expect(appelsFournisseur).toHaveLength(0);
  });
});
