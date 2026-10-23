/**
 * LOT R1 — CORRECTIONS DE LA RELECTURE (exactitude, sécurité, simplicité). Chaque défaut de comportement a son test,
 * ROUGE avant la correction (relevé dans `docs/OUTILS-REELS-R1.md`) :
 *  1. horloge de Buffer en retard : l'envoi perdu est quand même retrouvé (marge de 60 s dans la REQUÊTE) ;
 *  2. plusieurs réseaux, l'un déjà dans Buffer : rien n'est perdu, l'autre part, le refus est dit, le journal écrit ;
 *  3. « Programmer les N » : un envoi à vérifier n'est pas compté comme programmé ;
 *  4. synchronisation brouillon → programmée : la vidéo passe « programmée » comme à l'envoi direct ;
 *  5. jamais d'adresse signée (X-Amz-…, « ?… ») dans une publication, une notification ou le journal ;
 *  8-9. écran : aucun nom de réglage, aucun code, aucun anglais ; le détail va au journal.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import { CANAUX, fauxBuffer, type Comportement } from "./helpers/r1-buffer";

const CLE = "cle-buffer-de-test-relecture-5566";
process.env.BUFFER_API_KEY = CLE;
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const buf = await import("@/services/buffer");
const gen = await import("@/services/generateur");
const mes = await import("@/services/mesures");
const { creerPublicationBuffer } = await import("@/fournisseurs/publication/buffer");

const MDP = "essai-r1-relecture";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const SIGNEE = "https://compte.r2.cloudflarestorage.com/seau/v.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ACCES&X-Amz-Signature=abcdef0123456789";
const EN_PLUS = [
  { id: "e00090000000000000000000", name: "Exemple name", displayName: "Exemple TikTok", service: "tiktok", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" },
  { id: "e00091000000000000000000", name: "Exemple name", displayName: "Exemple YouTube", service: "youtube", type: "channel", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" },
];

let buffer: ReturnType<typeof fauxBuffer>;
function brancher(options: Parameters<typeof fauxBuffer>[0] = {}) {
  buffer = fauxBuffer({ canauxEnPlus: EN_PLUS, ...options });
  vi.stubGlobal("fetch", buffer.appeler);
}
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

beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  // CORRECTEUR FINAL A : les exemples servent ici de vraies vidéos (vrai moteur, fichier sur le stockage).
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  brancher();
});

describe("R1 relecture — exactitude", () => {
  it("1. horloge de Buffer en retard de 30 s : l'envoi perdu est retrouvé, aucun second message", async () => {
    brancher({ creation: (n) => (n === 1 ? "coupure-apres" : "ok"), decalageHorlogeMs: -30_000 });
    await cocher(VIDEO);
    const a = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    expect(a.etatEnvoi).toBe("a-verifier");
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r.publications[0]).toMatchObject({ id: a.id, etatEnvoi: "envoye" });
    expect(buffer.mutations()).toHaveLength(1);
  });

  it("2. deux réseaux, Instagram déjà dans Buffer : LinkedIn part, le refus d'Instagram est dit, rien n'est perdu", async () => {
    await cocher(VIDEO);
    await buf.testerBuffer();
    await buf.choisirCanalBuffer("linkedin", CANAUX.linkedinPage);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const autreDate = new Date(Date.now() + 50 * 3600_000).toISOString();
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin", "instagram"], autreDate);
    expect(r.publications.map((p) => [p.reseau, p.etatEnvoi])).toEqual([["linkedin", "envoye"]]);
    expect(r.problemes?.map((p) => p.reseau)).toEqual(["instagram"]);
    expect(buffer.mutations()).toHaveLength(2);
    expect(await journal()).toMatch(/Brouillon dans Buffer : 1 compte, 1 à revoir/);
  });

  it("2 bis. Instagram déjà dans Buffer placé AVANT LinkedIn : même résultat (l'ordre ne change rien)", async () => {
    await cocher(VIDEO);
    await buf.testerBuffer();
    await buf.choisirCanalBuffer("linkedin", CANAUX.linkedinPage);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram", "linkedin"], new Date(Date.now() + 50 * 3600_000).toISOString());
    expect(r.publications.map((p) => p.reseau)).toEqual(["linkedin"]);
    expect(r.problemes?.[0]).toMatchObject({ reseau: "instagram" });
  });

  it("3. « Programmer les N » : une version dont l'envoi est à vérifier va dans « ignorées », jamais dans « programmées »", async () => {
    const CINQ = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"] as const;
    const VIDEOS = ["v-15", "v-02", "v-01", "v-11", "v-13"];
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: [...CINQ], formatId: "avocat" });
    if (!(await gen.ecrireSujetSimule(s.id)).ok) throw new Error("écriture refusée");
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    for (const [i, r] of CINQ.entries()) {
      await gen.rangerVideo(VIDEOS[i], vue.versions.find((x) => x.variante.reseau === r)!.variante.id);
      await cocher(VIDEOS[i]);
    }
    await buf.testerBuffer();
    await buf.choisirCanalBuffer("linkedin", CANAUX.linkedinPage);
    await buf.choisirCanalBuffer("facebook", CANAUX.facebook1);
    brancher({ creation: ((n: number) => (n === 1 ? "coupure-apres" : "ok")) as (n: number) => Comportement });
    const r = await mes.programmerSujet(s.id, { jourJ: mes.jourJParDefaut() });
    expect(buffer.mutations().length).toBeGreaterThan(1);
    expect(r.programmees.length).toBe(buffer.mutations().length - 1);
    expect(r.ignorees.length).toBeGreaterThanOrEqual(1);
    expect(r.ignorees[0].message).toMatch(/vérifier/);
  });

  it("4. synchronisation brouillon → programmée : la vidéo passe « programmée »", async () => {
    await cocher(VIDEO);
    const p = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    expect((await depots().videos.obtenir(VIDEO))?.etapeEditoriale).not.toBe("programmee");
    buffer.changer(p.idExterne!, { status: "scheduled" });
    await buf.synchroniserEtatsBuffer({ force: true });
    expect((await depots().videos.obtenir(VIDEO))?.etapeEditoriale).toBe("programmee");
  });
});

describe("R1 relecture — sécurité et simplicité", () => {
  it("5. message de Buffer avec une adresse signée : rien de signé dans la publication, la notification, le journal", async () => {
    const serveur = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await cocher(VIDEO);
    // a) refus à l'envoi
    brancher({ creation: () => ({ union: "InvalidInputError", message: `Video ${SIGNEE} is not reachable` }) });
    const e = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN).catch((x: Error) => x);
    lisiblePourWill((e as Error).message);
    const refusee = (await depots().publications.lister((x) => x.videoId === VIDEO))[0];
    lisiblePourWill(refusee.erreur ?? "");
    // b) échec signalé par Buffer à la synchronisation
    brancher();
    const p = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    buffer.changer(p.idExterne!, { status: "error", error: { message: `Media download failed: ${SIGNEE}`, supportUrl: null } });
    await buf.synchroniserEtatsBuffer({ force: true });
    lisiblePourWill((await depots().publications.obtenir(p.id))?.erreur ?? "");
    for (const n of await depots().notifications.lister((x) => x.type === "echec")) lisiblePourWill(`${n.titre} ${n.message ?? ""}`);
    const j = await journal();
    lisiblePourWill(j);
    expect(j).not.toContain(CLE);
    // Le détail (sans la partie signée) part au serveur seulement, pour comprendre.
    const sortie = serveur.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(sortie).toMatch(/not reachable/);
    expect(sortie).toMatch(/download failed/);
    expect(sortie).not.toMatch(/X-Amz|Signature|\?X/i);
    expect(sortie).not.toContain(CLE);
    serveur.mockRestore();
  });

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

  it("8. clé refusée par Buffer à « Tester » : phrase simple à l'écran ET au journal du studio ; le détail au serveur seulement", async () => {
    const serveur = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", (async () => new Response("", { status: 401 })) as typeof fetch);
    const e = await buf.testerBuffer().catch((x: Error) => x);
    lisiblePourWill((e as Error).message);
    const j = await journal();
    expect(j).toContain("Buffer refuse la clé du serveur");
    lisiblePourWill(j);
    expect(serveur.mock.calls.map((c) => c.join(" ")).join("\n")).toMatch(/BUFFER_API_KEY refusée \(HTTP 401\)/);
    serveur.mockRestore();
  });
});
