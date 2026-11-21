/**
 * L8-02b : mise à jour des chiffres par la liste (interrupteur « mesures.lecture_par_liste », ÉTEINT par défaut).
 * Dépôts en mémoire, faux client qui COMPTE les requêtes, aucune requête réelle, aucune donnée de personne.
 */
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import type { Publication } from "@/domaine/types";
import { injecterClientZernio, BUDGET_REQUETES_PAR_PASSAGE } from "@/services/zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const mc = await import("@/services/mesures-completes");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "essai-l8-02b";
const INSTANT = new Date("2026-11-20T10:00:00.000Z");
const IL_Y_A = (n: number) => new Date(INSTANT.getTime() - n * 86_400_000).toISOString();
const VISITES = { mode: "simulation" as const, lire: async () => null };

type Appel = { methode: string; chemin: string; query?: Record<string, unknown> };
interface Options {
  /** Identifiants que la liste connaît (les autres sont « non retrouvés »). */
  connus?: Set<string>;
  /** Réponse de la page 1 de la liste (remplace la réponse normale). */
  page1?: { statut: number; corps?: unknown };
  /** Identifiants dont la lecture unitaire rend 202. */
  unitaire202?: boolean;
}
const analytics = (n: number) => ({ views: 100 + n, reach: 80 + n, likes: 5, comments: 2, shares: 4, clicks: 9, saves: 3, engagementRate: 1.5, lastUpdated: "2026-11-19T08:00:00Z" });
const post = (id: string, a: Record<string, unknown> | null = analytics(1)) => ({ _id: `d-${id}`, latePostId: id, platform: "instagram", platformPostUrl: `https://exemple.test/p/${id}`, ...(a ? { analytics: a } : {}) });

function fauxClient(ids: () => string[], o: Options = {}) {
  const appels: Appel[] = [];
  const base = {
    async requete(req: Appel) {
      appels.push(req);
      if (req.methode !== "GET") throw new Error(`méthode interdite : ${req.methode}`);
      if (req.chemin !== "/v1/analytics") throw new Error(`chemin interdit : ${req.chemin}`);
      const postId = req.query?.postId as string | undefined;
      if (postId) {
        if (o.unitaire202) return { statut: 202, corps: {}, route: "analytics" };
        return { statut: 200, corps: post(postId, analytics(7)), route: "analytics" };
      }
      const page = Number(req.query?.page ?? 1);
      if (page === 1 && o.page1) return { ...o.page1, route: "analytics" };
      const visibles = ids().filter((i) => !o.connus || o.connus.has(i));
      const tranche = visibles.slice((page - 1) * 50, page * 50);
      return { statut: 200, corps: { posts: tranche.map((i, k) => post(i, analytics(k))), pagination: { page, limit: 50 } }, route: "analytics" };
    },
  };
  const client = new Proxy(base, { get: (c, nom: string) => (nom in c ? (c as Record<string, unknown>)[nom] : () => { throw new Error(`méthode interdite : ${nom}`); }) }) as unknown as ClientZernio;
  return { client, appels, listes: () => appels.filter((a) => !a.query?.postId), unitaires: () => appels.filter((a) => !!a.query?.postId) };
}

const idsPubs: string[] = [];
async function publications(n: number, extra: (i: number) => Partial<Publication> = () => ({})) {
  for (let i = 0; i < n; i++) {
    const id = `exemple-st-${i}`;
    idsPubs.push(id);
    await depots().publications.enregistrer({
      id: `exemple-pub-${i}`, videoId: `exemple-v-${i}`, varianteId: `exemple-var-${i}`, reseau: "instagram", statut: "publiee", via: "zernio",
      date: IL_Y_A(10 + (i % 5)), texte: "", idExterne: id, creeLe: IL_Y_A(10), modifieLe: IL_Y_A(10), ...extra(i),
    } as never);
  }
}
async function allumer() {
  await ecrireParametre("mesures.lecture_par_liste", true);
}
async function lancer(o: Options = {}) {
  const f = fauxClient(() => idsPubs, o);
  injecterClientZernio(f.client);
  const bilan = await mc.importerMesures({ visites: VISITES, buffer: { mode: "simulation", lire: async () => null }, instant: INSTANT });
  return { ...f, bilan };
}
const publi = async (id: string) => (await depots().publications.obtenir(id))!;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  idsPubs.length = 0;
  injecterClientZernio(null);
  await auth.seConnecter(MDP, false);
});

describe("constantes et interrupteur", () => {
  it("plafonds de la fiche", () => {
    expect(mc.LECTURES_UNITAIRES_MAX_PAR_CLIC).toBe(40);
    expect(mc.LECTURES_UNITAIRES_APRES_LISTE).toBe(10);
    expect(mc.PAGES_LISTE_PAR_CLIC).toBe(3);
    expect(mc.INTERRUPTEUR_LECTURE_PAR_LISTE).toBe("mesures.lecture_par_liste");
  });

  it("la clé est écrite en littéral, défaut false, jugée par === true", () => {
    const src = readFileSync("src/services/mesures-completes.ts", "utf8");
    expect(src).toMatch(/lireParametre<boolean>\("mesures\.lecture_par_liste", false\);\s+return reglage === true/);
  });

  it("recensée « eteint » dans l'inventaire", () => {
    expect(readFileSync("tests/usine/inventaire/publication-et-mesures.test.ts", "utf8")).toMatch(/"mesures\.lecture_par_liste": "eteint"/);
  });

  it("réglage absent, ou valeur autre que true : aucune lecture de liste", async () => {
    await publications(3);
    const a = await lancer();
    expect(a.listes()).toHaveLength(0);
    expect(a.unitaires()).toHaveLength(3);
    for (const v of ["oui", 1, "true"]) {
      await ecrireParametre("mesures.lecture_par_liste", v);
      expect((await lancer()).listes()).toHaveLength(0);
    }
  });
});

describe("éteint : plafond de 40 lectures unitaires", () => {
  it("60 publications : 40 requêtes, message « prochain clic » ; second clic : les 20 restantes passent d'abord", async () => {
    await publications(60);
    const un = await lancer();
    expect(un.appels).toHaveLength(40);
    expect(un.listes()).toHaveLength(0);
    expect(un.bilan.zernio.requetes).toBe(40);
    expect(un.bilan.zernio.lues).toBe(40);
    expect(un.bilan.zernio.message).toBe("Une partie des chiffres sera lue au prochain clic.");
    const deux = await lancer();
    // Le plafond reste 40 : les 20 jamais lues passent d'abord, puis les 20 relevés les plus anciens.
    expect(deux.appels).toHaveLength(40);
    const lus = new Set(deux.unitaires().map((a) => a.query!.postId));
    expect(lus.size).toBe(40);
    const sansReleve = [];
    for (let i = 0; i < 60; i++) if (!(await publi(`exemple-pub-${i}`)).releves?.length) sansReleve.push(i);
    expect(sansReleve).toEqual([]);
  });

  it("40 publications exactement : tout est lu, pas de message", async () => {
    await publications(40);
    const r = await lancer();
    expect(r.appels).toHaveLength(40);
    expect(r.bilan.zernio.message).toBeUndefined();
  });

  it("les publications au relevé le plus ancien passent d'abord", async () => {
    await publications(45);
    for (let i = 0; i < 40; i++) {
      await depots().publications.modifier(`exemple-pub-${i}`, { releves: [{ le: IL_Y_A(1), jour: 9, source: "zernio", valeurs: { vues: 1 }, definitions: {} }] } as never);
    }
    const r = await lancer();
    const lus = new Set(r.unitaires().map((a) => a.query!.postId));
    for (let i = 40; i < 45; i++) expect(lus.has(`exemple-st-${i}`)).toBe(true);
    expect(r.appels).toHaveLength(40);
  });
});

describe("allumé : la liste d'abord", () => {
  it("60 publications retrouvées en 2 pages : 2 requêtes, 60 relevés", async () => {
    await publications(60);
    await allumer();
    const r = await lancer();
    expect(r.appels).toHaveLength(2);
    expect(r.listes()).toHaveLength(2);
    expect(r.bilan.zernio).toMatchObject({ lues: 60, ajoutees: 60, requetes: 2 });
    for (let i = 0; i < 60; i++) expect((await publi(`exemple-pub-${i}`)).releves).toHaveLength(1);
  });

  it("la période : du plus ancien jour (90 jours au plus) à aujourd'hui, source late, limit 50", async () => {
    await publications(2, (i) => ({ date: i === 0 ? IL_Y_A(200) : IL_Y_A(5) }));
    await allumer();
    const r = await lancer();
    expect(r.listes()[0].query).toMatchObject({ page: 1, limit: 50, fromDate: "2026-08-22", toDate: "2026-11-20", source: "late" });
  });

  it("5 non retrouvées : 2 requêtes de liste + 5 lectures unitaires", async () => {
    await publications(60);
    await allumer();
    const connus = new Set(idsPubs.slice(0, 55));
    const r = await lancer({ connus });
    expect(r.listes()).toHaveLength(2);
    expect(r.unitaires()).toHaveLength(5);
    expect(r.bilan.zernio.requetes).toBe(7);
  });

  it("30 non retrouvées : 10 lectures unitaires au plus (13 requêtes au plus)", async () => {
    await publications(30);
    await allumer();
    const r = await lancer({ connus: new Set() });
    expect(r.listes()).toHaveLength(1);
    expect(r.unitaires()).toHaveLength(10);
    expect(r.appels.length).toBeLessThanOrEqual(13);
    expect(r.bilan.zernio.requetes).toBe(r.appels.length);
  });

  it("jamais plus de 3 pages de liste", async () => {
    await publications(1);
    await allumer();
    const f = fauxClient(() => Array.from({ length: 400 }, (_, i) => `autre-${i}`));
    injecterClientZernio(f.client);
    await mc.importerMesures({ visites: VISITES, buffer: { mode: "simulation", lire: async () => null }, instant: INSTANT });
    expect(f.listes().length).toBeLessThanOrEqual(3);
    expect(f.appels.length).toBeLessThanOrEqual(13);
  });

  it("page 1 en 202 : aucun relevé faux, lectures unitaires ensuite (10 au plus)", async () => {
    await publications(12);
    await allumer();
    const r = await lancer({ page1: { statut: 202, corps: {} }, unitaire202: true });
    expect(r.listes()).toHaveLength(1);
    expect(r.unitaires()).toHaveLength(10);
    for (let i = 0; i < 12; i++) expect((await publi(`exemple-pub-${i}`)).releves ?? []).toHaveLength(0);
    expect(r.bilan.zernio.ajoutees).toBe(0);
  });

  it("rapprochement par adresse publiée quand l'identifiant manque", async () => {
    await publications(1, () => ({ urlPubliee: "https://exemple.test/p/autre-id" }));
    await allumer();
    const f = fauxClient(() => [], {});
    const client = new Proxy(f.client as object, {
      get: (c, nom: string) => nom === "requete" ? async (req: Appel) => (req.query?.postId ? f.client.requete(req as never) : { statut: 200, corps: { posts: [{ _id: "d1", latePostId: "inconnu", platformPostUrl: "https://exemple.test/p/autre-id", analytics: analytics(3) }] }, route: "analytics" }) : (c as Record<string, unknown>)[nom],
    }) as unknown as ClientZernio;
    injecterClientZernio(client);
    const bilan = await mc.importerMesures({ visites: VISITES, buffer: { mode: "simulation", lire: async () => null }, instant: INSTANT });
    expect(bilan.zernio.ajoutees).toBe(1);
    expect(f.unitaires()).toHaveLength(0);
  });
});

describe("corrections de relecture", () => {
  it("ligne « en cours » (syncStatus pending) : aucun relevé, aucune lecture unitaire, comptée « pas encore prêtes »", async () => {
    await publications(2);
    await allumer();
    const f = fauxClient(() => []);
    const client = { requete: async (req: Appel) => (req.query?.postId ? f.client.requete(req as never) : { statut: 200, corps: { posts: [{ ...post("exemple-st-0", { views: 0, likes: 0 }), syncStatus: "pending" }, post("exemple-st-1", { views: 20 })] }, route: "analytics" }) } as unknown as ClientZernio;
    injecterClientZernio(client);
    const bilan = await mc.importerMesures({ visites: VISITES, buffer: { mode: "simulation", lire: async () => null }, instant: INSTANT });
    expect((await publi("exemple-pub-0")).releves ?? []).toHaveLength(0);
    expect((await publi("exemple-pub-1")).releves).toHaveLength(1);
    expect(f.unitaires()).toHaveLength(0);
    expect(bilan.zernio.pasPretes).toBe(1);
    expect(bilan.zernio.message).toBe(mc.LIBELLE_PAS_PRETES);
  });

  it("allumé, sans clé mais lecteur réel injecté : 10 lectures unitaires au plus, visuels non lus", async () => {
    await publications(30);
    await depots().visuels.enregistrer({ id: "exemple-vis-x", famille: "carrousel", titre: "T", entree: { type: "session" }, statut: "valide", modeTexte: "simulation", versionSpec: 1, coutCentimes: 0, creeLe: IL_Y_A(20), modifieLe: IL_Y_A(20) } as never);
    await depots().publications.enregistrer({ id: "exemple-pubvis-x", visuelId: "exemple-vis-x", reseau: "instagram", statut: "publiee", via: "zernio", date: IL_Y_A(3), texte: "", idExterne: "ext-x", creeLe: IL_Y_A(3), modifieLe: IL_Y_A(3) } as never);
    await allumer();
    const f = fauxClient(() => idsPubs);
    injecterClientZernio(null);
    const ancienne = process.env.ZERNIO_API_KEY;
    delete process.env.ZERNIO_API_KEY;
    try {
      const { creerLecteurZernio } = await import("@/fournisseurs/mesures/zernio");
      await mc.importerMesures({ zernio: creerLecteurZernio(f.client), visites: VISITES, buffer: { mode: "simulation", lire: async () => null }, instant: INSTANT });
    } finally {
      if (ancienne !== undefined) process.env.ZERNIO_API_KEY = ancienne;
    }
    expect(f.listes()).toHaveLength(0);
    expect(f.unitaires().length).toBeLessThanOrEqual(10);
    expect(f.unitaires().some((a) => a.query!.postId === "ext-x")).toBe(false);
  });

  it("lecture du réglage impossible : éteint (aucune page de liste, visuels non lus)", async () => {
    await publications(3);
    await allumer();
    const spy = vi.spyOn(depots().parametres, "obtenir").mockImplementation(async (id: string) => {
      if (id === "mesures.lecture_par_liste") throw new Error("lecture impossible");
      return undefined as never;
    });
    try {
      const r = await lancer();
      expect(r.listes()).toHaveLength(0);
      expect(r.unitaires()).toHaveLength(3);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("rotation : aucune publication n'est oubliée, même sans relevé neuf", () => {
  const releveIdentique = (i: number) => ({ le: IL_Y_A(30 - (i % 3)), jour: 1, source: "zernio" as const, valeurs: { vues: 107, portee: 87, likes: 5, commentaires: 2, partages: 4, partagesParPortee: 4.6 }, definitions: {} });

  it("éteint : 60 relevés déjà identiques, 2 clics : les 60 sont lues, 40 au plus par clic", async () => {
    await publications(60);
    for (let i = 0; i < 60; i++) await depots().publications.modifier(`exemple-pub-${i}`, { releves: [releveIdentique(i)] } as never);
    const lus = new Set<unknown>();
    for (let clic = 0; clic < 2; clic++) {
      const r = await lancer();
      expect(r.appels.length).toBeLessThanOrEqual(40);
      for (const a of r.unitaires()) lus.add(a.query!.postId);
    }
    expect(lus.size).toBe(60);
  });

  it("allumé : 30 non retrouvées, 3 clics : les 30 sont lues, 13 requêtes au plus par clic", async () => {
    await publications(30);
    await allumer();
    const lus = new Set<unknown>();
    for (let clic = 0; clic < 3; clic++) {
      const r = await lancer({ connus: new Set() });
      expect(r.appels.length).toBeLessThanOrEqual(13);
      for (const a of r.unitaires()) lus.add(a.query!.postId);
    }
    expect(lus.size).toBe(30);
  });

  it("éteint : 45 publications « pas encore prêtes » ne bloquent pas les 15 autres", async () => {
    await publications(60);
    const lus = new Set<unknown>();
    for (let clic = 0; clic < 2; clic++) {
      const r = await lancer({ unitaire202: true });
      for (const a of r.unitaires()) lus.add(a.query!.postId);
    }
    expect(lus.size).toBe(60);
  });
});

describe("visuels, simulation, exemples", () => {
  async function visuel(id: string, extra: Record<string, unknown> = {}) {
    await depots().visuels.enregistrer({ id, famille: "carrousel", titre: `Titre ${id}`, entree: { type: "session" }, statut: "valide", modeTexte: "simulation", versionSpec: 1, coutCentimes: 0, creeLe: IL_Y_A(20), modifieLe: IL_Y_A(20), ...extra } as never);
  }
  async function pubVisuel(id: string, visuelId: string, extra: Record<string, unknown> = {}) {
    idsPubs.push(`ext-${id}`);
    await depots().publications.enregistrer({ id, visuelId, reseau: "instagram", statut: "publiee", via: "zernio", date: IL_Y_A(3), texte: "", idExterne: `ext-${id}`, creeLe: IL_Y_A(3), modifieLe: IL_Y_A(3), ...extra } as never);
  }

  it("publication de visuel : lue seulement allumé", async () => {
    await visuel("exemple-vis-1");
    await pubVisuel("exemple-pubvis-1", "exemple-vis-1");
    const eteint = await lancer();
    expect(eteint.appels).toHaveLength(0);
    expect((await publi("exemple-pubvis-1")).releves ?? []).toHaveLength(0);
    await allumer();
    const allume = await lancer();
    expect(allume.listes()).toHaveLength(1);
    expect((await publi("exemple-pubvis-1")).releves).toHaveLength(1);
  });

  it("visuel à la corbeille, simulation, sans idExterne, exemple, via buffer : jamais lus", async () => {
    await visuel("exemple-vis-c", { corbeilleLe: IL_Y_A(1) });
    await visuel("exemple-vis-s");
    await visuel("exemple-vis-n");
    await visuel("exemple-vis-e");
    await visuel("exemple-vis-b");
    await pubVisuel("p-corbeille", "exemple-vis-c");
    await pubVisuel("p-simulation", "exemple-vis-s", { via: "simulation" });
    await pubVisuel("p-sans-id", "exemple-vis-n", { idExterne: undefined });
    await pubVisuel("p-exemple", "exemple-vis-e", { estDemo: true });
    await pubVisuel("p-buffer", "exemple-vis-b", { via: "buffer" });
    await ecrireParametre("afficherExemples", false);
    await allumer();
    const r = await lancer();
    expect(r.appels).toHaveLength(0);
    for (const id of ["p-corbeille", "p-simulation", "p-sans-id", "p-exemple", "p-buffer"]) expect((await publi(id)).releves ?? []).toHaveLength(0);
  });

  it("publication de vidéo en simulation ou d'exemple : jamais lue", async () => {
    await publications(1, () => ({ via: "simulation" }));
    await publications(1, () => ({ estDemo: true, id: "exemple-pub-demo", idExterne: "exemple-st-demo", videoId: "exemple-v-demo" }));
    await ecrireParametre("afficherExemples", false);
    await allumer();
    const r = await lancer();
    expect(r.appels).toHaveLength(0);
  });
});

describe("valeurs et écritures", () => {
  it("valeur absente : champ absent du relevé, jamais 0 ; un vrai 0 reste 0", async () => {
    await publications(2);
    await allumer();
    const f = fauxClient(() => []);
    const client = { requete: async (req: Appel) => (req.query?.postId ? f.client.requete(req as never) : { statut: 200, corps: { posts: [post("exemple-st-0", { views: 50 }), post("exemple-st-1", { views: 0, likes: 0 })] }, route: "analytics" }) } as unknown as ClientZernio;
    injecterClientZernio(client);
    await mc.importerMesures({ visites: VISITES, buffer: { mode: "simulation", lire: async () => null }, instant: INSTANT });
    const a = (await publi("exemple-pub-0")).releves![0].valeurs;
    expect(a).toEqual({ vues: 50 });
    for (const k of ["likes", "commentaires", "partages", "portee"]) expect(a).not.toHaveProperty(k);
    expect((await publi("exemple-pub-1")).releves![0].valeurs).toEqual({ vues: 0, likes: 0 });
  });

  it("aucun champ neuf : ni clics, ni enregistrements, ni taux ; partages ÷ portée calculé", async () => {
    await publications(1);
    await allumer();
    await lancer();
    const v = (await publi("exemple-pub-0")).releves![0].valeurs as unknown as Record<string, unknown>;
    expect(Object.keys(v).sort()).toEqual(["commentaires", "likes", "partages", "partagesParPortee", "portee", "vues"]);
    expect((await publi("exemple-pub-0")).stats).not.toHaveProperty("clics");
  });

  it("relevé identique : non répété au clic suivant", async () => {
    await publications(3);
    await allumer();
    expect((await lancer()).bilan.zernio.ajoutees).toBe(3);
    const deux = await lancer();
    expect(deux.bilan.zernio).toMatchObject({ lues: 3, ajoutees: 0 });
    expect((await publi("exemple-pub-0")).releves).toHaveLength(1);
  });

  it("aucune requête autre que GET /v1/analytics, allumé comme éteint", async () => {
    await publications(5);
    for (const allume of [false, true]) {
      if (allume) await allumer();
      const r = await lancer({ connus: new Set(idsPubs.slice(0, 2)) });
      for (const a of r.appels) expect([a.methode, a.chemin]).toEqual(["GET", "/v1/analytics"]);
    }
  });

  it("sans clé ni client : mode essai, aucune requête, même allumé", async () => {
    await publications(2);
    await allumer();
    const ancienne = process.env.ZERNIO_API_KEY;
    delete process.env.ZERNIO_API_KEY;
    try {
      const b = await mc.importerMesures({ visites: VISITES, buffer: { mode: "simulation", lire: async () => null }, instant: INSTANT });
      expect(b.zernio).toMatchObject({ essai: true, lues: 0, ajoutees: 0, requetes: 0 });
    } finally {
      if (ancienne !== undefined) process.env.ZERNIO_API_KEY = ancienne;
    }
  });
});

describe("appliquerStatistiquesLues", () => {
  const lues = (extra: Record<string, unknown> = {}) => ({
    idDiffuseur: "d", idPostStudio: "exemple-st-0", reseau: "instagram", urlPubliee: null, vues: 10, portee: 8, reactions: 2, commentaires: 1, partages: 1,
    enregistrements: 4, clics: 6, tauxEngagement: 2, publieLe: null, misesAJourLe: null, synchro: "a-jour" as const, ...extra,
  });

  it("n'exige aucune session et écrit un relevé « zernio »", async () => {
    await publications(1);
    await auth.seDeconnecter();
    const p = await publi("exemple-pub-0");
    expect(await mc.appliquerStatistiquesLues(p, lues(), INSTANT)).toBe(true);
    const r = (await publi("exemple-pub-0")).releves![0];
    expect(r.source).toBe("zernio");
    expect(r.valeurs).toEqual({ vues: 10, portee: 8, likes: 2, commentaires: 1, partages: 1, partagesParPortee: 12.5 });
  });

  it("aucune valeur utile : false et aucune écriture", async () => {
    await publications(1);
    const p = await publi("exemple-pub-0");
    expect(await mc.appliquerStatistiquesLues(p, lues({ vues: null, portee: null, reactions: null, commentaires: null, partages: null }), INSTANT)).toBe(false);
    expect((await publi("exemple-pub-0")).releves ?? []).toHaveLength(0);
  });
});

describe("la synchro n'est pas touchée", () => {
  it("budget de passage inchangé (51) ; importerMesures n'appelle pas synchroniserEtatsZernio", () => {
    expect(BUDGET_REQUETES_PAR_PASSAGE).toBe(51);
    const src = readFileSync("src/services/mesures-completes.ts", "utf8");
    expect(src).not.toMatch(/synchroniserEtatsZernio/);
    expect(src).not.toMatch(/@\/fournisseurs\/claude/);
  });
});
