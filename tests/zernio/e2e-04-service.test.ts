/**
 * E2E-4 · chaîne complète du Studio avec Zernio SIMULÉ : écran/service d'envoi → fournisseur inscrit → client à liste fermée
 * → faux serveur (fetch global remplacé). Aucune vraie clé, aucun appel réseau.
 * Couvre : anti-doublon ENTRE outils, rejeu après erreur réseau, « Tout arrêter », erreurs sans fuite de clé, synchro « Publiée ».
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { fauxBuffer } from "../helpers/r1-buffer";
import { CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";
import { serveurSimule } from "./aides/serveur-simule";

process.env.BUFFER_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0501";
process.env.ZERNIO_API_KEY = CLE_FICTIVE;
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const actions = await import("@/app/(studio)/reglages/actions-zernio");
const { injecterClientZernio, synchroniserEtatsZernio } = await import("@/services/zernio");

const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const COMPTES = { accounts: [{ _id: "exemple-compte-1", platform: "instagram", displayName: "Exemple IG" }] };
let buffer: ReturnType<typeof fauxBuffer>;
let appelsZernio: AppelEnregistre[];
let serveur: ReturnType<typeof serveurSimule>;
let sorties: string[];

/** Remplace le fetch global : Buffer simulé, Zernio simulé, média source (R2) et dépôt Zernio simulés. */
function brancherReseauSimule(surmesure?: (a: AppelEnregistre) => ReponsePreparee | undefined) {
  serveur = serveurSimule({
    surmesure: (a) => {
      if (surmesure) {
        const s = surmesure(a);
        if (s) return s;
      }
      if (a.methode === "GET" && a.url.endsWith("/v1/accounts")) return { statut: 200, corps: COMPTES };
      return undefined;
    },
  });
  appelsZernio = [];
  vi.stubGlobal("fetch", async (url: unknown, init: RequestInit = {}) => {
    const u = String(url);
    if (u.startsWith("https://api.buffer.com")) return buffer.appeler(url as never, init as never);
    if (u.startsWith("https://zernio.com/") || u.startsWith("https://exemple-stockage.test")) {
      const corps = typeof init.body === "string" ? init.body : undefined;
      const a: AppelEnregistre = { url: u, methode: String(init.method ?? "GET"), entetes: { ...(init.headers as Record<string, string>) }, corps, json: corps ? JSON.parse(corps) : undefined };
      appelsZernio.push(a);
      const r = serveur.repondre(a);
      if ("erreur" in r) throw Object.assign(new Error(r.message ?? "fetch failed"), { name: r.erreur === "delai" ? "TimeoutError" : "TypeError" });
      return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), { status: r.statut, headers: { "content-type": "application/json", ...(r.entetes ?? {}) } });
    }
    // Média source (vidéo du Studio) : un octet suffit.
    return new Response(new Uint8Array([1]), { headers: { "content-length": "1" } });
  });
}
const posts = () => appelsZernio.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
const toutesLesSorties = () => sorties.join("\n");

beforeAll(async () => {
  await preparerMotDePasse("essai-e2e-service");
});

// Le fournisseur inscrit (et son plafond de débit local) vit autant que le processus : chaque test avance l'horloge de
// 10 minutes pour repartir d'une fenêtre de débit vide (seule `Date` est simulée ; les minuteries restent réelles).
let decalageMs = 0;
beforeEach(async () => {
  decalageMs += 10 * 60_000;
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + decalageMs });
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  injecterClientZernio(null);
  process.env.ZERNIO_API_KEY = CLE_FICTIVE;
  await auth.seConnecter("essai-e2e-service", false);
  buffer = fauxBuffer({});
  sorties = [];
  for (const n of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, n).mockImplementation((...args: unknown[]) => void sorties.push(args.map((x) => (typeof x === "string" ? x : x instanceof Error ? `${x.name} ${x.message} ${x.stack}` : JSON.stringify(x))).join(" ")));
  }
  brancherReseauSimule();
  // Le fournisseur inscrit (et son client) vit autant que le processus : une lecture des posts remet à zéro le drapeau
  // « lecture exigée » laissé par un test précédent (réponse perdue), comme le fait l'écran entre deux envois.
  await (await import("@/fournisseurs")).fournisseurParId("publication", "zernio").publicationsRecentes?.({ canalId: "exemple-compte-1", depuis: "2000-01-01T00:00:00Z" });
  appelsZernio.length = 0;
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const envoyerZernio = (reseau: "instagram" = "instagram") => envoyerParOutilAction(VIDEO, reseau, DEMAIN, { outil: "zernio" });
const lignesZernio = () => depots().publications.lister((p) => p.via === "zernio");

/* ------------------------------------------------------------------ envoi de base */
describe("e2e-4 · envoi Zernio en brouillon par le service", () => {
  it("un envoi Instagram part en BROUILLON : un POST isDraft, statut « brouillon », ni promotion ni publication", async () => {
    const r = await envoyerZernio();
    expect(r).toMatchObject({ ok: true, donnees: { nombre: 1, problemes: [] } });
    expect(posts()).toHaveLength(1);
    expect(posts()[0].json).toMatchObject({ isDraft: true, timezone: "Europe/Paris" });
    expect(posts()[0].corps).not.toMatch(/publishNow/);
    expect(appelsZernio.filter((a) => a.methode === "PUT" && a.url.includes("/v1/posts"))).toHaveLength(0);
    const [ligne] = await lignesZernio();
    expect(ligne).toMatchObject({ via: "zernio", statut: "brouillon", etatEnvoi: "envoye", reseau: "instagram" });
    expect(posts()[0].entetes["Idempotency-Key"]).toBe(`studio-${ligne.cleEnvoi}`);
  });

  it("date passée refusée par le serveur du Studio : aucun appel Zernio", async () => {
    const r = await envoyerParOutilAction(VIDEO, "instagram", new Date(Date.now() - 3600_000).toISOString(), { outil: "zernio" });
    expect(r.ok).toBe(false);
    expect(appelsZernio).toHaveLength(0);
  });

  it("TikTok sans case de consentement cochée : refusé par le serveur avant tout appel", async () => {
    const r = await envoyerParOutilAction(VIDEO, "tiktok", DEMAIN, { outil: "zernio", accordTiktok: false });
    expect(r.ok).toBe(false);
    expect(appelsZernio).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ (3) anti-doublon entre outils */
describe("e2e-4 · anti-doublon entre outils", () => {
  it("déjà envoyé par Buffer : Zernio refuse (phrase claire), Zernio n'est pas appelé", async () => {
    const r1 = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" });
    expect(r1.ok).toBe(true);
    expect(buffer.mutations().length).toBe(1);
    const r2 = await envoyerZernio();
    expect(r2.ok).toBe(false);
    expect(JSON.stringify(r2)).toContain("Déjà envoyée par Buffer pour ce réseau.");
    expect(posts()).toHaveLength(0);
    expect(buffer.mutations().length).toBe(1);
  });

  it("déjà envoyé par Zernio : Buffer refuse, aucune seconde mutation Buffer", async () => {
    expect((await envoyerZernio()).ok).toBe(true);
    const r2 = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" });
    expect(r2.ok).toBe(false);
    expect(JSON.stringify(r2)).toContain("Déjà envoyée par Zernio pour ce réseau.");
    expect(buffer.mutations()).toHaveLength(0);
  });

  it("second clic sur Zernio : un seul post chez Zernio, une seule ligne dans le Studio", async () => {
    await envoyerZernio();
    await envoyerZernio();
    expect(posts()).toHaveLength(1);
    expect(serveur.posts.size).toBe(1);
    expect(await lignesZernio()).toHaveLength(1);
  });

  it("changer de date ne contourne pas le garde : toujours « déjà envoyée »", async () => {
    await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" });
    const autreDate = new Date(Date.parse(DEMAIN) + 24 * 3600_000).toISOString();
    const r = await envoyerParOutilAction(VIDEO, "instagram", autreDate, { outil: "zernio" });
    expect(r.ok).toBe(false);
    expect(posts()).toHaveLength(0);
  });

  it("réponse perdue (coupure réseau) puis relecture : post retrouvé par sa clé, jamais deux posts", async () => {
    let coupe = true;
    brancherReseauSimule((a) => {
      if (coupe && a.methode === "POST" && a.url.endsWith("/v1/posts")) {
        coupe = false;
        serveur.repondre(a); // Zernio a bien reçu et enregistré le post
        return { erreur: "reseau", message: "fetch failed" };
      }
      return undefined;
    });
    const r = await envoyerZernio();
    expect(r.ok).toBe(true);
    expect(serveur.posts.size).toBe(1);
    expect(posts()).toHaveLength(1);
    // Rejeu : même contenu, même compte → aucun nouveau POST.
    await envoyerZernio();
    expect(posts()).toHaveLength(1);
    expect(serveur.posts.size).toBe(1);
    expect(await lignesZernio()).toHaveLength(1);
  });

  it("réponse perdue ET post introuvable : « à vérifier », le rejeu ne renvoie rien", async () => {
    brancherReseauSimule((a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { erreur: "delai" } : undefined));
    const r = await envoyerZernio();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.donnees.problemes.join(" ")).toMatch(/à vérifier/);
    expect((await lignesZernio())[0]).toMatchObject({ etatEnvoi: "a-verifier" });
    const avant = posts().length;
    await envoyerZernio();
    expect(posts().length).toBe(avant);
    // Buffer reste bloqué tant que l'envoi Zernio est « à vérifier ».
    const rb = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" });
    expect(rb.ok).toBe(false);
    expect(buffer.mutations()).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ (4) Tout arrêter */
describe("e2e-4 · « Tout arrêter »", () => {
  it("arrêt actif : aucun POST ni téléversement vers Zernio ; reprise : l'envoi repart", async () => {
    expect((await actions.arreterToutAction()).ok).toBe(true);
    const r = await envoyerZernio();
    // Un seul envoi, refusé : le service rend une phrase neutre en français (jamais le détail du fournisseur).
    expect(r).toMatchObject({ ok: false, message: "L'outil de publication a refusé l'envoi : rien n'est parti." });
    expect(appelsZernio.filter((a) => a.methode !== "GET")).toHaveLength(0);
    expect(serveur.posts.size).toBe(0);
    expect((await lignesZernio())[0]).toMatchObject({ etatEnvoi: "refuse", statut: "echec" });

    // Reprise : un nouvel essai (autre date → nouvelle ligne) part normalement.
    expect((await actions.reprendreToutAction()).ok).toBe(true);
    const autreDate = new Date(Date.parse(DEMAIN) + 3600_000).toISOString();
    const r2 = await envoyerParOutilAction(VIDEO, "instagram", autreDate, { outil: "zernio" });
    expect(r2.ok).toBe(true);
    expect(posts()).toHaveLength(1);
  });

  it("l'arrêt vaut pour tous les réseaux portés par Zernio (Instagram et TikTok)", async () => {
    await actions.arreterToutAction();
    await envoyerZernio();
    await envoyerParOutilAction(VIDEO, "tiktok", DEMAIN, { outil: "zernio", accordTiktok: true });
    expect(appelsZernio.filter((a) => a.methode !== "GET")).toHaveLength(0);
  });

  it("l'arrêt n'affecte pas Buffer (réglage propre à Zernio) : Buffer reste utilisable", async () => {
    await actions.arreterToutAction();
    const r = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" });
    expect(r.ok).toBe(true);
    expect(buffer.mutations()).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ (6) erreurs lisibles, aucune fuite de clé */
describe("e2e-4 · erreurs de bout en bout : français clair, clé jamais visible", () => {
  const scenarios: [string, ReponsePreparee][] = [
    ["401 clé refusée", { statut: 401, corps: { error: `Invalid API key ${CLE_FICTIVE}` } }],
    ["403 accès interdit", { statut: 403, corps: { error: `Forbidden Bearer ${CLE_FICTIVE}` } }],
    ["429 limite", { statut: 429, corps: { error: CLE_FICTIVE }, entetes: { "Retry-After": "1" } }],
    ["500 serveur", { statut: 500, corps: { error: `boom ${CLE_FICTIVE}` } }],
    ["503 serveur", { statut: 503, corps: { error: CLE_FICTIVE } }],
    ["délai dépassé", { erreur: "delai", message: `timeout ${CLE_FICTIVE}` }],
    ["coupure réseau", { erreur: "reseau", message: `ECONNRESET Bearer ${CLE_FICTIVE}` }],
  ];

  it.each(scenarios)("%s : message simple pour l'écran, et la clé fictive n'apparaît dans AUCUNE sortie", async (_nom, reponse) => {
    brancherReseauSimule((a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? reponse : undefined));
    const r = await envoyerZernio();
    // Le Studio rend une phrase française neutre (jamais le texte du fournisseur).
    const message = JSON.stringify(r);
    expect(message).toMatch(/refusé l'envoi : rien n'est parti|à vérifier|n'a pas répondu/);
    expect(message).not.toMatch(/Invalid|Unauthorized|Forbidden|ECONNRESET|boom|timeout/i);
    // Toutes les sorties possibles : réponse de l'action, publications, notifications, journal du Studio, console.
    const d = depots();
    const tout = JSON.stringify([r, await d.publications.lister(), await d.evenements.lister(), await d.notifications.lister()]) + toutesLesSorties();
    expect(tout).not.toContain(CLE_FICTIVE);
    // Aucun corps ni adresse envoyée à Zernio ne contient la clé.
    for (const a of appelsZernio) {
      expect(a.url).not.toContain(CLE_FICTIVE);
      expect(a.corps ?? "").not.toContain(CLE_FICTIVE);
    }
  });

  it("test des comptes avec une clé refusée (401) : phrase d'accès claire, clé absente des sorties", async () => {
    brancherReseauSimule((a) => (a.url.endsWith("/v1/accounts") ? { statut: 401, corps: { error: `Invalid ${CLE_FICTIVE}` } } : undefined));
    const r = await actions.testerComptesZernioAction();
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toMatch(/Vérifiez la clé|refuse l'accès/);
    expect(JSON.stringify([r, await depots().evenements.lister()]) + toutesLesSorties()).not.toContain(CLE_FICTIVE);
  });
});

/* ------------------------------------------------------------------ (9) synchro */
describe("e2e-4 · synchronisation : un post publié chez Zernio passe à « Publiée »", () => {
  it("brouillon envoyé → publié chez Zernio → la publication du Studio devient « publiee » avec son lien", async () => {
    await envoyerZernio();
    const [avant] = await lignesZernio();
    expect(avant.statut).toBe("brouillon");
    // Zernio publie le post.
    const p = serveur.posts.get(avant.idExterne!)!;
    p.status = "published";
    p.platforms = [{ platform: "instagram", accountId: "exemple-compte-1", status: "published", platformPostUrl: "https://exemple.invalid/p/abc", publishedAt: "2026-11-03T10:00:05Z" }];
    const r = await synchroniserEtatsZernio({ force: true, instant: Date.now() });
    expect(r.lues).toBe(1);
    expect(r.changees).toBe(1);
    const [apres] = await lignesZernio();
    expect(apres.statut).toBe("publiee");
    expect(apres.urlPubliee).toBe("https://exemple.invalid/p/abc");
    // La synchro ne fait que LIRE chez Zernio.
    expect(appelsZernio.filter((a) => a.methode !== "GET").every((a) => a === posts()[0] || a.url.includes("presign") || a.url.startsWith("https://exemple-stockage.test"))).toBe(true);
  });

  it("programmé chez Zernio → « programmee » ; échec chez Zernio → « echec » avec la cause", async () => {
    await envoyerZernio();
    const [ligne] = await lignesZernio();
    const p = serveur.posts.get(ligne.idExterne!)!;
    p.status = "scheduled";
    p.scheduledFor = DEMAIN;
    await synchroniserEtatsZernio({ force: true, instant: Date.now() });
    expect((await lignesZernio())[0].statut).toBe("programmee");
    p.status = "failed";
    p.platforms = [{ platform: "instagram", accountId: "exemple-compte-1", status: "failed", errorMessage: "Exemple d'échec" }];
    await synchroniserEtatsZernio({ force: true, instant: Date.now() + 16 * 60_000 });
    expect((await lignesZernio())[0].statut).toBe("echec");
  });

  it("un post Buffer n'est jamais relu chez Zernio, un post Zernio déjà publié ne repasse pas en brouillon", async () => {
    await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" });
    const avant = appelsZernio.length;
    expect((await synchroniserEtatsZernio({ force: true, instant: Date.now() })).lues).toBe(0);
    expect(appelsZernio.length).toBe(avant);
  });

  it("sans clé Zernio : la synchro ne fait rien et ne plante pas", async () => {
    await envoyerZernio();
    delete process.env.ZERNIO_API_KEY;
    expect(await synchroniserEtatsZernio({ force: true, instant: Date.now() })).toEqual({ lues: 0, changees: 0 });
  });
});

// Garde-fou : postExemple reste importé pour les données fictives des scénarios ci-dessus.
void postExemple;
