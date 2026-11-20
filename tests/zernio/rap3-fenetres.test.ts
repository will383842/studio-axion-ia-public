/** RAP-3 · fenêtres restantes du retrait groupé : relecture au clic, retour de la bonne clé, marque d'espace sans dépendre d'une écriture, textes. Client factice, données fictives, aucune clé. */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-rap3s-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio } = await import("@/services/zernio");

const T0 = Date.parse("2026-11-20T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const fabrique = (n: number, status: string, extra: Partial<PostZernio> = {}): PostZernio => ({
  _id: `p-${status}-${n}`,
  content: "t",
  status,
  scheduledFor: iso(T0 + (n + 1) * 3600_000),
  platforms: [{ platform: "instagram", accountId: "compte-fictif", status: "pending" }],
  metadata: { origine: "import-buffer", studioCle: `imp-${status}-${n}` },
  ...extra,
});
interface Faux {
  client: ClientZernio;
  posts: PostZernio[];
  introuvables: Set<string>;
  erreurs5xx: Set<string>;
  auLire?: (id: string) => Promise<void>;
  etat: { liste: number; unitaires: number; comptes: number; erreurListe: "debit" | null; ecritures: number };
}

/** Client factice : lit (comptes, liste, post seul) ; TOUTE écriture lève et est comptée. */
function faux(posts: PostZernio[]): Faux {
  const f: Faux = { client: null as never, posts, introuvables: new Set(), erreurs5xx: new Set(), etat: { liste: 0, unitaires: 0, comptes: 0, erreurListe: null, ecritures: 0 } };
  const interdit = (nom: string) => () => {
    f.etat.ecritures++;
    throw new Error(`écriture interdite : ${nom}`);
  };
  const base = {
    async listerComptes() {
      f.etat.comptes++;
      return [];
    },
    async listerPosts(q?: Record<string, string | number | boolean>) {
      f.etat.liste++;
      if (f.etat.erreurListe) throw new ErreurZernio("debit", "plafond de débit");
      const tous = f.posts.filter((p) => (q?.status ? p.status === q.status : true));
      const page = Number(q?.page ?? 1);
      const limite = Number(q?.limit ?? 50);
      return tous.slice((page - 1) * limite, page * limite);
    },
    async lirePost(id: string) {
      f.etat.unitaires++;
      if (f.auLire) await f.auLire(id);
      if (f.erreurs5xx.has(id)) throw new ErreurZernio("indisponible", "5xx", { statut: 503 });
      const p = f.posts.find((x) => x._id === id);
      if (!p || f.introuvables.has(id)) throw new ErreurZernio("introuvable", "404", { statut: 404 });
      return p;
    },
    creerPost: interdit("creerPost"),
    promouvoir: interdit("promouvoir"),
    retirer: interdit("retirer"),
    requete: interdit("requete"),
    publishNow: interdit("publishNow"),
  };
  f.client = new Proxy(base, {
    get(cible, cle) {
      if (cle in cible) return (cible as never)[cle];
      return interdit(String(cle));
    },
  }) as unknown as ClientZernio;
  return f;
}

afterEach(() => vi.useRealTimers());

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
});



const H = 3600_000;
const M = 60_000;
const { lireEcartCalendrier } = await import("@/services/ecart-calendrier");
const { retirerIntrouvablesAction } = await import("@/app/(studio)/calendrier/actions/retirer-introuvables");
const { retirerRapatrieeAction } = await import("@/app/(studio)/calendrier/actions/retirer-rapatriee");
const { PARAM_ECART_CALENDRIER } = await import("@/services/zernio");

async function passe(instant: number): Promise<void> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instant);
  await synchroniserEtatsZernio({ force: true, instant });
}
const retirables = async (): Promise<string[]> => (((await lireEcartCalendrier()) as { retirables?: string[] } | null)?.retirables ?? []).sort();
const retirees = async () => (await depots().publications.lister((x) => !!x.retireeLe)).map((x) => x.idExterne).sort();
const idDe = (n: number) => `zr_p-scheduled-${n}_compte-fictif`;
const notifs = async () => (await depots().notifications.lister()).length;

/** Trois posts rapatriés ; 0 et 1 disparaissent (404, liste sans eux), 2 reste ; constats à +40 min, +55 min, +24 h 50. Retirables à +25 h 05. */
async function etatRetirable(f: Faux): Promise<number> {
  await passe(T0);
  f.introuvables = new Set(["p-scheduled-0", "p-scheduled-1"]);
  f.posts = f.posts.filter((p) => p._id === "p-scheduled-2");
  for (const dt of [40 * M, 55 * M, 24 * H + 50 * M]) await passe(T0 + dt);
  vi.setSystemTime(T0 + 25 * H + 5 * M);
  return T0 + 25 * H + 5 * M;
}

describe("RAP-3 fenêtres · (1) relecture seule au clic du retrait groupé", () => {
  it("un post revenu dans la dernière demi-heure répond à la relecture : refusé, remis à la normale, l'autre est retiré", async () => {
    const trois = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(trois);
    injecterClientZernio(f.client);
    await etatRetirable(f);
    expect(await retirables()).toEqual([idDe(0), idDe(1)]);
    f.introuvables = new Set(["p-scheduled-1"]); // le 0 est revenu chez le diffuseur, sans passage de synchro depuis
    f.posts = [trois[0], trois[2]];
    const avant = f.etat.unitaires;
    const r = await retirerIntrouvablesAction([idDe(0), idDe(1)]);
    expect(r).toMatchObject({ ok: true, donnees: { retirees: 1 } });
    expect(f.etat.unitaires - avant).toBe(2); // lecture seule, une par publication
    expect(await retirees()).toEqual(["p-scheduled-1"]);
    const p0 = (await depots().publications.lister((x) => x.idExterne === "p-scheduled-0"))[0];
    expect(p0.etatEnvoi).toBeUndefined();
    expect(p0.introuvableDepuis).toBeUndefined();
    expect(p0.constatsIntrouvable).toBeUndefined();
    expect(p0.retireeLe).toBeUndefined();
    expect(f.etat.ecritures).toBe(0);
  });
  it("tous les posts répondent : rien n'est retiré, tous remis à la normale", async () => {
    const trois = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(trois);
    injecterClientZernio(f.client);
    await etatRetirable(f);
    f.introuvables = new Set();
    f.posts = trois;
    const r = await retirerIntrouvablesAction([idDe(0), idDe(1)]);
    expect(r.ok).toBe(true);
    expect(await retirees()).toEqual([]);
    expect(await retirables()).toEqual([]);
  });
  it("réponse incertaine (5xx) : le post n'est pas vérifié, donc pas retiré, et reste tel quel", async () => {
    const trois = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(trois);
    injecterClientZernio(f.client);
    await etatRetirable(f);
    f.erreurs5xx = new Set(["p-scheduled-0"]);
    await retirerIntrouvablesAction([idDe(0), idDe(1)]);
    expect(await retirees()).toEqual(["p-scheduled-1"]);
    const p0 = (await depots().publications.lister((x) => x.idExterne === "p-scheduled-0"))[0];
    expect(p0.etatEnvoi).toBe("a-verifier");
  });
  it("plus de 10 à retirer : 10 relus et retirés au plus par clic, et le message le dit", async () => {
    const posts = Array.from({ length: 13 }, (_, i) => fabrique(i, "scheduled"));
    const f = faux(posts);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(posts.slice(0, 12).map((p) => p._id));
    f.posts = [posts[12]];
    for (const dt of [40 * M, 55 * M, 24 * H + 50 * M, 25 * H + 20 * M]) await passe(T0 + dt); // 10 relectures au plus par passage : deux passages pour les 12
    vi.setSystemTime(T0 + 25 * H + 20 * M);
    const ids = await retirables();
    expect(ids).toHaveLength(12);
    const avant = f.etat.unitaires;
    const r = await retirerIntrouvablesAction(ids);
    expect(f.etat.unitaires - avant).toBe(10);
    expect(await retirees()).toHaveLength(10);
    expect(r.ok && r.donnees.retirees).toBe(10);
    expect(r.ok && r.donnees.message).toMatch(/10/);
    expect(r.ok && r.donnees.message).toMatch(/2 autres/);
  });
});

describe("RAP-3 fenêtres · (2) retour de la bonne clé", () => {
  /** Mauvaise clé 26 h (autre espace avec 2 posts importés), puis la clé est réparée. */
  async function mauvaiseCle(f: Faux, nosPosts: PostZernio[]): Promise<void> {
    await passe(T0);
    f.introuvables = new Set(nosPosts.map((p) => p._id));
    f.posts = [fabrique(7, "scheduled", { _id: "etranger-1" }), fabrique(8, "scheduled", { _id: "etranger-2" })];
    for (const dt of [40 * M, 55 * M, 24 * H + 50 * M, 26 * H]) await passe(T0 + dt);
  }
  it("au passage du retour : nos posts de la liste sont remis à la normale AVANT la mesure ; ni bouton ni action pendant ce passage", async () => {
    await depots().publications.enregistrer({ id: "pub_s", reseau: "instagram", statut: "programmee", via: "zernio", idExterne: "p-scheduled-5", etatEnvoi: "envoye", date: iso(T0 + 40 * H), texte: "t", creeLe: iso(T0 - H), modifieLe: iso(T0 - H) } as never);
    const nos = [fabrique(0, "scheduled"), fabrique(1, "scheduled")];
    const f = faux([...nos, fabrique(5, "scheduled")]);
    injecterClientZernio(f.client);
    await mauvaiseCle(f, [...nos, fabrique(5, "scheduled")]);
    expect((await retirables())).toEqual([]);
    // clé réparée : nos posts reviennent dans la liste ; pendant la lecture seule du post du Studio, on regarde l'écran et l'action
    f.introuvables = new Set(["p-scheduled-5"]);
    f.posts = [...nos];
    const vu: { retirables: string[]; action: boolean | null } = { retirables: ["pas-lu"], action: null };
    f.auLire = async (id) => {
      if (id !== "p-scheduled-5") return;
      f.auLire = undefined;
      vu.retirables = await retirables();
      vu.action = (await retirerIntrouvablesAction([idDe(0), idDe(1)])).ok;
    };
    await passe(T0 + 26 * H + 15 * M);
    expect(vu.retirables).toEqual([]);
    expect(vu.action).toBe(false);
    expect(await retirees()).toEqual([]);
  });
  it("après la chute de la marque : un constat antérieur ou du même passage ne rend rien retirable ; un constat d'un passage postérieur, oui", async () => {
    const trois = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(trois);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(trois.map((p) => p._id));
    f.posts = [fabrique(7, "scheduled", { _id: "etranger-1" })];
    for (const dt of [40 * M, 55 * M, 24 * H + 50 * M, 26 * H]) await passe(T0 + dt);
    // clé réparée ; le post 0 est vraiment supprimé, 1 et 2 sont là
    f.introuvables = new Set(["p-scheduled-0"]);
    f.posts = [trois[1], trois[2]];
    await passe(T0 + 26 * H + 15 * M); // la marque tombe ici
    const mesure = (await depots().parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as { espaceSuspectLe?: string; espaceRetrouveLe?: string };
    expect(mesure.espaceSuspectLe).toBeUndefined();
    expect(mesure.espaceRetrouveLe).toBe(iso(T0 + 26 * H + 15 * M));
    expect(await retirables()).toEqual([]);
    await passe(T0 + 26 * H + 20 * M); // moins de 30 min depuis le dernier constat : pas relu, son constat date d'avant la chute
    expect(await retirables()).toEqual([]);
    await passe(T0 + 26 * H + 30 * M); // relu seul : constat postérieur à la chute, passage complet terminé
    expect(await retirables()).toEqual([idDe(0)]);
  });
});

describe("RAP-3 fenêtres · (3) la marque ne dépend pas d'une seule écriture", () => {
  it("l'écriture de la mesure échoue au premier passage suspect : au passage suivant, les posts importés n'attestent pas l'espace", async () => {
    const nos = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(nos);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(nos.map((p) => p._id));
    f.posts = [fabrique(7, "scheduled", { _id: "etranger-1" }), fabrique(8, "scheduled", { _id: "etranger-2" })];
    const reel = depots().parametres.enregistrer.bind(depots().parametres);
    const espion = vi.spyOn(depots().parametres, "enregistrer").mockImplementation(async (x) => {
      if (x.id === PARAM_ECART_CALENDRIER) throw new Error("écriture impossible");
      return reel(x);
    });
    await passe(T0 + 40 * M); // import des posts étrangers réussi, écriture de la mesure en échec
    espion.mockRestore();
    for (const dt of [55 * M, 24 * H + 50 * M, 25 * H + 5 * M]) await passe(T0 + dt);
    const mesure = (await depots().parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as { espaceSuspectLe?: string; connusFiables?: number };
    expect(mesure.espaceSuspectLe).toBeTruthy();
    expect(mesure.connusFiables).toBe(0);
    expect(await retirables()).toEqual([]);
    expect((await retirerIntrouvablesAction(nos.map((p) => `zr_${p._id}_compte-fictif`))).ok).toBe(false);
    expect(await retirees()).toEqual([]);
  });
});

describe("RAP-3 suite finale · marque d'espace et clic hors verrou", () => {
  const ecritureEnEchec = (premiereSeulement: boolean) => {
    const reel = depots().parametres.enregistrer.bind(depots().parametres);
    let n = 0;
    return vi.spyOn(depots().parametres, "enregistrer").mockImplementation(async (x) => {
      if (x.id === PARAM_ECART_CALENDRIER && (!premiereSeulement || n++ === 0)) throw new Error("écriture impossible");
      return reel(x);
    });
  };
  it("la première écriture de la mesure échoue, le repli réussit : la marque est posée au passage suivant, rien n'est retirable sur 27 h", async () => {
    const nos = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(nos);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(nos.map((p) => p._id));
    f.posts = [fabrique(7, "scheduled", { _id: "etranger-1" }), fabrique(8, "scheduled", { _id: "etranger-2" })];
    const espion = ecritureEnEchec(true);
    await passe(T0 + 40 * M);
    espion.mockRestore();
    for (const dt of [55 * M, 24 * H + 50 * M, 27 * H]) {
      await passe(T0 + dt);
      expect(await retirables()).toEqual([]);
    }
    const mesure = (await depots().parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as { espaceSuspectLe?: string };
    expect(mesure.espaceSuspectLe).toBeTruthy();
    expect((await retirerIntrouvablesAction(nos.map((p) => idDe(Number(p._id.slice(-1)))))).ok).toBe(false);
    expect(await retirees()).toEqual([]);
  });
  it("calendrier neuf, écriture de la mesure en échec : pas de marque ; un vrai post disparu depuis plus de 24 h reste retirable", async () => {
    const trois = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(trois);
    injecterClientZernio(f.client);
    const espion = ecritureEnEchec(false);
    await passe(T0); // import des 3 posts, mesure non écrite
    espion.mockRestore();
    await passe(T0 + 40 * M);
    f.introuvables = new Set(["p-scheduled-0"]);
    f.posts = [trois[1], trois[2]];
    for (const dt of [95 * M, 130 * M, 25 * H + 50 * M]) await passe(T0 + dt);
    vi.setSystemTime(T0 + 25 * H + 55 * M);
    const mesure = (await depots().parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as { espaceSuspectLe?: string };
    expect(mesure.espaceSuspectLe).toBeUndefined();
    expect(await retirables()).toEqual([idDe(0)]);
  });
  it("les lectures du clic se font hors du verrou global", async () => {
    const trois = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(trois);
    injecterClientZernio(f.client);
    await etatRetirable(f);
    const { sousVerrou } = await import("@/services/_commun");
    let libre: boolean | null = null;
    f.auLire = async () => {
      f.auLire = undefined;
      libre = await Promise.race([sousVerrou(async () => true), new Promise<boolean>((r) => setTimeout(() => r(false), 200))]);
    };
    const r = await retirerIntrouvablesAction([idDe(0), idDe(1)]);
    expect(r.ok).toBe(true);
    expect(libre).toBe(true);
  });
  it("l'état change pendant les lectures : rien n'est retiré", async () => {
    const trois = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(trois);
    injecterClientZernio(f.client);
    await etatRetirable(f);
    f.auLire = async () => {
      f.auLire = undefined;
      const p = (await depots().publications.lister((x) => x.idExterne === "p-scheduled-1"))[0];
      await depots().publications.modifier(p.id, { etatEnvoi: undefined, erreur: undefined, constatsIntrouvable: undefined });
    };
    const r = await retirerIntrouvablesAction([idDe(0), idDe(1)]);
    expect(r.ok).toBe(false);
    expect(await retirees()).toEqual([]);
  });
});

describe("RAP-3 fenêtres · (4) textes et notification groupée", () => {
  it("retrait unitaire d'une rapatriée « à vérifier » : le diffuseur ne la retrouve plus, rien n'est changé chez lui", async () => {
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await passe(T0);
    f.introuvables = new Set(["p-scheduled-0"]);
    f.posts = [];
    await passe(T0 + 40 * M);
    const r = await retirerRapatrieeAction(idDe(0));
    expect(r.ok && r.donnees.message).toContain("Le diffuseur ne retrouve plus ce post ; rien n'est changé chez lui.");
    expect(r.ok && r.donnees.message).not.toContain("reste programmé");
  });
  it("espace suspect : UNE notification groupée, pas une par publication", async () => {
    const nos = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(nos);
    injecterClientZernio(f.client);
    await passe(T0);
    const avant = await notifs();
    f.introuvables = new Set(nos.map((p) => p._id));
    f.posts = [];
    await passe(T0 + 40 * M);
    expect((await depots().publications.lister((x) => x.etatEnvoi === "a-verifier")).length).toBe(3);
    expect((await notifs()) - avant).toBe(1);
  });
  it("espace sain : une notification par publication, comme avant", async () => {
    const nos = [fabrique(0, "scheduled"), fabrique(1, "scheduled"), fabrique(2, "scheduled")];
    const f = faux(nos);
    injecterClientZernio(f.client);
    await passe(T0);
    const avant = await notifs();
    f.introuvables = new Set(["p-scheduled-0", "p-scheduled-1"]);
    f.posts = [nos[2]];
    await passe(T0 + 40 * M);
    expect((await notifs()) - avant).toBe(2);
  });
});
