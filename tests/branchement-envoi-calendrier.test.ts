/**
 * L5-02c : branchement serveur (ÉTEINT) du tour des publications validées du calendrier (visuels seulement en V1).
 * Dépôts en mémoire, faux fournisseur de publication (compteur d'`envoyer`), faux client du diffuseur (compteur par méthode),
 * stockage doublé, `fetch` global qui lève, horloge injectée : aucun appel réel, aucun envoi réel. Données fictives.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import type { PostZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./zernio/aides/faux-zernio";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

// Espions (le vrai code est appelé) : prouvent les appels sans option de production pour les remplacer.
const espion = vi.hoisted(() => ({ visuel: vi.fn(), reel: vi.fn(), tour: vi.fn() }));
vi.mock("@/services/envoi-visuel-creneau", async (orig) => {
  const m = await orig<typeof import("@/services/envoi-visuel-creneau")>();
  return { ...m, envoyerVisuelDuCreneau: (...a: Parameters<typeof m.envoyerVisuelDuCreneau>) => espion.visuel(...a) };
});
vi.mock("@/services/publications", async (orig) => {
  const m = await orig<typeof import("@/services/publications")>();
  return { ...m, envoyerReel: (...a: unknown[]) => espion.reel(...a) };
});
vi.mock("@/services/branchement-envoi-calendrier", async (orig) => {
  const m = await orig<typeof import("@/services/branchement-envoi-calendrier")>();
  return { ...m, tourEnvoisCalendrierServeur: (...a: Parameters<typeof m.tourEnvoisCalendrierServeur>) => espion.tour(...a) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
const branchement = await import("@/services/branchement-envoi-calendrier");
const { tourEnvoisCalendrierServeur, construireDepsEnvoiCalendrier, reinitialiserTourEnvoisCalendrier } = branchement;
const { validerEntree, validerEntreeServeur } = await import("@/services/valider-entree");
const { reessayerEnvoi } = await import("@/services/reprise-envois");
const { lancerAnnexe, annexesEnVol, contenuDuTour } = await import("@/services/boucle");

const MIN = 60_000;
const JOUR = 24 * 60 * MIN;
const RACINE = join(__dirname, "..");
const source = (p: string): string => readFileSync(join(RACINE, p), "utf8");
const COMPTES = { linkedin: "compte-1:li:42", instagram: "compte-2", facebook: "compte-1:fb:page-1" } as const;
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;
const arrondi = (t: number): number => Math.floor(t / MIN) * MIN;
const DEBUT = arrondi(Date.now());
const VALIDEE = "2026-11-12T10:00:00Z";
const ALT = "Cinq erreurs courantes à éviter";

let appelsFournisseur: DemandePublication[] = [];
let posts: Map<string, PostZernio>;
let faux: ReturnType<typeof creerFauxClientZernio>["faux"];
let clientBrut: ReturnType<typeof creerFauxClientZernio>["client"];
let horloge: ReturnType<typeof creerFauxClientZernio>["horloge"];
let methodesClient: string[];
let notifications: { titre: string; message?: string; lien?: string }[];
let maintenant: number;
let echec: string | null;

function fauxFournisseur(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [
      { id: COMPTES.linkedin, organisationId: "zernio", nom: "Page LinkedIn", service: "linkedin", genre: "page" },
      { id: COMPTES.instagram, organisationId: "zernio", nom: "Compte Instagram", service: "instagram" },
      { id: COMPTES.facebook, organisationId: "zernio", nom: "Page Facebook", service: "facebook", genre: "page" },
    ],
    envoyer: async (d: DemandePublication) => {
      appelsFournisseur.push(d);
      if (echec === "refus") throw new ErreurZernio("refuse", "refus net", { statut: 400 });
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
    if (a.methode === "PUT") {
      posts.set(id, { ...p, status: "scheduled", scheduledFor: (a.json as { scheduledFor: string }).scheduledFor });
      return { statut: 200, corps: { post: posts.get(id) } };
    }
    return { statut: 200, corps: { post: p } };
  };
  const c = creerFauxClientZernio(reponse);
  faux = c.faux;
  horloge = c.horloge;
  clientBrut = c.client;
  horloge.avancer(maintenant - horloge.maintenant());
}
const client = () =>
  new Proxy(clientBrut, { get: (cible, nom: string) => (typeof (cible as never)[nom] === "function" ? (...a: unknown[]) => { methodesClient.push(nom); return ((cible as never)[nom] as (...x: unknown[]) => unknown)(...a); } : (cible as never)[nom]) });

async function ouvrirTout(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
}

async function creerVisuel(p: Record<string, unknown> = {}): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_1", famille: "carrousel", titre: "Cinq erreurs courantes", entree: { type: "sujet", sujet: "exemple" }, statut: "valide",
    modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le, spec: { alt: ALT },
    rendu: {
      empreinte: "e1", pdfCle: "visuels/vis_1/carrousel.pdf", vignetteCle: "visuels/vis_1/v.png",
      pages: [1, 2, 3].map((i) => ({ index: i, x1Cle: `visuels/vis_1/p${i}.png`, x2Cle: `visuels/vis_1/p${i}@2x.png` })), renduLe: le,
    },
    ...p,
  } as never);
}

const heureDu = (jours: number): string => new Date(arrondi(DEBUT + jours * JOUR)).toISOString().replace(/\.\d{3}Z$/, "Z");

async function creerCreneau(id: string, reseau: "linkedin" | "instagram" | "facebook", p: Record<string, unknown> = {}): Promise<void> {
  await depots().creneauxEditoriaux.enregistrer({
    id, jourVise: heureDu(2).slice(0, 10), heuresParReseau: { [reseau]: heureDu(2) }, compteCible: COMPTES[reseau], visuelId: "vis_1",
    textes: { [reseau]: { texte: `Texte ${reseau}`, premierCommentaire: "" } },
    statut: "valide", decalages: 0, valideeLe: VALIDEE, valideePar: "le fondateur", ...p,
  } as never);
}

const options = (extra: Record<string, unknown> = {}) => ({
  service: () => fauxFournisseur(), client: client(), maintenant: () => maintenant, lireUrl, fichierExiste: async () => true,
  notifier: async (n: { titre: string; message?: string; lien?: string }) => { notifications.push(n); }, ...extra,
});
const tour = (extra: Record<string, unknown> = {}) => tourEnvoisCalendrierServeur(options(extra) as never);
/** Un tour de plus, 6 minutes après le précédent (le tour est limité à un toutes les 5 minutes). */
const tourSuivant = async (extra: Record<string, unknown> = {}) => { maintenant += 6 * MIN; horloge.avancer(6 * MIN); return tour(extra); };

const duVisuel = async () => depots().publications.lister((p) => p.visuelId === "vis_1" && p.via === "zernio");
const totaux = async () => ({ publications: await depots().publications.compter(), envois: await depots().envoisPlanifies.compter() });

beforeEach(async () => {
  espion.visuel.mockReset().mockImplementation(async (...a: unknown[]) => (await vi.importActual<typeof import("@/services/envoi-visuel-creneau")>("@/services/envoi-visuel-creneau")).envoyerVisuelDuCreneau(...(a as Parameters<typeof import("@/services/envoi-visuel-creneau").envoyerVisuelDuCreneau>)));
  espion.reel.mockReset().mockImplementation(() => { throw new Error("envoyerReel ne doit pas être appelé en V1"); });
  espion.tour.mockReset().mockImplementation(async (...a: unknown[]) => (await vi.importActual<typeof import("@/services/branchement-envoi-calendrier")>("@/services/branchement-envoi-calendrier")).tourEnvoisCalendrierServeur(...(a as never[])));
  appelsFournisseur = [];
  notifications = [];
  echec = null;
  maintenant = DEBUT;
  monterClient();
  reinitialiserDepots();
  reinitialiserRequete();
  reinitialiserTourEnvoisCalendrier();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("appel réseau réel interdit")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("L5-02c · interrupteurs éteints = aucun appel", () => {
  const cas: [string, () => Promise<void>, Record<string, unknown>?][] = [
    ["défaut (aucun réglage écrit)", async () => undefined],
    ["envoi du calendrier seul à vrai", async () => ecrireParametre(PARAM_ENVOI_CALENDRIER, true)],
    ["publication éditoriale seule à vrai", async () => ecrireParametre(PARAM_EDITORIALE_ACTIVE, true)],
    ["envoi général à faux, les deux autres à vrai", async () => { await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true); await ecrireParametre(PARAM_ENVOI_CALENDRIER, true); await ecrireParametre(PARAM_ARRET_ZERNIO, false); }],
    ["lecture des réglages qui lève", async () => { await ouvrirTout(); vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("lecture impossible")); }],
  ];
  it.each(cas)("%s : ni plan, ni publications, ni client, ni envoi ; totaux inchangés", async (_n, preparer, extra) => {
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    await preparer();
    const lectures = vi.spyOn(depots().creneauxEditoriaux, "lister");
    const lecturesPublications = vi.spyOn(depots().publications, "lister");
    const avant = await totaux();
    const r = await tour(extra);
    expect(r).toEqual({ saute: "porte-fermee" });
    expect(lectures).not.toHaveBeenCalled();
    expect(lecturesPublications).not.toHaveBeenCalled();
    expect(espion.visuel).not.toHaveBeenCalled();
    expect(espion.reel).not.toHaveBeenCalled();
    expect(appelsFournisseur).toHaveLength(0);
    expect(faux.appels).toHaveLength(0);
    expect(methodesClient).toHaveLength(0);
    expect(await totaux()).toEqual(avant);
    expect(notifications).toHaveLength(0);
  });

  it("construire les dépendances n'appelle rien : ni client, ni lecture", () => {
    const d = construireDepsEnvoiCalendrier({ client: client(), service: () => fauxFournisseur() } as never);
    expect(typeof d.creneaux).toBe("function");
    expect(methodesClient).toHaveLength(0);
    expect(faux.appels).toHaveLength(0);
  });

  it("validation depuis le serveur, tout éteint : « valide », libellé éteint, aucun appel", async () => {
    await creerVisuel();
    await creerCreneau("c1", "linkedin", { statut: "a_valider", valideeLe: undefined, valideePar: undefined });
    const r = await validerEntreeServeur("c1", "le fondateur");
    expect(r.ok).toBe(true);
    expect((await depots().creneauxEditoriaux.obtenir("c1"))?.statut).toBe("valide");
    expect(appelsFournisseur).toHaveLength(0);
    expect(faux.appels).toHaveLength(0);
    expect(await depots().envoisPlanifies.compter()).toBe(0);
  });
});

describe("L5-02c · libellés vrais à la validation", () => {
  const plan = (statut: "a_valider" | "valide" = "a_valider") => {
    const t = Date.now() + 2 * JOUR;
    const c = { id: "c1", jourVise: "2026-12-01", heuresParReseau: { linkedin: new Date(arrondi(t)).toISOString() }, compteCible: "x", visuelId: "vis_1", statut, decalages: 0 } as never;
    return {
      c,
      deps: (ouvert: boolean) => {
        let courant = c as { statut: string };
        return {
          obtenir: async () => courant as never,
          enregistrer: async (x: unknown) => { courant = x as never; return x as never; },
          versAValider: async () => undefined,
          reglagesOuverts: async () => ouvert,
        };
      },
    };
  };
  it.each([
    ["vidéo", { visuelId: undefined, videoId: "v1" }, "le fondateur"],
    ["créneau vid-", { id: "vid-1", visuelId: undefined, videoId: "v1" }, "le fondateur"],
    ["validation relayée par l'usine", {}, "usine:compte-1"],
    ["aucune heure", { heuresParReseau: {} }, "le fondateur"],
  ])("ouvert mais rien ne partira (%s) : libellé vrai, sans « partira seule »", async (_n, p, par) => {
    const base = plan();
    const c = { ...(base.c as object), ...p } as { id: string };
    let courant = c as never as { statut: string };
    const deps = { obtenir: async () => courant as never, enregistrer: async (x: unknown) => { courant = x as never; return x as never; }, versAValider: async () => undefined, reglagesOuverts: async () => true };
    const r = await validerEntree(deps, c.id, par, new Date());
    expect(r.ok && r.libelle).toBe("Validée. Elle ne part pas seule depuis le calendrier pour l'instant.");
  });
  it("fermé : libellé « éteint » inchangé", async () => {
    const p = plan();
    const r = await validerEntree(p.deps(false), "c1", "le fondateur", new Date());
    expect(r).toMatchObject({ ok: true, libelle: "Programmé, envoi éteint : rien ne partira tant que l'envoi n'est pas allumé." });
  });
  it("ouvert, sans envoi injecté : « Elle partira seule à HH:MM (heure de Paris) : le brouillon est préparé au plus tôt 6 jours avant. »", async () => {
    const p = plan();
    const r = await validerEntree(p.deps(true), "c1", "le fondateur", new Date());
    expect(r.ok && r.libelle).toMatch(/^Validée\. Elle partira seule à \d{2}:\d{2} \(heure de Paris\) : le brouillon est préparé au plus tôt 6 jours avant\.$/);
    expect(r.ok && r.envoi).toBeUndefined();
  });
});

describe("L5-02c · chemin heureux", () => {
  it("visuel validé LinkedIn + Facebook à J+2 : 2 brouillons en un tour, puis promotion des deux par cleDiffuseur", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c-li", "linkedin");
    await creerCreneau("c-fb", "facebook");
    const r1 = await tour();
    expect(r1.saute).toBeUndefined();
    expect(appelsFournisseur).toHaveLength(2);
    const li = appelsFournisseur.find((d) => d.reseau === "linkedin") as DemandePublication;
    const fb = appelsFournisseur.find((d) => d.reseau === "facebook") as DemandePublication;
    expect(li.document?.titre).toBe("Cinq erreurs courantes");
    expect(li.images).toBeUndefined();
    expect(fb.images?.map((i) => i.texteAlternatif)).toEqual([`${ALT} (page 1 sur 3)`, `${ALT} (page 2 sur 3)`, `${ALT} (page 3 sur 3)`]);
    const publications = await duVisuel();
    expect(publications).toHaveLength(2);
    expect(publications.every((p) => p.statut === "brouillon" && p.etatEnvoi === "envoye")).toBe(true);
    for (const e of await depots().envoisPlanifies.lister()) {
      expect(e.statut).toBe("valide");
      expect(e.cleDiffuseur).toBe(publications.find((p) => p.reseau === e.reseau)?.cleEnvoi);
    }
    // À H-2 : la promotion retrouve chaque brouillon par sa cleDiffuseur.
    maintenant = Date.parse(heureDu(2)) - 2 * 60 * MIN;
    horloge.avancer(maintenant - horloge.maintenant());
    await tour();
    expect(appelsFournisseur).toHaveLength(2);
    const envois = await depots().envoisPlanifies.lister();
    expect(envois.map((e) => e.statut)).toEqual(["programme", "programme"]);
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(2);
  });

  it("texte alternatif : coupé à 125 signes, suffixe « (page i sur N) » conservé ; absent = refus sans appel", async () => {
    await ouvrirTout();
    await creerVisuel({ spec: { alt: "x".repeat(300) } });
    await creerCreneau("c-fb", "facebook");
    await tour();
    const alts = (appelsFournisseur[0]?.images ?? []).map((i) => i.texteAlternatif);
    expect(alts).toHaveLength(3);
    for (const a of alts) expect([...a].length).toBeLessThanOrEqual(125);
    expect(alts[2].endsWith("(page 3 sur 3)")).toBe(true);

    reinitialiserDepots();
    appelsFournisseur = [];
    await ouvrirTout();
    await creerVisuel({ spec: undefined });
    await creerCreneau("c-fb", "facebook");
    reinitialiserTourEnvoisCalendrier();
    await tour();
    expect(appelsFournisseur).toHaveLength(0);
  });
});

describe("L5-02c · exclusions", () => {
  it("créneau « vid-… » validé : 0 appel, notifié une seule fois sur 3 tours (cloche, vouvoiement, aucun nom d'outil)", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("vid-abc", "linkedin", { visuelId: undefined, videoId: "video-1" });
    for (let i = 0; i < 3; i++) await tourSuivant();
    expect(appelsFournisseur).toHaveLength(0);
    expect(espion.visuel).not.toHaveBeenCalled();
    expect(espion.reel).not.toHaveBeenCalled();
    expect(faux.appels).toHaveLength(0);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].lien).toBe("/calendrier");
    expect(JSON.stringify(notifications)).not.toMatch(/zernio|buffer|linkedin api/i);
    expect(await depots().envoisPlanifies.compter()).toBe(0);
  });

  it("créneau déjà passé exclu : 0 appel, 0 notification (pas de bruit au premier allumage)", async () => {
    await ouvrirTout();
    await creerVisuel();
    const passe = new Date(arrondi(DEBUT - 2 * JOUR)).toISOString().replace(/\.\d{3}Z$/, "Z");
    await creerCreneau("vid-vieux", "linkedin", { visuelId: undefined, videoId: "video-1", heuresParReseau: { linkedin: passe } });
    await creerCreneau("c-vieux", "facebook", { heuresParReseau: { facebook: passe } });
    await depots().publications.enregistrer({ id: "pub-v", visuelId: "vis_1", reseau: "facebook", via: "zernio", statut: "brouillon", etatEnvoi: "envoye", date: passe, texte: "t", canalId: COMPTES.facebook, cleEnvoi: "e".repeat(64), creeLe: VALIDEE, modifieLe: VALIDEE } as never);
    await tour();
    expect(appelsFournisseur).toHaveLength(0);
    expect(notifications).toHaveLength(0);
  });

  it("vidéo validée depuis le calendrier (V1 limitée aux visuels) : 0 appel", async () => {
    await ouvrirTout();
    await creerCreneau("c-v", "linkedin", { visuelId: undefined, videoId: "video-1" });
    await tour();
    expect(appelsFournisseur).toHaveLength(0);
    expect(espion.reel).not.toHaveBeenCalled();
    expect(await depots().envoisPlanifies.compter()).toBe(0);
  });

  it.each([
    ["déjà chez le diffuseur par « À publier » sous un autre identifiant de créneau", { via: "zernio", statut: "brouillon", etatEnvoi: "envoye", cleEnvoi: "f".repeat(64) }],
    ["déjà chez l'autre outil de publication, à une autre date", { via: "buffer", statut: "programmee", etatEnvoi: "envoye", date: heureDu(9) }],
  ])("média qui occupe déjà le compte : %s : exclu, 0 appel, notifié une seule fois", async (_n, pub) => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    await depots().publications.enregistrer({ id: "pub-x", visuelId: "vis_1", reseau: "linkedin", date: heureDu(4), texte: "t", canalId: COMPTES.linkedin, creeLe: VALIDEE, modifieLe: VALIDEE, ...pub } as never);
    for (let i = 0; i < 3; i++) await tourSuivant();
    expect(appelsFournisseur).toHaveLength(0);
    expect(espion.visuel).not.toHaveBeenCalled();
    expect(notifications).toHaveLength(1);
    expect(await depots().envoisPlanifies.compter()).toBe(0);
  });

  it("une publication refusée (non occupante) n'exclut pas le créneau", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    await depots().publications.enregistrer({ id: "pub-x", visuelId: "vis_1", reseau: "linkedin", via: "zernio", statut: "echec", etatEnvoi: "refuse", date: heureDu(4), texte: "t", canalId: COMPTES.linkedin, creeLe: VALIDEE, modifieLe: VALIDEE } as never);
    await tour();
    expect(appelsFournisseur).toHaveLength(1);
  });

  it("validation relayée par l'usine (« usine: … ») : rien ne part, aucun envoi planifié, aucune notification", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin", { valideePar: "usine:compte-1" });
    for (let i = 0; i < 3; i++) await tourSuivant();
    expect(appelsFournisseur).toHaveLength(0);
    expect(espion.visuel).not.toHaveBeenCalled();
    expect(faux.appels).toHaveLength(0);
    expect(await depots().envoisPlanifies.compter()).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it.each([["retiré", { retireLe: VALIDEE }], ["refusé", { refuseLe: VALIDEE }], ["à renvoyer", { aRenvoyer: true }], ["non validé", { statut: "propose" }], ["validation illisible", { valideeLe: "n'importe quoi" }]])("créneau %s : aucune ligne, 0 appel", async (_n, p) => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin", p);
    await tour();
    expect(appelsFournisseur).toHaveLength(0);
    expect(await depots().envoisPlanifies.compter()).toBe(0);
  });
});

describe("L5-02c · un seul brouillon", () => {
  it("rejeu sur 3 tours = 1 appel au diffuseur", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    await tour();
    await tourSuivant();
    await tourSuivant();
    expect(appelsFournisseur).toHaveLength(1);
  });

  it("deux tours simultanés = 1 appel (le second est sauté) ; moins de 5 minutes après = sauté", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    const [a, b] = await Promise.all([tour(), tour()]);
    expect([a.saute, b.saute].sort()).toEqual(["tour-en-cours", undefined].sort());
    expect(appelsFournisseur).toHaveLength(1);
    const c = await tour();
    expect(c.saute).toBe("debit");
    expect(appelsFournisseur).toHaveLength(1);
  });

  it("le tour se termine vite avec les faux (aucun interblocage du verrou global)", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    const t0 = Date.now();
    await tour();
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("tour + reprise par clic (reessayerEnvoi) simultanés : 1 seul appel au diffuseur", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    echec = "refus";
    await tour();
    expect(appelsFournisseur).toHaveLength(1);
    echec = null;
    const refusee = (await duVisuel())[0];
    maintenant += 6 * MIN;
    horloge.avancer(6 * MIN);
    await Promise.allSettled([tour(), reessayerEnvoi(refusee.id, { service: fauxFournisseur(), lireUrl })]);
    expect(appelsFournisseur.filter((d) => d.cleEnvoi === refusee.cleEnvoi).length).toBeLessThanOrEqual(2);
    expect(appelsFournisseur).toHaveLength(2);
  });

  it("envoi qui ne rend jamais la main : le tour se termine, ligne « a-verifier », le tour suivant ne fait aucun appel", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    const bloque = { ...fauxFournisseur(), envoyer: (d: DemandePublication) => { appelsFournisseur.push(d); return new Promise<never>(() => undefined); } } as unknown as FournisseurPublication;
    const r = await tour({ service: () => bloque, delaiEnvoiMs: 50 });
    expect(r.saute).toBeUndefined();
    expect("resultat" in r && r.resultat.lignes[0].etat).toBe("a-verifier");
    await tourSuivant({ service: () => bloque, delaiEnvoiMs: 50 });
    await tourSuivant();
    expect(appelsFournisseur).toHaveLength(1);
  });

  it("plantage entre la création chez le diffuseur et l'écriture locale : aucun second brouillon aux tours suivants", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    const modifier = depots().envoisPlanifies.modifier.bind(depots().envoisPlanifies);
    let casse = true;
    vi.spyOn(depots().envoisPlanifies, "modifier").mockImplementation(async (id, patch) => {
      if (casse && "cleDiffuseur" in (patch as object)) throw new Error("plantage du processus");
      return modifier(id, patch);
    });
    await tour();
    casse = false;
    await tourSuivant();
    await tourSuivant();
    expect(appelsFournisseur).toHaveLength(1);
  });

  it("créneau validé puis décalé : l'ancienne version passe à « annule » AVANT la promotion, aucune promotion de l'ancien brouillon, 0 second brouillon, une seule notification", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    await tour();
    expect(appelsFournisseur).toHaveLength(1);
    // Décalage : nouvelle version, nouvelle date ; on se place dans la fenêtre de promotion de l'ANCIENNE date (H-2).
    const ancien = Date.parse(heureDu(2));
    await depots().creneauxEditoriaux.modifier("c1", { decalages: 1, heuresParReseau: { linkedin: heureDu(3) } } as never);
    maintenant = ancien - 2 * 60 * MIN;
    horloge.avancer(maintenant - horloge.maintenant());
    await tour();
    await tourSuivant();
    const envois = await depots().envoisPlanifies.lister();
    expect(envois).toHaveLength(1);
    expect(envois[0].statut).toBe("annule");
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
    expect(appelsFournisseur).toHaveLength(1);
    expect(notifications).toHaveLength(1);
  });

  it("un envoi « programme » n'est jamais touché par l'annulation des versions périmées", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    await tour();
    const [e] = await depots().envoisPlanifies.lister();
    await depots().envoisPlanifies.modifier(e.id, { statut: "programme" });
    await depots().creneauxEditoriaux.modifier("c1", { retireLe: VALIDEE } as never);
    await tourSuivant();
    expect((await depots().envoisPlanifies.obtenir(e.id))?.statut).toBe("programme");
  });

  it("créneau retiré : son envoi planifié « valide » passe à « annule » ; rien n'est supprimé", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    await tour();
    await depots().creneauxEditoriaux.modifier("c1", { retireLe: VALIDEE } as never);
    await tourSuivant();
    const envois = await depots().envoisPlanifies.lister();
    expect(envois.map((e) => e.statut)).toEqual(["annule"]);
    expect(await duVisuel()).toHaveLength(1);
  });

  it("refus net puis 5 tours : au plus 2 appels, puis « à corriger » (une notification)", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    echec = "refus";
    for (let i = 0; i < 6; i++) { if (i === 0) await tour(); else await tourSuivant(); }
    expect(appelsFournisseur).toHaveLength(2);
    expect(notifications).toHaveLength(1);
  });
});

describe("L5-02c · aucune réponse automatique", () => {
  it("le client n'est appelé que sur listerComptes, listerPosts, lirePost, promouvoir, lectureExigee", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    await tour();
    maintenant = Date.parse(heureDu(2)) - 2 * 60 * MIN;
    horloge.avancer(maintenant - horloge.maintenant());
    await tour();
    expect(methodesClient.length).toBeGreaterThan(0);
    for (const m of new Set(methodesClient)) expect(["listerComptes", "listerPosts", "lirePost", "promouvoir", "lectureExigee"]).toContain(m);
    expect(faux.appels.every((a) => a.methode === "GET" || a.methode === "PUT")).toBe(true);
  });

  it("code source : aucun import de zernio-inbox, parcours-, mots-, machine-conversation, crochet-zernio", () => {
    const s = source("src/services/branchement-envoi-calendrier.ts");
    expect(s).toMatch(/^import "server-only";/m);
    expect(s).not.toMatch(/zernio-inbox|parcours-|mots-|machine-conversation|crochet-zernio/);
  });
});

describe("L5-02c · jamais d'envoi depuis une validation", () => {
  it.each([
    "src/services/valider-entree.ts",
    "src/app/(studio)/calendrier/actions/ajouter.ts",
    "src/app/(studio)/calendrier/actions/statuts.ts",
    "src/services/porte-validation.ts",
  ])("%s : aucun « envoyer: » injecté", (f) => {
    const s = source(f);
    expect(s).not.toMatch(/\benvoyer\s*:\s*(async|\(|[a-z])/);
  });

  it("ajouter.ts et statuts.ts : la porte lue pour le libellé est publicationEditorialeAutorisee ; plus de « reglagesOuverts: async () => false »", () => {
    for (const f of ["src/app/(studio)/calendrier/actions/ajouter.ts", "src/app/(studio)/calendrier/actions/statuts.ts"]) {
      const s = source(f);
      expect(s).toContain("reglagesOuverts: () => publicationEditorialeAutorisee()");
      expect(s).not.toMatch(/reglagesOuverts:\s*async \(\) => false/);
    }
    expect(source("src/services/valider-entree.ts")).not.toMatch(/reglagesOuverts:\s*async \(\) => false/);
  });
});

describe("L5-02c · aucun quota", () => {
  it("code source : aucun import de reglages-cadence, cadence, quota", () => {
    const importations = source("src/services/branchement-envoi-calendrier.ts").split("\n").filter((l) => /^import /.test(l)).join("\n");
    expect(importations).not.toMatch(/reglages-cadence|cadence|quota/);
  });

  it("une entrée « vous » et une entrée de l'usine (validée par le fondateur) sont traitées pareil", async () => {
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c-vous", "linkedin", { origine: "vous" });
    await creerCreneau("c-usine", "facebook", { origine: "usine" });
    await tour();
    expect(appelsFournisseur.map((d) => d.reseau).sort()).toEqual(["facebook", "linkedin"]);
  });
});

describe("L5-02c · ligne de la boucle", () => {
  const LIGNE = 'void lancerAnnexe("envois du calendrier", async () => (await import("./branchement-envoi-calendrier")).tourEnvoisCalendrierServeur(), 0);';

  it("UNE seule ligne ajoutée, juste après « refus d'envoi », hors de la liste des annexes qui consomment la limite d'appels", () => {
    const lignes = source("src/services/boucle.ts").split("\n").map((l) => l.trim());
    expect(lignes.filter((l) => l.includes("branchement-envoi-calendrier"))).toEqual([LIGNE]);
    const i = lignes.indexOf(LIGNE);
    expect(lignes[i - 1]).toContain('lancerAnnexe("refus d\'envoi"');
    expect(source("src/services/limite-appels.ts")).not.toContain("envois du calendrier");
  });

  it("panne de l'annexe : le tour de la boucle continue (le tour lève, contenuDuTour se termine)", async () => {
    espion.tour.mockImplementation(async () => { throw new Error("panne simulée"); });
    await expect(contenuDuTour({ synchroBuffer: async () => undefined, synchroZernio: async () => undefined })).resolves.toBeUndefined();
    await annexesEnVol().get("envois du calendrier");
    expect(espion.tour).toHaveBeenCalled();
    expect(appelsFournisseur).toHaveLength(0);
  });

  it("éteint par défaut : l'annexe lancée par la boucle ne lit rien et n'appelle rien", async () => {
    await creerVisuel();
    await creerCreneau("c1", "linkedin");
    const lectures = vi.spyOn(depots().creneauxEditoriaux, "lister");
    await lancerAnnexe("envois du calendrier", async () => (await import("@/services/branchement-envoi-calendrier")).tourEnvoisCalendrierServeur(), 0);
    await annexesEnVol().get("envois du calendrier");
    expect(lectures).not.toHaveBeenCalled();
    expect(appelsFournisseur).toHaveLength(0);
    expect(faux.appels).toHaveLength(0);
  });
});
