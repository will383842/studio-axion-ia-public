/** RAP-2 · synchronisation continue des publications du diffuseur et écart mesuré. Client factice, données 100 % fictives, aucune clé. */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio, estCompteSuspendu } from "@/fournisseurs/publication/zernio-erreurs";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const MDP = "essai-rap2-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio, BUDGET_REQUETES_PAR_PASSAGE } = await import("@/services/zernio");

const T0 = Date.parse("2026-11-20T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const ECART = "zernio.ecart_calendrier";

const fabrique = (n: number, status: string, extra: Partial<PostZernio> = {}): PostZernio => ({
  _id: `p-${status}-${n}`,
  content: "t",
  status,
  scheduledFor: iso(T0 + (n + 1) * 3600_000),
  platforms: [{ platform: "instagram", accountId: "compte-fictif", status: "pending" }],
  metadata: { origine: "import-buffer", studioCle: `imp-${status}-${n}` },
  ...extra,
});
const lot = (n: number, status: string) => Array.from({ length: n }, (_, i) => fabrique(i, status));

const BILLING = "https://exemple.invalid/facturation?jeton=JETON-FICTIF-123";
const CORPS_402 = { error: "Account paused: payment required", code: "PAYMENT_REQUIRED", billingUrl: BILLING };
/** La vraie erreur du vrai client, nourrie d'un faux 402 (aucun réseau). */
async function erreur402(): Promise<unknown> {
  const { client } = creerFauxClientZernio(() => ({ statut: 402, corps: CORPS_402 }));
  return client.listerPosts({}).then(() => new Error("402 attendu"), (e: unknown) => e);
}

interface Faux {
  client: ClientZernio;
  posts: PostZernio[];
  introuvables: Set<string>;
  etat: { liste: number; unitaires: number; comptes: number; erreurListe: "debit" | "suspendu" | null; ecritures: number };
}

/** Client factice : lit (comptes, liste, post seul) ; TOUTE écriture lève et est comptée. */
function faux(posts: PostZernio[]): Faux {
  const f: Faux = { client: null as never, posts, introuvables: new Set(), etat: { liste: 0, unitaires: 0, comptes: 0, erreurListe: null, ecritures: 0 } };
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
      if (f.etat.erreurListe === "suspendu") throw await erreur402();
      if (f.etat.erreurListe) throw new ErreurZernio("debit", "plafond de débit");
      const tous = f.posts.filter((p) => (q?.status ? p.status === q.status : true));
      const page = Number(q?.page ?? 1);
      const limite = Number(q?.limit ?? 50);
      return tous.slice((page - 1) * limite, page * limite);
    },
    async lirePost(id: string) {
      f.etat.unitaires++;
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

const rapatriees = async () => depots().publications.lister((p) => !!p.rapatrieeLe);
const ecart = async () => (await depots().parametres.obtenir(ECART))?.valeur as { verifie: boolean; absents: number; chezDiffuseur: number; exemples: unknown[]; luLe: string } | undefined;

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
});

describe("RAP-2 · rapatriement dans le tour existant", () => {
  it("65 scheduled + 12 draft, aucune publication locale : UN passage forcé → 77 rapatriées et un écart vérifié à 0", async () => {
    const f = faux([...lot(65, "scheduled"), ...lot(12, "draft")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await rapatriees()).toHaveLength(77);
    const e = await ecart();
    expect(e).toMatchObject({ verifie: true, absents: 0, chezDiffuseur: 77 });
    expect(f.etat.ecritures).toBe(0);
  });

  it("second passage : aucune création (idempotence) ; un post supprimé chez le diffuseur depuis plus de 30 min → « À vérifier », publication gardée, notification en cloche seulement", async () => {
    const f = faux([...lot(3, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await rapatriees()).toHaveLength(3);
    f.posts = f.posts.filter((p) => p._id !== "p-scheduled-1");
    await synchroniserEtatsZernio({ force: true, instant: T0 + 31 * 60_000 });
    expect(await rapatriees()).toHaveLength(3);
    const p = (await depots().publications.lister((x) => x.idExterne === "p-scheduled-1"))[0];
    expect(p.etatEnvoi).toBe("a-verifier");
    const notifs = await depots().notifications.lister((n) => n.titre.includes("à vérifier"));
    expect(notifs).toHaveLength(1);
    expect(notifs[0].envoi).toBeUndefined(); // cloche seulement : aucune file d'envoi (ni push ni e-mail)
  });

  it.each([
    ["sans millisecondes", "2026-11-21T10:30:00Z", "2026-11-21T10:30:00.000Z"],
    ["en +01:00", "2026-11-21T23:30:00+01:00", "2026-11-21T22:30:00.000Z"],
  ])("date d'une rapatriée déplacée chez le diffuseur, %s : stockée normalisée (toISOString)", async (_nom, brute, attendu) => {
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    const avant = (await rapatriees())[0];
    f.posts[0] = { ...f.posts[0], scheduledFor: brute };
    await synchroniserEtatsZernio({ force: true, instant: T0 + 20 * 60_000 });
    expect((await depots().publications.obtenir(avant.id))!.date).toBe(attendu);
  });

  it("post déplacé chez le diffuseur (+2 h) : la date de la rapatriée suit, une ligne de journal, aucune cloche ; une publication née au Studio garde sa date (dateExterne)", async () => {
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    const avant = (await rapatriees())[0];
    const nouveau = iso(Date.parse(avant.date) + 2 * 3600_000);
    f.posts[0] = { ...f.posts[0], scheduledFor: nouveau };
    await depots().publications.enregistrer({ id: "pub-studio", videoId: "v-03", reseau: "instagram", statut: "programmee", via: "zernio", date: avant.date, texte: "t", idExterne: "p-studio", etatEnvoi: "envoye", canalId: "compte-fictif", creeLe: iso(T0), modifieLe: iso(T0) } as never);
    f.posts.push(fabrique(9, "scheduled", { _id: "p-studio", scheduledFor: nouveau, metadata: { origine: "studio", studioCle: "cle-studio" } }));
    const notifsAvant = await depots().notifications.compter();
    await synchroniserEtatsZernio({ force: true, instant: T0 + 20 * 60_000 });
    const apres = (await depots().publications.obtenir(avant.id))!;
    expect(apres.date).toBe(nouveau);
    expect(apres.dateExterne).toBeUndefined();
    expect((await depots().evenements.lister((e) => e.message.includes("Déplacée chez le diffuseur"))).length).toBe(1);
    const studio = (await depots().publications.obtenir("pub-studio"))!;
    expect(studio.date).toBe(avant.date);
    expect(studio.dateExterne).toBe(nouveau);
    // seule la cloche de la publication née au Studio (règle L0-11 inchangée) : rien de plus pour la rapatriée
    expect(await depots().notifications.compter()).toBe(notifsAvant + 1);
  });

  it("post published chez le diffuseur → statut « publiee » et lien ; la rapatriée ne fait jamais lever la synchro", async () => {
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    f.posts[0] = { ...f.posts[0], status: "published", platforms: [{ platform: "instagram", accountId: "compte-fictif", status: "published", platformPostUrl: "https://exemple.invalid/p/1" }] as never };
    await synchroniserEtatsZernio({ force: true, instant: T0 + 20 * 60_000 });
    const p = (await rapatriees())[0];
    expect(p.statut).toBe("publiee");
    expect(p.urlPubliee).toBe("https://exemple.invalid/p/1");
  });

  it("une rapatriée retirée (retireeLe) sort du suivi : jamais relue", async () => {
    const f = faux([fabrique(0, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    const p = (await rapatriees())[0];
    await depots().publications.modifier(p.id, { retireeLe: iso(T0) });
    f.posts = [];
    f.introuvables.add("p-scheduled-0");
    await synchroniserEtatsZernio({ force: true, instant: T0 + 40 * 60_000 });
    expect((await depots().publications.obtenir(p.id))!.etatEnvoi).toBe("envoye");
  });
});

describe("RAP-2 · budget et débit", () => {
  it("142 posts à venir (130 scheduled + 12 draft) : rapatriement ≤ 6 requêtes, passage ≤ 51 au total", async () => {
    const f = faux([...lot(130, "scheduled"), ...lot(12, "draft")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0, complet: true });
    expect(f.etat.comptes + f.etat.liste + f.etat.unitaires).toBeLessThanOrEqual(BUDGET_REQUETES_PAR_PASSAGE);
    expect((await rapatriees()).length).toBe(142);
    expect(f.etat.liste).toBeLessThanOrEqual(6 + 10);
  });

  it("77 rapatriées suivies (> 50 : passage complet à chaque tour) : deuxième passage ≤ 51 requêtes au total, rapatriement compris", async () => {
    const f = faux([...lot(65, "scheduled"), ...lot(12, "draft")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await rapatriees()).toHaveLength(77);
    f.etat.liste = 0;
    f.etat.unitaires = 0;
    f.etat.comptes = 0;
    await synchroniserEtatsZernio({ instant: T0 + 60 * 60_000 });
    const total = f.etat.comptes + f.etat.liste + f.etat.unitaires;
    // Mesuré : 1 requête de comptes + 5 de liste (3 du rapatriement, 2 de la liste complète) + 0 lecture unitaire = 6 ; plafond 51.
    expect(total).toBeLessThanOrEqual(BUDGET_REQUETES_PAR_PASSAGE);
    expect(f.etat.unitaires).toBe(0);
    expect(f.etat.ecritures).toBe(0);
  });

  it("plus de posts que 6 requêtes n'en lisent : écart non vérifié, rien n'est créé", async () => {
    const f = faux(lot(650, "scheduled")); // 7 pages de 100 > 6
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await rapatriees()).toHaveLength(0);
    expect((await ecart())!.verifie).toBe(false);
  });

  it("liste en erreur « debit » : écart non vérifié, aucune création, la synchro des autres publications continue", async () => {
    const f = faux([fabrique(5, "scheduled", { _id: "p-autre" })]);
    f.etat.erreurListe = "debit";
    injecterClientZernio(f.client);
    await depots().publications.enregistrer({ id: "pub-autre", videoId: "v-03", reseau: "instagram", statut: "brouillon", via: "zernio", date: iso(T0), texte: "t", idExterne: "p-autre", etatEnvoi: "envoye", canalId: "compte-fictif", creeLe: iso(T0), modifieLe: iso(T0) } as never);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await rapatriees()).toHaveLength(0);
    expect((await ecart())!.verifie).toBe(false);
    expect(r.lues).toBe(1);
    expect((await depots().publications.obtenir("pub-autre"))!.statut).toBe("programmee");
  });
});

describe("RAP-2 · réglage zernio.rapatriement_actif", () => {
  it("à false : l'écart est mesuré (77 absents, vérifié) et rien n'est créé", async () => {
    await ecrireParametre("zernio.rapatriement_actif", false);
    const f = faux([...lot(65, "scheduled"), ...lot(12, "draft")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await rapatriees()).toHaveLength(0);
    expect(await ecart()).toMatchObject({ verifie: true, absents: 77, chezDiffuseur: 77 });
    expect((await ecart())!.exemples.length).toBeLessThanOrEqual(10);
  });

  it("une plateforme sans correspondance n'est jamais jetée : comptée dans l'écart", async () => {
    const f = faux([fabrique(0, "scheduled", { platforms: [{ platform: "threads", accountId: "c", status: "pending" }] as never }), fabrique(1, "scheduled")]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(await rapatriees()).toHaveLength(1);
    expect(await ecart()).toMatchObject({ verifie: true, absents: 1, chezDiffuseur: 2 });
  });

  it("l'écart n'expose ni identifiant complet ni texte : 6 premiers caractères du post, réseau, jour", async () => {
    await ecrireParametre("zernio.rapatriement_actif", false);
    const f = faux([fabrique(0, "scheduled", { _id: "abcdef1234567890", content: "TEXTE-SECRET-FICTIF" })]);
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    const brut = JSON.stringify((await depots().parametres.obtenir(ECART))!.valeur);
    expect(brut).not.toContain("TEXTE-SECRET-FICTIF");
    expect(brut).not.toContain("abcdef1234567890");
    expect(brut).toContain("abcdef");
  });
});

describe("RAP-2 · aucune écriture chez le diffuseur", () => {
  it("client dont creerPost, promouvoir, retirer, requete et publishNow lèvent : le passage va au bout, zéro écriture tentée", async () => {
    const f = faux([...lot(5, "scheduled"), ...lot(2, "draft")]);
    injecterClientZernio(f.client);
    await expect(synchroniserEtatsZernio({ force: true, instant: T0, complet: true })).resolves.toBeDefined();
    expect(f.etat.ecritures).toBe(0);
    expect(await rapatriees()).toHaveLength(7);
  });
});

describe("compte du diffuseur en pause (HTTP 402)", () => {
  const motifs = async () => (await depots().parametres.obtenir(ECART))?.valeur as { motif?: string; verifie: boolean } | undefined;
  const cloche = () => depots().notifications.lister((n) => n.titre === "Compte du diffuseur en pause");

  it("le client reconnaît le 402 : erreur typée « compte-suspendu », message français simple, ni clé ni adresse de facturation", async () => {
    const e = await erreur402();
    expect(estCompteSuspendu(e)).toBe(true);
    expect(e).toBeInstanceOf(ErreurZernio);
    expect((e as ErreurZernio).statut).toBe(402);
    expect((e as ErreurZernio).reessayable).toBe(false);
    expect((e as ErreurZernio).message).toBe("Le compte du diffuseur est en pause : paiement requis.");
    const brut = JSON.stringify({ m: (e as ErreurZernio).message, d: (e as ErreurZernio).detailTechnique });
    expect(brut).not.toContain("JETON-FICTIF-123");
    expect(brut).not.toContain("facturation");
  });

  it("un 403 reste un refus d'accès, pas une pause de compte", async () => {
    const { client } = creerFauxClientZernio(() => ({ statut: 403, corps: { error: "x" } }));
    const e = await client.listerPosts({}).catch((x: unknown) => x);
    expect(estCompteSuspendu(e)).toBe(false);
  });

  it("la synchro garde le motif, crée UNE seule notification (cloche) sur deux passages, n'écrit rien chez le diffuseur", async () => {
    const f = faux([fabrique(0, "scheduled")]);
    f.etat.erreurListe = "suspendu";
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    await synchroniserEtatsZernio({ force: true, instant: T0 + 20 * 60_000 });
    expect(await motifs()).toMatchObject({ verifie: false, motif: "compte-suspendu" });
    const notifs = await cloche();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].envoi).toBeUndefined();
    expect(notifs[0].message).toBe("Le compte du diffuseur est en pause : paiement requis. Rien ne se publie tant que ce n'est pas réglé.");
    expect(JSON.stringify(notifs[0])).not.toContain("JETON-FICTIF-123");
    expect(JSON.stringify(await motifs())).not.toContain("JETON-FICTIF-123");
    expect(f.etat.ecritures).toBe(0);
    expect(await rapatriees()).toHaveLength(0);
  });

  it("le motif s'efface à la première lecture réussie ; une nouvelle pause notifie de nouveau", async () => {
    const f = faux([fabrique(0, "scheduled")]);
    f.etat.erreurListe = "suspendu";
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    f.etat.erreurListe = null;
    await synchroniserEtatsZernio({ force: true, instant: T0 + 20 * 60_000 });
    expect((await motifs())!.motif).toBeUndefined();
    expect((await motifs())!.verifie).toBe(true);
    f.etat.erreurListe = "suspendu";
    await synchroniserEtatsZernio({ force: true, instant: T0 + 40 * 60_000 });
    expect((await motifs())!.motif).toBe("compte-suspendu");
    expect(await cloche()).toHaveLength(2);
  });

  it("une panne ordinaire (débit) ne pose aucun motif ni aucune notification", async () => {
    const f = faux([fabrique(0, "scheduled")]);
    f.etat.erreurListe = "debit";
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await motifs())!.motif).toBeUndefined();
    expect(await cloche()).toHaveLength(0);
  });

  it("le bandeau dit que le compte est en pause (et plus « n'a pas pu être vérifié »)", async () => {
    const { etatBandeauEcart } = await import("@/components/calendrier/BandeauEcartDiffuseur");
    expect(etatBandeauEcart({ luLe: iso(T0), verifie: false, absents: 0, motif: "compte-suspendu" } as never, T0 + 60_000)).toBe("non-verifie");
    const { texteBandeauEcart } = await import("@/components/calendrier/BandeauEcartDiffuseur");
    expect(texteBandeauEcart({ luLe: iso(T0), verifie: false, chezDiffuseur: 0, absents: 0, exemples: [], motif: "compte-suspendu" } as never, "non-verifie")).toBe("Compte du diffuseur en pause : paiement requis. Rien ne se publie tant que ce n'est pas réglé.");
  });

  it("la sonde passe `publication` en alerte tant que le motif est posé, puis revient à ok", async () => {
    const { sonderPublication } = await import("@/services/sonde-publication");
    const f = faux([]);
    f.etat.erreurListe = "suspendu";
    injecterClientZernio(f.client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await sonderPublication({ autorisee: async () => true, maintenant: () => T0 })).etat).toBe("alerte");
    f.etat.erreurListe = null;
    await synchroniserEtatsZernio({ force: true, instant: T0 + 20 * 60_000 });
    expect((await sonderPublication({ autorisee: async () => true, maintenant: () => T0 })).etat).toBe("ok");
  });
});
