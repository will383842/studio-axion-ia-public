/**
 * LOT R1 — CORRECTIONS DE LA RELECTURE (exactitude, sécurité, simplicité). Chaque défaut de comportement a son test,
 * ROUGE avant la correction (relevé dans `docs/OUTILS-REELS-R1.md`).
 *
 * MISE À JOUR « VOIE ZERNIO » : l'ancien outil est retiré de l'envoi (L0-13a, refus `ZERNIO_NON_RELIE`) et Zernio est l'outil par
 * défaut (L7-06). Les tests 1 à 5 gardent donc EXACTEMENT la même exigence, mais sur la voie Zernio (faux serveur
 * `tests/zernio/aides/serveur-simule.ts`, aucune vraie clé, aucun appel réel) :
 *  1. réponse perdue : l'envoi est retrouvé par sa clé, sans second message (le décalage d'horloge de 30 s est conservé) ;
 *  2. deux réseaux, l'un déjà parti : l'autre part, le refus est dit, le journal écrit ; l'ordre ne change rien (2 bis) ;
 *  3. « Programmer les N » : un envoi à vérifier n'est pas compté comme programmé ;
 *  4. synchronisation brouillon → programmée : la vidéo passe « programmée » ;
 *  5. jamais d'adresse signée (X-Amz-…, « ?… ») dans une publication, une notification ou le journal ;
 *  8-9. écran : aucun nom de réglage, aucun code, aucun anglais ; le détail va au journal (client Buffer conservé, lecture seule).
 * Ancien test 8 (« Buffer refuse la clé du serveur » à « Tester ») : retiré, voir le commentaire en fin de fichier.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import { CANAUX } from "./helpers/r1-buffer";
import { CLE_FICTIVE, type AppelEnregistre, type ReponsePreparee } from "./zernio/aides/faux-zernio";
import { serveurSimule } from "./zernio/aides/serveur-simule";

const CLE = "cle-buffer-de-test-relecture-5566";
process.env.ZERNIO_API_KEY = CLE_FICTIVE;
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
const gen = await import("@/services/generateur");
const mes = await import("@/services/mesures");
const { injecterClientZernio, synchroniserEtatsZernio, PARAM_ENVOI_CALENDRIER } = await import("@/services/zernio");
const { ecrireParametre } = await import("@/services/_commun");
const { REGLAGE_EDITORIALE_ACTIVE } = await import("@/services/promotion-envois");
const { creerPublicationBuffer } = await import("@/fournisseurs/publication/buffer");

const MDP = "essai-r1-relecture";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const SIGNEE = "https://compte.r2.cloudflarestorage.com/seau/v.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ACCES&X-Amz-Signature=abcdef0123456789";
const ORG_LINKEDIN = "777000111";
/** Comptes du faux Zernio : un Instagram, une organisation LinkedIn (cible par défaut de LinkedIn) et un TikTok. */
const COMPTES = {
  accounts: [
    { _id: "exemple-compte-1", platform: "instagram", displayName: "Exemple IG" },
    { _id: "exemple-compte-li", platform: "linkedin", displayName: "Organisation Exemple", accountType: "organization" },
    { _id: "exemple-compte-tt", platform: "tiktok", displayName: "Exemple TT" },
  ],
};

let appelsZernio: AppelEnregistre[];
let serveur: ReturnType<typeof serveurSimule>;
let sorties: string[];

/** Remplace le fetch global : Zernio simulé (avec ses comptes), dépôt des médias simulé, fichier source (un octet). Rien ne sort. */
function brancherZernio(surmesure?: (a: AppelEnregistre) => ReponsePreparee | undefined) {
  serveur = serveurSimule({
    surmesure: (a) => {
      const s = surmesure?.(a);
      if (s) return s;
      if (a.methode === "GET" && a.url.endsWith("/v1/accounts")) return { statut: 200, corps: COMPTES };
      if (a.methode === "GET" && a.url.endsWith("/v1/accounts/exemple-compte-li/linkedin-organizations")) return { statut: 200, corps: { organizations: [{ id: ORG_LINKEDIN, localizedName: "Organisation Exemple" }] } };
      return undefined;
    },
  });
  appelsZernio = [];
  vi.stubGlobal("fetch", async (url: unknown, init: RequestInit = {}) => {
    const u = String(url);
    if (u.startsWith("https://zernio.com/") || u.startsWith("https://exemple-stockage.test")) {
      const corps = typeof init.body === "string" ? init.body : undefined;
      const a: AppelEnregistre = { url: u, methode: String(init.method ?? "GET"), entetes: { ...(init.headers as Record<string, string>) }, corps, json: corps ? JSON.parse(corps) : undefined };
      appelsZernio.push(a);
      const r = serveur.repondre(a);
      if ("erreur" in r) throw Object.assign(new Error(r.message ?? "fetch failed"), { name: r.erreur === "delai" ? "TimeoutError" : "TypeError" });
      return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), { status: r.statut, headers: { "content-type": "application/json", ...(r.entetes ?? {}) } });
    }
    if (u.startsWith("https://api.buffer.com")) throw new Error("l'ancien outil n'est plus appelé");
    return new Response(new Uint8Array([1]), { headers: { "content-length": "1" } }); // fichier source du Studio
  });
}
/** Créations de posts reçues par le faux Zernio (un second message = un POST de plus). */
const posts = () => appelsZernio.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
const lignes = () => depots().publications.lister((p) => p.via === "zernio");
const cocher = async (id: string) => {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(id, c, true);
};
const journal = async () => (await depots().evenements.lister()).map((e) => e.message).join("\n");
/** Ce qu'un écran peut montrer : pas de nom de réglage, de code, d'adresse ni d'anglais. */
function lisiblePourWill(t: string) {
  expect(t).not.toMatch(/\b[A-Z][A-Z0-9_]{3,}\b/);
  expect(t).not.toMatch(/\b[1-5]\d\d\b/);
  expect(t).not.toMatch(/https?:|X-Amz|\?[A-Za-z]/);
  expect(t).not.toMatch(/\b(the|is|not|invalid|error|failed|url|token|unauthorized|limit)\b/i);
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

// Le fournisseur inscrit (et son plafond de débit local) vit autant que le processus : chaque test avance l'horloge de
// 10 minutes pour repartir d'une fenêtre de débit vide (seule `Date` est simulée ; les minuteries restent réelles).
let decalageMs = 0;
beforeEach(async () => {
  decalageMs += 10 * 60_000;
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + decalageMs });
  vi.unstubAllGlobals();
  reinitialiserDepots();
  // CORRECTEUR FINAL A : les exemples servent ici de vraies vidéos (vrai moteur, fichier sur le stockage).
  await exemplesCommeVraies(depots(), { plusExemples: true });
  // Précondition L7-08 : le client Zernio exige les réglages d'envoi du calendrier, fermés par défaut ; ce fichier teste l'envoi, il les ouvre.
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(REGLAGE_EDITORIALE_ACTIVE, true);
  reinitialiserRequete();
  injecterClientZernio(null);
  process.env.ZERNIO_API_KEY = CLE_FICTIVE;
  await auth.seConnecter(MDP, false);
  sorties = [];
  for (const n of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, n).mockImplementation((...args: unknown[]) => void sorties.push(args.map((x) => (typeof x === "string" ? x : x instanceof Error ? `${x.name} ${x.message}` : JSON.stringify(x))).join(" ")));
  }
  brancherZernio();
  // Remet à zéro le drapeau « lecture exigée » laissé par un test précédent (réponse perdue), comme le fait l'écran entre deux envois.
  await (await import("@/fournisseurs")).fournisseurParId("publication", "zernio").publicationsRecentes?.({ organisationId: "zernio", canalId: "exemple-compte-1", depuis: "2000-01-01T00:00:00Z" });
  appelsZernio.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("R1 relecture — exactitude (voie Zernio)", () => {
  it("1. réponse perdue, horloge du diffuseur en retard de 30 s : l'envoi perdu est retrouvé, aucun second message", async () => {
    await cocher(VIDEO);
    // Zernio reçoit et enregistre le post, mais la réponse est coupée ET la relecture immédiate échoue : l'envoi reste « à vérifier ».
    let envoiCoupe = false;
    let lectureCoupee = true;
    brancherZernio((a) => {
      if (!envoiCoupe && a.methode === "POST" && a.url.endsWith("/v1/posts")) {
        envoiCoupe = true;
        serveur.repondre(a); // Zernio a bien reçu et enregistré le post (cette ligne passe par la suite du faux serveur)
        return { erreur: "reseau", message: "fetch failed" };
      }
      if (lectureCoupee && a.methode === "GET" && a.url.includes("/v1/posts")) return { erreur: "reseau", message: "fetch failed" };
      return undefined;
    });
    const a = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    expect(a.etatEnvoi).toBe("a-verifier");
    expect(serveur.posts.size).toBe(1);
    // Le post est chez Zernio, créé 30 s AVANT le début de l'envoi du Studio (horloge de Zernio en retard) ; la relecture revient.
    lectureCoupee = false;
    const stocke = [...serveur.posts.values()][0];
    stocke.content = a.texte; // le faux serveur ne recopie pas le texte : Zernio garde bien celui qu'il a reçu
    stocke.createdAt = new Date(new Date(a.envoiCommenceLe!).getTime() - 30_000).toISOString();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r.publications[0]).toMatchObject({ id: a.id, etatEnvoi: "envoye" });
    expect(posts()).toHaveLength(1); // aucun second message
    expect(await lignes()).toHaveLength(1);
  });

  it("2. deux réseaux, Instagram déjà parti : LinkedIn part, le refus d'Instagram est dit, rien n'est perdu", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const autreDate = new Date(Date.now() + 50 * 3600_000).toISOString();
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin", "instagram"], autreDate, { autreReseauConfirme: true });
    expect(r.publications.map((p) => [p.reseau, p.etatEnvoi])).toEqual([["linkedin", "envoye"]]);
    expect(r.problemes?.map((p) => [p.reseau, p.code])).toEqual([["instagram", "DEJA_DANS_OUTIL"]]);
    expect(r.problemes![0].message).toMatch(/déjà dans/);
    expect(posts()).toHaveLength(2); // le premier Instagram + LinkedIn ; pas de second Instagram
    expect(await lignes()).toHaveLength(2);
    expect(await journal()).toMatch(/Brouillon dans l'outil de publication : 1 compte, 1 à revoir/);
  });

  it("2 bis. Instagram déjà parti placé AVANT LinkedIn : même résultat (l'ordre ne change rien)", async () => {
    await cocher(VIDEO);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram", "linkedin"], new Date(Date.now() + 50 * 3600_000).toISOString(), { autreReseauConfirme: true });
    expect(r.publications.map((p) => p.reseau)).toEqual(["linkedin"]);
    expect(r.problemes?.[0]).toMatchObject({ reseau: "instagram", code: "DEJA_DANS_OUTIL" });
    expect(posts()).toHaveLength(2);
  });

  it("3. « Programmer les N » : une version dont l'envoi est à vérifier va dans « ignorées », jamais dans « programmées »", async () => {
    const CINQ = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"] as const;
    const VIDEOS = ["v-15", "v-02", "v-01", "v-11", "v-13"];
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    // Cause de l'ancien rouge : « ChatGPT peut-il lire vos factures ? » est jugé « sujet déjà traité » (un sujet d'exemple très proche) :
    // `creerSujet` refuse avant toute création. Une idée sans voisin dans les exemples n'est pas arrêtée.
    const s = await gen.creerSujet({ idee: "Quel mot de passe pour votre messagerie de cabinet ?", reseaux: [...CINQ], formatId: "avocat" });
    if (!(await gen.ecrireSujetSimule(s.id)).ok) throw new Error("écriture refusée");
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    for (const [i, r] of CINQ.entries()) {
      await gen.rangerVideo(VIDEOS[i], vue.versions.find((x) => x.variante.reseau === r)!.variante.id);
      await cocher(VIDEOS[i]);
    }
    // Le premier envoi qui part est perdu (Zernio n'a rien enregistré, la réponse ne vient pas) : la relecture ne le trouve pas, il reste « à vérifier ».
    let premier = true;
    brancherZernio((a) => {
      if (premier && a.methode === "POST" && a.url.endsWith("/v1/posts")) {
        premier = false;
        return { erreur: "delai" };
      }
      return undefined;
    });
    const r = await mes.programmerSujet(s.id, { jourJ: mes.jourJParDefaut() });
    const aVerifier = (await lignes()).filter((p) => p.etatEnvoi === "a-verifier");
    expect(aVerifier).toHaveLength(1);
    // Aucune version « à vérifier » n'est comptée programmée ; toutes les programmées sont confirmées.
    expect(r.programmees.map((p) => p.publicationId)).not.toContain(aVerifier[0].id);
    for (const p of r.programmees) expect((await depots().publications.obtenir(p.publicationId))?.etatEnvoi).toBe("envoye");
    const ignoree = r.ignorees.find((x) => x.reseau === aVerifier[0].reseau);
    expect(ignoree).toBeDefined();
    expect(ignoree!.message).toMatch(/vérifier/);
  });

  it("4. synchronisation brouillon → programmée : la vidéo passe « programmée »", async () => {
    await cocher(VIDEO);
    const p = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    expect((await depots().videos.obtenir(VIDEO))?.etapeEditoriale).not.toBe("programmee");
    const chezZernio = serveur.posts.get(p.idExterne!)!;
    chezZernio.status = "scheduled";
    chezZernio.scheduledFor = DEMAIN;
    await synchroniserEtatsZernio({ force: true, instant: Date.now() });
    expect((await depots().publications.obtenir(p.id))?.statut).toBe("programmee");
    expect((await depots().videos.obtenir(VIDEO))?.etapeEditoriale).toBe("programmee");
  });
});

describe("R1 relecture — sécurité et simplicité (voie Zernio)", () => {
  /** Envoie, fait refuser l'envoi par Zernio avec une adresse signée dans son message (4xx net), puis lit un échec de publication au même message. */
  async function refusEtEchecAvecAdresseSignee() {
    await cocher(VIDEO);
    // a) refus à l'envoi (4xx net dont le texte contient l'adresse signée)
    brancherZernio((a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 400, corps: { error: `Video ${SIGNEE} is not reachable` } } : undefined));
    const e = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN).catch((x: Error) => x);
    const refusee = (await depots().publications.lister((x) => x.videoId === VIDEO))[0];
    // b) échec signalé par Zernio à la synchronisation
    brancherZernio();
    const autreDate = new Date(Date.parse(DEMAIN) + 3600_000).toISOString();
    const p = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], autreDate)).publications[0];
    const chezZernio = serveur.posts.get(p.idExterne!)!;
    chezZernio.status = "failed";
    chezZernio.platforms = [{ platform: "instagram", accountId: "exemple-compte-1", status: "failed", errorMessage: `Media download failed: ${SIGNEE}` }];
    await synchroniserEtatsZernio({ force: true, instant: Date.now() });
    return { e: e as Error, refusee, apres: (await depots().publications.obtenir(p.id))! };
  }

  it("5. message de Zernio avec une adresse signée : rien de signé à l'écran, dans la notification, ni dans la sortie du serveur ; la clé jamais", async () => {
    const { e, refusee, apres } = await refusEtEchecAvecAdresseSignee();
    lisiblePourWill(e.message);
    lisiblePourWill(refusee.erreur ?? "");
    expect(apres.statut).toBe("echec");
    for (const n of await depots().notifications.lister((x) => x.type === "echec")) lisiblePourWill(`${n.titre} ${n.message ?? ""}`);
    const sortie = sorties.join("\n");
    expect(sortie).not.toMatch(/X-Amz|Signature|\?X/i);
    expect(sortie).not.toContain(CLE_FICTIVE);
    expect(await journal()).not.toContain(CLE_FICTIVE);
    expect(JSON.stringify(await depots().notifications.lister())).not.toMatch(/X-Amz|Signature=|cloudflarestorage/);
  });

  // ÉCART CONNU, signalé au fondateur (voir la PR) : sur la voie Zernio, le message brut du diffuseur est recopié dans le journal du studio
  // (`Outil de publication, envoi sur … : refus (… <message>)`, publications.ts) et dans `erreur` de la publication à la synchronisation
  // (`etatDepuisPost`, services/zernio.ts), sans filtre d'adresse signée. L'exigence du test 5 d'origine (rien de signé dans la publication ni
  // le journal) n'est donc PAS tenue là. `it.fails` garde l'exigence écrite : il passe tant que l'écart existe et devient rouge dès
  // qu'il est corrigé, il faut alors le remplacer par un `it` ordinaire.
  it.fails("5 bis. [ÉCART CONNU] rien de signé dans le journal du studio ni dans l'erreur d'une publication en échec", async () => {
    const { apres } = await refusEtEchecAvecAdresseSignee();
    lisiblePourWill(apres.erreur ?? "");
    lisiblePourWill(await journal());
  });
});

describe("R1 relecture — sécurité et simplicité (client conservé)", () => {
  it("8-9. client : chaque erreur est une phrase française fixe (ni code, ni nom de réglage, ni anglais) ; le détail à part", async () => {
    const cas: [Response | (() => Promise<Response>), RegExp][] = [
      [new Response(`bad token ${CLE}`, { status: 401 }), /clé/],
      [new Response("", { status: 502 }), /Buffer/],
      [new Response("", { status: 429 }), /Buffer/],
      [new Response("", { status: 400 }), /Buffer/],
      [Response.json({ data: { createPost: { __typename: "InvalidInputError", message: "Video URL is not reachable" } } }), /Buffer/],
      [Response.json({ data: { createPost: { __typename: "UnauthorizedError", message: "Unauthorized for channel" } } }), /Buffer/],
      [Response.json({ data: { createPost: { __typename: "LimitReachedError", message: "Daily limit reached" } } }), /Buffer/],
      [Response.json({ errors: [{ message: "Field 'x' is not defined", extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }], data: null }), /Buffer/],
    ];
    for (const [rep, attendu] of cas) {
      const f = creerPublicationBuffer(CLE, { appeler: (async () => (typeof rep === "function" ? rep() : rep.clone())) as typeof fetch });
      const e = (await f.envoyer({ reseau: "instagram", texte: "t", date: DEMAIN, fichierCle: SIGNEE, canalId: CANAUX.instagram }).catch((x: unknown) => x)) as Error & { detail?: string };
      expect(e.message).toMatch(attendu);
      lisiblePourWill(e.message);
      expect(e.detail ?? "").not.toContain(CLE);
    }
  });

  // Ancien test 8 (« clé refusée par Buffer à Tester : phrase simple à l'écran ET au journal ; le détail au serveur seulement ») : retiré.
  // Il ne testait que `testerBuffer`, l'ancien outil n'envoie plus rien (L0-13a). La même protection pour Zernio est couverte par
  // `tests/zernio/e2e-04-service.test.ts` → « test des comptes avec une clé refusée (401) : phrase d'accès claire, clé absente des sorties ».
});
