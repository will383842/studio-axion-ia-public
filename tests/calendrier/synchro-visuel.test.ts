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
const auth = await import("@/services/auth");
const MDP = "essai-l5-06-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio } = await import("@/services/zernio");
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
    expect(appels.filter((a) => new URL(a.url).pathname.endsWith("/v1/posts"))).toHaveLength(0);
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

  it("une page de liste en échec : retour au passage incrémental limité à 50 lectures", async () => {
    await publications(60);
    const { client, appels } = diffuseur(60, new Set(), true);
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(r.lues).toBe(50);
    expect(unitaires(appels)).toHaveLength(50);
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

  it("un visuel « validé » n'est jamais publié d'un coup (transition refusée par L5-05) : inchangé", async () => {
    await visuel("valide");
    await publications(1, () => ({ videoId: undefined, visuelId: "vis_1" }));
    const { client } = diffuseur(1);
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("valide");
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
    const espion = vi.spyOn(depots().visuels, "modifier").mockRejectedValueOnce(new Error("panne simulée"));
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
    await pubVisuel("pi", "instagram");
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
