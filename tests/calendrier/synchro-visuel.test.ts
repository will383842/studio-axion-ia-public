/**
 * L5-06 · synchronisation complète et incrémentale avec le diffuseur, en LECTURE seule.
 * - 130 posts répartis sur 3 pages : tous lus, aucune écriture chez le diffuseur ;
 * - un visuel dont la publication est publiée passe « Publié » ; programmée, « Programmé » ;
 * - un post absent de la liste est relu un à un, sans dépasser 50 lectures ; sans option, au-delà de 50 publications le passage est complet ;
 * - une page de liste en échec ramène au passage incrémental de 50 lectures ; l'étape d'un visuel ne bloque jamais la synchro.
 * Faux client uniquement : aucun appel réel, données fictives.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
/** Décision n° 2 du 18/11/2026 : interrupteur NEUF, éteint par défaut (absent = éteint). */
const CLE_SYNCHRO_ETAPE = "zernio.synchro_etape_visuels";
const auth = await import("@/services/auth");
const MDP = "essai-l5-06-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio } = await import("@/services/zernio");
const { reconcilier } = await import("@/services/reconciliation-calendrier");
const { listerToutesLesPagesZernio } = await import("@/services/zernio");
const { creerFauxClientZernio, postExemple } = await import("../zernio/aides/faux-zernio");
type AppelEnregistre = import("../zernio/aides/faux-zernio").AppelEnregistre;

const T0 = Date.parse("2026-11-11T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const COMPTE = "exemple-compte-1";
const DATE = "2026-11-12T08:00:00.000Z";

const postPublie = (n: number) => postExemple({ _id: `exemple-post-${n}`, status: "published", platforms: [{ platform: "instagram", accountId: COMPTE, status: "published", platformPostUrl: `https://exemple.invalid/p/${n}` }] });

/** Faux diffuseur : `total` posts publiés servis par pages (`page`, `limit`) ; les lectures unitaires sont comptées. */
function diffuseur(total: number, absents: ReadonlySet<number> = new Set(), listeEnPanne = false) {
  const posts = Array.from({ length: total }, (_, i) => postPublie(i + 1)).filter((_, i) => !absents.has(i + 1));
  const appels: AppelEnregistre[] = [];
  const { client } = creerFauxClientZernio((a) => {
    appels.push(a);
    const u = new URL(a.url);
    if (a.methode === "GET" && u.pathname.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: COMPTE, platform: "instagram", isActive: true }] } };
    if (a.methode === "GET" && u.pathname.endsWith("/v1/posts")) {
      if (listeEnPanne) return { statut: 500, corps: { error: "panne simulée" } };
      const page = Number(u.searchParams.get("page") ?? 1);
      const limite = Number(u.searchParams.get("limit") ?? 10);
      return { statut: 200, corps: { posts: posts.slice((page - 1) * limite, page * limite) } };
    }
    const m = /\/v1\/posts\/(exemple-post-(\d+))$/.exec(u.pathname);
    if (a.methode === "GET" && m) return { statut: 200, corps: { post: postPublie(Number(m[2])) } };
    return { statut: 500, corps: { error: "appel inattendu" } };
  });
  return { client, appels };
}

async function publications(n: number, extra: (i: number) => Record<string, unknown> = () => ({})) {
  for (let i = 1; i <= n; i++) {
    await depots().publications.enregistrer({ id: `p${i}`, videoId: "v-03", reseau: "instagram", statut: "programmee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: `exemple-post-${i}`, canalId: COMPTE, etatEnvoi: "envoye", envoiCommenceLe: iso(T0 - 3600_000), creeLe: iso(T0), modifieLe: iso(T0), ...extra(i) } as never);
  }
}

const ecritures = (appels: AppelEnregistre[]) => appels.filter((a) => a.methode !== "GET");

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
  // Les tests des règles d'étape tournent interrupteur ALLUMÉ ; le groupe « interrupteur éteint » (fin de fichier) l'éteint.
  await ecrireParametre(CLE_SYNCHRO_ETAPE, true);
});

describe("L5-06 · lecture de toutes les pages", () => {
  it("130 posts sur 3 pages : tous lus, trois lectures de liste, aucune écriture", async () => {
    const { client, appels } = diffuseur(130);
    const tous = await listerToutesLesPagesZernio(client, { status: "published" });
    expect(tous).toHaveLength(130);
    expect(new Set(tous.map((p) => p._id)).size).toBe(130);
    const listes = appels.filter((a) => new URL(a.url).pathname.endsWith("/v1/posts"));
    expect(listes.map((a) => new URL(a.url).searchParams.get("page"))).toEqual(["1", "2", "3"]);
    expect(ecritures(appels)).toHaveLength(0);
  });

  it("une page qui répète les mêmes posts arrête la lecture (jamais de boucle)", async () => {
    const { client } = creerFauxClientZernio(() => ({ statut: 200, corps: { posts: Array.from({ length: 50 }, (_, i) => postPublie(i + 1)) } }));
    expect(await listerToutesLesPagesZernio(client)).toHaveLength(50);
  });
});

describe("L5-06 · synchronisation complète", () => {
  it("130 publications : toutes passent « publiée » par 3 lectures de liste, sans lecture unitaire ni écriture", async () => {
    await publications(130);
    const { client, appels } = diffuseur(130);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(r).toEqual({ lues: 130, changees: 130 });
    expect((await depots().publications.lister()).every((p) => p.statut === "publiee" && p.urlPubliee?.startsWith("https://exemple.invalid/p/"))).toBe(true);
    expect(appels.filter((a) => /\/v1\/posts\/[^/?]+$/.test(new URL(a.url).pathname))).toHaveLength(0);
    expect(ecritures(appels)).toHaveLength(0);
  });

  it("un post absent de la liste est relu seul ; les autres ne le sont pas", async () => {
    await publications(5);
    const { client, appels } = diffuseur(5, new Set([3]));
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(r.lues).toBe(5);
    const unitaires = appels.filter((a) => /\/v1\/posts\/[^/?]+$/.test(new URL(a.url).pathname)).map((a) => new URL(a.url).pathname);
    expect(unitaires).toEqual(["/api/v1/posts/exemple-post-3"]);
  });

  it("sans l'option « complet » et jusqu'à 50 publications, le passage reste incrémental : lectures unitaires, sans liste", async () => {
    await publications(40);
    const { client, appels } = diffuseur(40);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.lues).toBe(40);
    // RAP-2 : le rapatriement lit les posts « à venir » par statut ; la liste complète de L5-06 (sans statut) reste absente de ce passage.
    expect(appels.filter((a) => { const u = new URL(a.url); return u.pathname.endsWith("/v1/posts") && !u.searchParams.has("status"); })).toHaveLength(0);
  });
});

describe("L5-06 · un visuel publié", () => {
  const visuel = (statut: string) => depots().visuels.enregistrer({ id: "vis_1", famille: "carrousel", titre: "Visuel d'exemple", statut, versionSpec: 1, coutCentimes: 0, creeLe: iso(T0), modifieLe: iso(T0) } as never);

  it("passe « Publié » quand le diffuseur l'a publié (synchro complète)", async () => {
    await visuel("programme");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });

  it("passe « Publié » aussi au passage incrémental", async () => {
    await visuel("programme");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });

  it("un visuel déjà publié ne change plus", async () => {
    await visuel("publie");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });
});

describe("L5-06 · cas limites", () => {
  const visuel = (statut: string) => depots().visuels.enregistrer({ id: "vis_1", famille: "carrousel", titre: "Visuel d'exemple", statut, versionSpec: 1, coutCentimes: 0, creeLe: iso(T0), modifieLe: iso(T0) } as never);
  const unitaires = (appels: AppelEnregistre[]) => appels.filter((a) => /\/v1\/posts\/[^/?]+$/.test(new URL(a.url).pathname));

  it("sans option, au-delà de 50 publications suivies : passage complet par la liste paginée", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.lues).toBe(60);
    expect(appels.filter((a) => new URL(a.url).pathname.endsWith("/v1/posts")).length).toBeGreaterThanOrEqual(2);
    expect(unitaires(appels)).toHaveLength(0);
  });

  it("mode complet : 60 posts absents de la liste, 40 lectures unitaires au plus", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60, new Set(Array.from({ length: 60 }, (_, i) => i + 1)));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(unitaires(appels)).toHaveLength(40);
  });

  it("une page de liste en échec : retour aux lectures unitaires, la requête échouée et la lecture des comptes comprises dans le budget de 51", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60, new Set(), true);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    // RAP-2 : la lecture du rapatriement (en échec elle aussi) compte pour 1 dans le budget : une lecture unitaire de moins, toujours 51 au total.
    expect(r.lues).toBe(48);
    expect(unitaires(appels)).toHaveLength(48);
    expect(appels).toHaveLength(51);
    expect(ecritures(appels)).toHaveLength(0);
  });

  it("le visuel passe « Programmé » quand le diffuseur programme la publication", async () => {
    await visuel("valide");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1", statut: "brouillon" }));
    const { client } = creerFauxClientZernio(() => ({ statut: 200, corps: { post: postExemple({ _id: "exemple-post-1", status: "scheduled", scheduledFor: DATE }) } }));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("programme");
  });

  it("un visuel « validé » dont la publication est publiée enchaîne valide → programme → publie (décision du pilote du 17/11/2026, règle 2)", async () => {
    await visuel("valide");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });

  it("un visuel à la corbeille reste inchangé", async () => {
    await visuel("programme");
    await depots().visuels.modifier("vis_1", { corbeilleLe: iso(T0) } as never);
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("programme");
  });

  it("l'échec chez le diffuseur met le visuel « envoi échoué »", async () => {
    await visuel("programme");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = creerFauxClientZernio(() => ({ statut: 200, corps: { post: postExemple({ _id: "exemple-post-1", status: "failed", platforms: [{ platform: "instagram", accountId: COMPTE, status: "failed", errorMessage: "refus simulé" }] }) } }));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("echec_envoi");
  });

  it("le total des requêtes d'un passage complet reste sous 50 (liste + lectures unitaires), même avec 600 posts", async () => {
    await publications(5);
    const { client, appels } = diffuseur(600, new Set([1, 2, 3, 4, 5]));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(appels.filter((a) => /\/v1\/posts/.test(new URL(a.url).pathname)).length).toBeLessThanOrEqual(50);
  });

  it("une erreur sur le visuel ne bloque pas les autres publications ; le rattrapage la reprend", async () => {
    await visuel("programme");
    await publications(3, (i) => (i === 1 ? { videoId: undefined, visuelId: "vis_1" } : {}));
    const { client } = diffuseur(3);
    injecterClientZernio(client);
    const espion = vi.spyOn(depots().visuels, "modifier").mockRejectedValue(new Error("panne simulée"));
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.changees).toBe(3);
    expect((await depots().publications.lister()).every((p) => p.statut === "publiee")).toBe(true);
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("programme");
    espion.mockRestore();
    await synchroniserEtatsZernio({ force: true, instant: T0 + 1000 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("publie");
  });
});

/* ------------------------------------------------------------------ */
/* Décision du pilote (17/11/2026) : l'étape suit l'ENSEMBLE des publications actives                */
/* ------------------------------------------------------------------ */

type EtatPost = { status: string; plateforme?: string; compte?: string; erreur?: string };

/** Faux diffuseur « par post » : chaque post a son état ; la liste est vide (lecture unitaire seulement). */
function diffuseurParPost(etats: Record<string, EtatPost>) {
  const appels: AppelEnregistre[] = [];
  const { client } = creerFauxClientZernio((a) => {
    appels.push(a);
    const u = new URL(a.url);
    if (a.methode === "GET" && u.pathname.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: COMPTE, platform: "instagram", isActive: true }] } };
    if (a.methode === "GET" && u.pathname.endsWith("/v1/posts")) return { statut: 200, corps: { posts: [] } };
    const m = /\/v1\/posts\/([^/?]+)$/.exec(u.pathname);
    const e = m ? etats[m[1]] : undefined;
    if (a.methode === "GET" && m && e) {
      const pf = { platform: e.plateforme ?? "instagram", accountId: e.compte ?? COMPTE, status: e.status, ...(e.status === "failed" ? { errorMessage: e.erreur ?? "refus simulé" } : {}) };
      return { statut: 200, corps: { post: postExemple({ _id: m[1], status: e.status, ...(e.status === "scheduled" ? { scheduledFor: DATE } : {}), platforms: [pf] } as never) } };
    }
    return { statut: 404, corps: { error: "introuvable" } };
  });
  return { client, appels };
}

const visuelSimple = (statut: string, id = "vis_1") => depots().visuels.enregistrer({ id, famille: "carrousel", titre: "Visuel d'exemple", statut, versionSpec: 1, coutCentimes: 0, creeLe: iso(T0), modifieLe: iso(T0) } as never);
const pubVisuel = (id: string, reseau: string, extra: Record<string, unknown> = {}) =>
  depots().publications.enregistrer({ id, visuelId: "vis_1", reseau, statut: "programmee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: `post-${id}`, canalId: COMPTE, etatEnvoi: "envoye", envoiCommenceLe: iso(T0 - 3600_000), creeLe: iso(T0), modifieLe: iso(T0), ...extra } as never);
const BUDGET_TOUTES = 51; // 1 lecture des comptes + 50 requêtes de posts au plus par passage
const statutVisuel = async (id = "vis_1") => (await depots().visuels.obtenir(id))?.statut;

describe("L5-06 · décision du pilote, règle 1 : tant qu'un envoi reste possible, l'étape ne bouge pas", () => {
  it("deux réseaux, l'un programmé, le second pas encore envoyé (prévu au créneau) : le visuel reste « validé »", async () => {
    await visuelSimple("valide");
    await depots().creneauxEditoriaux.enregistrer({ id: "cre_1", jourVise: "2026-11-12", heuresParReseau: { instagram: DATE, linkedin: DATE }, compteCible: COMPTE, visuelId: "vis_1", statut: "valide", decalages: 0, valideeLe: iso(T0 - 7200_000) } as never);
    await pubVisuel("pi", "instagram", { statut: "brouillon" });
    const { client } = diffuseurParPost({ "post-pi": { status: "scheduled" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().publications.obtenir("pi"))?.statut).toBe("programmee");
    expect(await statutVisuel()).toBe("valide");
  });

  it("deux publications, l'une programmée, l'autre refusée par le diffuseur (nouvel essai possible) : le visuel reste « validé »", async () => {
    await visuelSimple("valide");
    await pubVisuel("pi", "instagram", { statut: "brouillon" });
    await pubVisuel("pl", "linkedin", { statut: "echec", etatEnvoi: "refuse", idExterne: undefined });
    const { client } = diffuseurParPost({ "post-pi": { status: "scheduled" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("valide");
  });

  it("deux publications, l'une programmée, l'autre encore brouillon chez le diffuseur : le visuel reste « validé »", async () => {
    await visuelSimple("valide");
    await pubVisuel("pi", "instagram", { statut: "brouillon" });
    await pubVisuel("pl", "linkedin", { statut: "brouillon" });
    const { client } = diffuseurParPost({ "post-pi": { status: "scheduled" }, "post-pl": { status: "draft", plateforme: "linkedin" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("valide");
  });
});

describe("L5-06 · décision du pilote, règle 4 : même résultat quel que soit l'ordre des lectures", () => {
  // `etatLuLe` règle l'ordre de lecture (le plus ancien d'abord).
  const deux = async (premier: "pi" | "pl", etats: Record<string, EtatPost>, depart = "programme") => {
    await visuelSimple(depart);
    await pubVisuel("pi", "instagram", { etatLuLe: iso(T0 - (premier === "pi" ? 2000 : 1000)) });
    await pubVisuel("pl", "linkedin", { etatLuLe: iso(T0 - (premier === "pl" ? 2000 : 1000)) });
    const { client } = diffuseurParPost(etats);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    return statutVisuel();
  };
  const ordres = ["pi", "pl"] as const;

  for (const o of ordres) {
    it(`une en échec, l'autre publiée (lue d'abord : ${o}) : l'étape du visuel ne bouge pas`, async () => {
      expect(await deux(o, { "post-pi": { status: "failed" }, "post-pl": { status: "published", plateforme: "linkedin" } })).toBe("programme");
    });
    it(`une en échec, l'autre programmée (lue d'abord : ${o}) : l'étape du visuel ne bouge pas`, async () => {
      expect(await deux(o, { "post-pi": { status: "failed" }, "post-pl": { status: "scheduled", plateforme: "linkedin" } })).toBe("programme");
    });
    it(`toutes en échec (lue d'abord : ${o}) : « envoi échoué »`, async () => {
      expect(await deux(o, { "post-pi": { status: "failed" }, "post-pl": { status: "failed", plateforme: "linkedin" } })).toBe("echec_envoi");
    });
    it(`toutes publiées (lue d'abord : ${o}) : « publié »`, async () => {
      expect(await deux(o, { "post-pi": { status: "published" }, "post-pl": { status: "published", plateforme: "linkedin" } })).toBe("publie");
    });
    it(`l'une publiée, l'autre programmée (lue d'abord : ${o}) : « programmé »`, async () => {
      expect(await deux(o, { "post-pi": { status: "published" }, "post-pl": { status: "scheduled", plateforme: "linkedin" } })).toBe("programme");
    });
  }

  it("jamais de corbeille par la synchro : un visuel en échec partout n'est pas mis à la corbeille", async () => {
    await deux("pi", { "post-pi": { status: "failed" }, "post-pl": { status: "failed", plateforme: "linkedin" } });
    expect((await depots().visuels.obtenir("vis_1"))?.corbeilleLe).toBeUndefined();
  });
});

describe("L5-06 · décision du pilote, règle 2 : valide → programme → publie sous le même verrou", () => {
  it("un visuel « validé » dont l'unique publication est publiée, sans « programmée » observée : « publié »", async () => {
    await visuelSimple("valide");
    await pubVisuel("pi", "instagram");
    const { client } = diffuseurParPost({ "post-pi": { status: "published" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("publie");
  });

  it("un visuel « validé » dont les deux publications sont publiées : « publié », en une seule écriture du visuel", async () => {
    await visuelSimple("valide");
    await pubVisuel("pi", "instagram");
    await pubVisuel("pl", "linkedin");
    const { client } = diffuseurParPost({ "post-pi": { status: "published" }, "post-pl": { status: "published", plateforme: "linkedin" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("publie");
  });

  it("un visuel « validé » dont la seule publication est en échec reste « validé » (le nouvel essai reste possible)", async () => {
    await visuelSimple("valide");
    await pubVisuel("pi", "instagram", { statut: "brouillon" }); // envoyée en brouillon : l'étape reste « valide »
    const { client } = diffuseurParPost({ "post-pi": { status: "failed" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("valide");
  });
});

describe("L5-06 · décision du pilote, point 4 : rattrapage choisi par l'état du visuel, puis borné à 20", () => {
  it("plus de 20 publications publiées plus récentes, dont les visuels sont à jour : le visuel resté « programmé » est quand même rattrapé", async () => {
    await visuelSimple("programme", "vis_ancien");
    await depots().publications.enregistrer({ id: "pub_ancienne", visuelId: "vis_ancien", reseau: "instagram", statut: "publiee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: "post-ancien", canalId: COMPTE, etatEnvoi: "envoye", creeLe: iso(T0 - 9000_000), modifieLe: iso(T0 - 9000_000) } as never);
    for (let i = 1; i <= 25; i++) {
      await visuelSimple("publie", `vis_a_jour_${i}`);
      await depots().publications.enregistrer({ id: `pub_recente_${i}`, visuelId: `vis_a_jour_${i}`, reseau: "instagram", statut: "publiee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: `post-recent-${i}`, canalId: COMPTE, etatEnvoi: "envoye", creeLe: iso(T0 - 1000 * i), modifieLe: iso(T0 - 1000 * i) } as never);
    }
    const { client } = diffuseurParPost({});
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel("vis_ancien")).toBe("publie");
  });

  it("le rattrapage reste borné : 25 visuels à rattraper, 20 au plus par passage, les autres au passage suivant", async () => {
    for (let i = 1; i <= 25; i++) {
      await visuelSimple("programme", `vis_r${i}`);
      await depots().publications.enregistrer({ id: `pub_r${i}`, visuelId: `vis_r${i}`, reseau: "instagram", statut: "publiee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: `post-r${i}`, canalId: COMPTE, etatEnvoi: "envoye", creeLe: iso(T0), modifieLe: iso(T0 - 1000 * i) } as never);
    }
    const { client } = diffuseurParPost({});
    injecterClientZernio(client);
    const publies = async () => (await depots().visuels.lister()).filter((v) => v.statut === "publie").length;
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await publies()).toBe(20);
    await synchroniserEtatsZernio({ force: true, instant: T0 + 1000 });
    expect(await publies()).toBe(25);
  });
});

describe("L5-06 · décision du pilote, point 5 : budget de TOUTES les requêtes réellement tenu", () => {
  const BUDGET = 51; // 1 lecture des comptes + 50 requêtes de posts au plus par passage
  const sansAdresse = (appels: AppelEnregistre[]) => appels.map((a) => `${a.methode} ${new URL(a.url).pathname}${new URL(a.url).search}`);

  it("passage complet, 60 posts absents : comptes, pages et lectures unitaires comprises, au plus 51 requêtes", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60, new Set(Array.from({ length: 60 }, (_, i) => i + 1)));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(appels.length).toBeLessThanOrEqual(BUDGET);
  });

  it("la lecture des comptes est comptée : elle figure parmi les requêtes du passage et dans le budget", async () => {
    await publications(5);
    const { client, appels } = diffuseur(600, new Set([1, 2, 3, 4, 5]));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(sansAdresse(appels).filter((a) => a.includes("/v1/accounts"))).toHaveLength(1);
    expect(appels.length).toBeLessThanOrEqual(BUDGET);
  });

  it("la liste échoue à la 2e page : les posts de la 1re page ne sont pas relus un à un, et le total reste sous 51", async () => {
    await publications(80);
    const posts = Array.from({ length: 80 }, (_, i) => postPublie(i + 1));
    const appels: AppelEnregistre[] = [];
    const { client } = creerFauxClientZernio((a) => {
      appels.push(a);
      const u = new URL(a.url);
      if (u.pathname.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: COMPTE, platform: "instagram", isActive: true }] } };
      if (u.pathname.endsWith("/v1/posts")) {
        const page = Number(u.searchParams.get("page") ?? 1);
        return page === 1 ? { statut: 200, corps: { posts: posts.slice(0, 50) } } : { statut: 500, corps: { error: "panne simulée" } };
      }
      const m = /\/v1\/posts\/exemple-post-(\d+)$/.exec(u.pathname);
      return m ? { statut: 200, corps: { post: postPublie(Number(m[1])) } } : { statut: 404, corps: {} };
    });
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    const lus = sansAdresse(appels).filter((a) => /\/v1\/posts\/exemple-post-\d+$/.test(a.replace("GET ", "").split("?")[0].replace("/api", "")));
    const dejaLusEnListe = lus.filter((a) => Number(/exemple-post-(\d+)/.exec(a)![1]) <= 50);
    expect(dejaLusEnListe).toHaveLength(0);
    expect(appels.length).toBeLessThanOrEqual(BUDGET);
    expect(r.lues).toBeGreaterThanOrEqual(50);
  });

  it("sans liste (passage incrémental), 60 publications : comptes comprise, au plus 51 requêtes", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60, new Set(), true);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(appels.length).toBeLessThanOrEqual(BUDGET);
  });
});

describe("L5-06 · relecture du tour 1 : état final du passage, réseaux sans visuel, rattrapage non bloquant, budget en pagination", () => {
  for (const premier of ["pi", "pl"] as const) {
    it(`visuel « validé », Instagram programmée en échec chez le diffuseur, LinkedIn envoyée en brouillon puis publiée (lue d'abord : ${premier}) : « validé », le nouvel essai reste possible`, async () => {
      await visuelSimple("valide");
      await pubVisuel("pi", "instagram", { etatLuLe: iso(T0 - (premier === "pi" ? 2000 : 1000)) });
      await pubVisuel("pl", "linkedin", { statut: "brouillon", etatLuLe: iso(T0 - (premier === "pl" ? 2000 : 1000)) });
      const { client } = diffuseurParPost({ "post-pi": { status: "failed" }, "post-pl": { status: "published", plateforme: "linkedin" } });
      injecterClientZernio(client);
      await synchroniserEtatsZernio({ force: true, instant: T0 });
      expect((await depots().publications.obtenir("pi"))?.statut).toBe("echec");
      expect((await depots().publications.obtenir("pl"))?.statut).toBe("publiee");
      expect(await statutVisuel()).toBe("valide");
    });
  }

  it("un créneau qui prévoit aussi un réseau sans visuel (tiktok) ne bloque pas le visuel : « publié » quand Instagram est publiée", async () => {
    await visuelSimple("valide");
    await depots().creneauxEditoriaux.enregistrer({ id: "cre_1", jourVise: "2026-11-12", heuresParReseau: { instagram: DATE, tiktok: DATE }, compteCible: COMPTE, visuelId: "vis_1", statut: "valide", decalages: 0, valideeLe: iso(T0 - 7200_000) } as never);
    await pubVisuel("pi", "instagram");
    const { client } = diffuseurParPost({ "post-pi": { status: "published" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("publie");
  });

  it("une lecture de dépôt en échec pendant le rattrapage ne bloque pas la synchro : les publications sont relues", async () => {
    await visuelSimple("programme");
    await pubVisuel("pi", "instagram");
    const { client } = diffuseurParPost({ "post-pi": { status: "published" } });
    injecterClientZernio(client);
    const espion = vi.spyOn(depots().visuels, "lister").mockRejectedValue(new Error("panne simulée"));
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    espion.mockRestore();
    expect(r.lues).toBe(1);
    expect((await depots().publications.obtenir("pi"))?.statut).toBe("publiee");
  });

  it("la liste échoue à la 10e page après 9 pages lues, 50 posts hors liste : toutes requêtes comptées, au plus 51", async () => {
    await publications(500);
    const posts = Array.from({ length: 450 }, (_, i) => postPublie(i + 1));
    const appels: AppelEnregistre[] = [];
    const { client } = creerFauxClientZernio((a) => {
      appels.push(a);
      const u = new URL(a.url);
      if (u.pathname.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: COMPTE, platform: "instagram", isActive: true }] } };
      if (u.pathname.endsWith("/v1/posts")) {
        const page = Number(u.searchParams.get("page") ?? 1);
        return page <= 9 ? { statut: 200, corps: { posts: posts.slice((page - 1) * 50, page * 50) } } : { statut: 500, corps: { error: "panne simulée" } };
      }
      const m = /\/v1\/posts\/exemple-post-(\d+)$/.exec(u.pathname);
      return m ? { statut: 200, corps: { post: postPublie(Number(m[1])) } } : { statut: 404, corps: {} };
    });
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(appels.length).toBeLessThanOrEqual(BUDGET_TOUTES);
    expect(r.lues).toBeGreaterThanOrEqual(450);
  });
});

/* ------------------------------------------------------------------ */
/* Audit Opus, point 1 : un post incomplet de la liste ne fait jamais tomber le passage                   */
/* ------------------------------------------------------------------ */

describe("L5-06 · audit point 1 : posts incomplets de la liste écartés, relus un à un, jamais rejetés", () => {
  /** Liste de 60 posts dont `abimes` sont altérés ; les lectures unitaires (`unitaire`) disent la vérité du diffuseur. */
  function diffuseurAbime(abimes: Record<number, (p: Record<string, unknown>) => Record<string, unknown>>, unitaire: (n: number) => { statut: number; corps: unknown } = (n) => ({ statut: 200, corps: { post: postPublie(n) } })) {
    const appels: AppelEnregistre[] = [];
    const { client } = creerFauxClientZernio((a) => {
      appels.push(a);
      const u = new URL(a.url);
      if (u.pathname.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: COMPTE, platform: "instagram", isActive: true }] } };
      if (u.pathname.endsWith("/v1/posts")) {
        const page = Number(u.searchParams.get("page") ?? 1);
        const tous = Array.from({ length: 60 }, (_, i) => (abimes[i + 1] ? abimes[i + 1](postPublie(i + 1) as never) : postPublie(i + 1)));
        return { statut: 200, corps: { posts: tous.slice((page - 1) * 50, page * 50) } };
      }
      const m = /\/v1\/posts\/exemple-post-(\d+)$/.exec(u.pathname);
      return m ? unitaire(Number(m[1])) : { statut: 404, corps: {} };
    });
    return { client, appels };
  }
  const sans = (cle: string) => (p: Record<string, unknown>) => {
    return Object.fromEntries(Object.entries(p).filter(([k]) => k !== cle));
  };

  it("un post de la liste sans « platforms » : il est relu seul, les 59 autres sont mis à jour, budget tenu, rien n'est rejeté", async () => {
    await publications(60);
    const { client, appels } = diffuseurAbime({ 1: sans("platforms") });
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r).toEqual({ lues: 60, changees: 60 });
    expect((await depots().publications.lister()).every((p) => p.statut === "publiee")).toBe(true);
    expect(appels.filter((a) => /\/v1\/posts\/exemple-post-\d+$/.test(new URL(a.url).pathname)).map((a) => new URL(a.url).pathname)).toEqual(["/api/v1/posts/exemple-post-1"]);
    expect(appels.length).toBeLessThanOrEqual(BUDGET_TOUTES);
    expect(ecritures(appels)).toHaveLength(0);
  });

  it("un post de la liste sans « _id » (ou « _id » non chaîne) n'empêche rien : les publications sont mises à jour", async () => {
    await publications(60);
    const { client, appels } = diffuseurAbime({ 2: (p) => ({ ...p, _id: 7 }), 3: sans("_id") });
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.lues).toBe(60);
    expect((await depots().publications.lister()).every((p) => p.statut === "publiee")).toBe(true);
    expect(appels.length).toBeLessThanOrEqual(BUDGET_TOUTES);
  });

  it("un post de la liste sans « status » ne fait JAMAIS passer une publication programmée à brouillon, même si la relecture seule échoue", async () => {
    await publications(60);
    const { client, appels } = diffuseurAbime({ 2: sans("status") }, (n) => (n === 2 ? { statut: 500, corps: { error: "panne simulée" } } : { statut: 200, corps: { post: postPublie(n) } }));
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().publications.obtenir("p2"))?.statut).toBe("programmee");
    expect(r.lues).toBe(59);
    expect((await depots().publications.lister()).filter((p) => p.statut === "publiee")).toHaveLength(59);
    expect(appels.length).toBeLessThanOrEqual(BUDGET_TOUTES);
  });

  it("un post illisible (plateforme nulle) qui passe le filtre : le passage ne tombe pas, les autres sont mis à jour", async () => {
    await publications(60);
    const { client } = diffuseurAbime({ 4: (p) => ({ ...p, platforms: [null] }) });
    injecterClientZernio(client);
    await expect(synchroniserEtatsZernio({ force: true, instant: T0 })).resolves.toBeDefined();
    const publiees = (await depots().publications.lister()).filter((p) => p.statut === "publiee");
    expect(publiees.length).toBeGreaterThanOrEqual(59);
    expect((await depots().publications.obtenir("p5"))?.statut).toBe("publiee");
  });

  it("des posts incomplets en nombre (45) : les lectures seules restent sous le plafond de 40, budget total de 51 tenu", async () => {
    await publications(60);
    const abimes = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, sans("platforms")]));
    const { client, appels } = diffuseurAbime(abimes);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(appels.filter((a) => /\/v1\/posts\/exemple-post-\d+$/.test(new URL(a.url).pathname))).toHaveLength(40);
    expect(appels.length).toBeLessThanOrEqual(BUDGET_TOUTES);
  });
});

/* ------------------------------------------------------------------ */
/* Audit Opus, point 2 : non-régression d'étape d'un visuel                                                */
/* ------------------------------------------------------------------ */

describe("L5-06 · audit point 2 : l'étape d'un visuel ne régresse jamais (règles de `reconcilier`)", () => {
  const passe = async (etat: EtatPost) => {
    const { client } = diffuseurParPost({ "post-pi": etat });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    return statutVisuel();
  };

  it("un visuel « publié » dont la publication est relue « programmée » reste « publié »", async () => {
    await visuelSimple("publie");
    await pubVisuel("pi", "instagram", { statut: "brouillon" });
    expect(await passe({ status: "scheduled" })).toBe("publie");
  });

  it("un visuel « publié » dont la publication est relue en échec reste « publié »", async () => {
    await visuelSimple("publie");
    await pubVisuel("pi", "instagram");
    expect(await passe({ status: "failed" })).toBe("publie");
  });

  it("un visuel « publié » : programmée puis échec, en deux passages successifs, reste « publié »", async () => {
    await visuelSimple("publie");
    await pubVisuel("pi", "instagram", { statut: "brouillon" });
    expect(await passe({ status: "scheduled" })).toBe("publie");
    expect(await passe({ status: "failed" })).toBe("publie");
  });

  // Comportement écrit : `reconcilier` ne passe jamais un visuel « echec_envoi » à « publie » (l'envoi doit être refait par l'utilisateur).
  it("un visuel « envoi échoué » dont la publication passe « publiée » : il reste « envoi échoué » (aucune transition permise depuis cet état)", async () => {
    await visuelSimple("echec_envoi");
    // Garde de la règle écrite : `reconcilier` elle-même ne le fait pas avancer.
    expect(reconcilier({ diffuseur: "publie" }, { creneau: { id: "c", statut: "publie" }, publication: { id: "p", statut: "programmee" }, visuel: { id: "v", statut: "echec_envoi" } }).visuel?.statut ?? "echec_envoi").toBe("echec_envoi");
    await pubVisuel("pi", "instagram");
    expect(await passe({ status: "published" })).toBe("echec_envoi");
  });

  it("un visuel « programmé » dont la publication échoue passe « envoi échoué », puis un nouvel échec ne le change plus", async () => {
    await visuelSimple("programme");
    await pubVisuel("pi", "instagram");
    expect(await passe({ status: "failed" })).toBe("echec_envoi");
    expect(await passe({ status: "failed" })).toBe("echec_envoi");
  });
});

/* ------------------------------------------------------------------ */
/* Décision du pilote n° 2 (18/11/2026) : interrupteur zernio.synchro_etape_visuels, ÉTEINT par défaut          */
/* ------------------------------------------------------------------ */

describe("L5-06 · décision n° 2 : interrupteur « zernio.synchro_etape_visuels »", () => {
  const eteindre = async (mode: "absent" | "faux" | "autre") => {
    if (mode === "absent") await depots().parametres.supprimer(CLE_SYNCHRO_ETAPE);
    else await ecrireParametre(CLE_SYNCHRO_ETAPE, mode === "faux" ? false : "oui");
  };
  const ecrituresVisuels = () => vi.spyOn(depots().visuels, "modifier");

  for (const mode of ["absent", "faux", "autre"] as const) {
    it(`ÉTEINT (${mode}) : un visuel « programmé » dont la publication est publiée n'est PAS touché (passage et rattrapage), la publication, elle, est mise à jour`, async () => {
      await eteindre(mode);
      await visuelSimple("programme");
      await pubVisuel("pi", "instagram");
      const espion = ecrituresVisuels();
      const { client, appels } = diffuseurParPost({ "post-pi": { status: "published" } });
      injecterClientZernio(client);
      await synchroniserEtatsZernio({ force: true, instant: T0 });
      await synchroniserEtatsZernio({ force: true, instant: T0 + 1000 });
      expect((await depots().publications.obtenir("pi"))?.statut).toBe("publiee");
      expect(await statutVisuel()).toBe("programme");
      expect(espion).not.toHaveBeenCalled();
      expect(ecritures(appels)).toHaveLength(0);
    });
  }

  it("ÉTEINT : le rattrapage n'écrit jamais visuels.statut (25 visuels à rattraper, aucun ne bouge, aucune écriture de visuel)", async () => {
    await eteindre("absent");
    for (let i = 1; i <= 25; i++) {
      await visuelSimple("programme", `vis_r${i}`);
      await depots().publications.enregistrer({ id: `pub_r${i}`, visuelId: `vis_r${i}`, reseau: "instagram", statut: "publiee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: `post-r${i}`, canalId: COMPTE, etatEnvoi: "envoye", creeLe: iso(T0), modifieLe: iso(T0) } as never);
    }
    const espion = ecrituresVisuels();
    const { client } = diffuseurParPost({});
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(espion).not.toHaveBeenCalled();
    expect((await depots().visuels.lister()).filter((v) => v.statut !== "programme")).toHaveLength(0);
  });

  it("ÉTEINT : un visuel « validé » (échec ou programmation chez le diffuseur) reste « validé » et un visuel « programmé » en échec reste « programmé »", async () => {
    await eteindre("absent");
    await visuelSimple("valide", "vis_1");
    await pubVisuel("pi", "instagram", { statut: "brouillon" });
    await visuelSimple("programme", "vis_2");
    await depots().publications.enregistrer({ id: "pj", visuelId: "vis_2", reseau: "instagram", statut: "programmee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: "post-pj", canalId: COMPTE, etatEnvoi: "envoye", envoiCommenceLe: iso(T0 - 3600_000), creeLe: iso(T0), modifieLe: iso(T0) } as never);
    const { client } = diffuseurParPost({ "post-pi": { status: "scheduled" }, "post-pj": { status: "failed" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel("vis_1")).toBe("valide");
    expect(await statutVisuel("vis_2")).toBe("programme");
  });

  it("ÉTEINT : la lecture page par page (liste) reste active, au même budget, et les publications sont mises à jour", async () => {
    await eteindre("absent");
    await publications(60);
    const { client, appels } = diffuseur(60);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.lues).toBe(60);
    expect(appels.filter((a) => new URL(a.url).pathname.endsWith("/v1/posts")).length).toBeGreaterThanOrEqual(2);
    expect(appels.length).toBeLessThanOrEqual(BUDGET_TOUTES);
    expect(ecritures(appels)).toHaveLength(0);
  });

  it("ALLUMÉ (true) : un visuel « programmé » dont la publication est publiée passe « publié » (règles du 17/11), au passage et au rattrapage", async () => {
    await ecrireParametre(CLE_SYNCHRO_ETAPE, true);
    await visuelSimple("programme");
    await pubVisuel("pi", "instagram");
    const { client } = diffuseurParPost({ "post-pi": { status: "published" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("publie");
    await visuelSimple("programme", "vis_2");
    await depots().publications.enregistrer({ id: "pk", visuelId: "vis_2", reseau: "instagram", statut: "publiee", via: "zernio", date: DATE, texte: "Texte d'exemple", idExterne: "post-pk", canalId: COMPTE, etatEnvoi: "envoye", creeLe: iso(T0), modifieLe: iso(T0) } as never);
    await synchroniserEtatsZernio({ force: true, instant: T0 + 1000 });
    expect(await statutVisuel("vis_2")).toBe("publie");
  });

  it("ALLUMÉ : seul « true » allume (une valeur « oui » ou 1 laisse éteint)", async () => {
    await ecrireParametre(CLE_SYNCHRO_ETAPE, 1);
    await visuelSimple("programme");
    await pubVisuel("pi", "instagram");
    const { client } = diffuseurParPost({ "post-pi": { status: "published" } });
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("programme");
  });

  it("l'interrupteur est relu à CHAQUE passage : éteint puis allumé entre deux passages, le visuel suit au second", async () => {
    await visuelSimple("programme");
    await pubVisuel("pi", "instagram");
    const { client } = diffuseurParPost({ "post-pi": { status: "published" } });
    injecterClientZernio(client);
    await eteindre("faux");
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await statutVisuel()).toBe("programme");
    await ecrireParametre(CLE_SYNCHRO_ETAPE, true);
    await synchroniserEtatsZernio({ force: true, instant: T0 + 1000 });
    expect(await statutVisuel()).toBe("publie");
  });
});
