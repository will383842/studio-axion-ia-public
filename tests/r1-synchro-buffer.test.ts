/**
 * LOT R1 — SUIVI DES PUBLICATIONS BUFFER ET « PROGRAMMER LES N » EN RÉEL (aucun réseau : doublure enregistrée).
 *  - synchronisation (boucle, 15 min) : brouillon → programmée → publiée (+ lien, vidéo « publiée ») ; échec → notification ;
 *  - un envoi « à vérifier » que Buffer n'a jamais reçu devient « absent » après 30 min (notification) : l'envoi peut
 *    alors être refait — et seulement alors ;
 *  - « Programmer les N » respecte le mode (brouillons) et ne renvoie jamais une version déjà dans Buffer.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import { fauxBuffer, type Comportement } from "./helpers/r1-buffer";

process.env.BUFFER_API_KEY = "cle-buffer-de-test-synchro-0000";
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

const MDP = "essai-r1-synchro";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
/** TikTok et YouTube relié en plus des 5 comptes enregistrés (pour « Programmer les N » sur 5 réseaux). */
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

describe("R1 — synchronisation des états Buffer", () => {
  it("brouillon → programmée → publiée (lien, vidéo publiée) ; 15 min entre deux lectures ; aucune mutation", async () => {
    await cocher(VIDEO);
    const p = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    const t0 = Date.now();
    buffer.changer(p.idExterne!, { status: "scheduled" });
    expect(await buf.synchroniserEtatsBuffer({ force: true, instant: t0 })).toMatchObject({ changees: 1 });
    expect(await depots().publications.obtenir(p.id)).toMatchObject({ statut: "programmee", date: DEMAIN });

    buffer.changer(p.idExterne!, { status: "sent", sentAt: "2026-10-04T07:00:02.000Z", externalLink: "https://www.instagram.com/reel/exemple/" });
    // Moins de 15 min plus tard : rien n'est relu.
    const lectures = buffer.appels.length;
    expect(await buf.synchroniserEtatsBuffer({ instant: t0 + 5 * 60_000 })).toEqual({ lues: 0, changees: 0 });
    expect(buffer.appels.length).toBe(lectures);
    await buf.synchroniserEtatsBuffer({ instant: t0 + 16 * 60_000 });
    expect(await depots().publications.obtenir(p.id)).toMatchObject({ statut: "publiee", urlPubliee: "https://www.instagram.com/reel/exemple/", date: "2026-10-04T07:00:02.000Z" });
    expect((await depots().videos.obtenir(VIDEO))?.etapeEditoriale).toBe("publiee");
    expect(buffer.mutations()).toHaveLength(1);
  });

  it("échec chez Buffer → « échec » avec la raison, et une notification", async () => {
    const serveur = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await cocher(VIDEO);
    const p = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    buffer.changer(p.idExterne!, { status: "error", error: { message: "Instagram a refusé la vidéo (format).", supportUrl: null } });
    await buf.synchroniserEtatsBuffer({ force: true });
    expect(await depots().publications.obtenir(p.id)).toMatchObject({ statut: "echec", erreur: "Buffer n'a pas pu publier sur Instagram : voyez la raison dans Buffer." });
    // La raison donnée par Buffer part au serveur seulement ; le journal du studio garde la phrase simple.
    expect(serveur.mock.calls.map((c) => c.join(" ")).join("\n")).toContain("Instagram a refusé la vidéo (format).");
    expect((await depots().evenements.lister()).map((e) => e.message)).toContain("Buffer n'a pas pu publier sur Instagram : voyez la raison dans Buffer.");
    serveur.mockRestore();
    const notes = await depots().notifications.lister((n) => n.type === "echec");
    expect(notes.map((n) => n.titre)).toContain("Buffer n'a pas pu publier");
  });

  it("à vérifier : retrouvée par la synchronisation (reliée) — ou absente après 30 min → « absent », notification, renvoi possible", async () => {
    // a) La réponse s'est perdue mais Buffer l'a : la synchronisation la relie.
    brancher({ creation: ((n: number) => (n === 1 ? "coupure-apres" : "ok")) as (n: number) => Comportement });
    await cocher(VIDEO);
    const a = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    expect(a.etatEnvoi).toBe("a-verifier");
    await buf.synchroniserEtatsBuffer({ force: true });
    expect(await depots().publications.obtenir(a.id)).toMatchObject({ etatEnvoi: "envoye", statut: "brouillon" });
    expect(buffer.mutations()).toHaveLength(1);

    // b) Buffer n'a rien reçu : « à vérifier » tant que c'est récent, « absent » après 30 min.
    reinitialiserDepots();
    await exemplesCommeVraies(depots(), { plusExemples: true });
    await auth.seConnecter(MDP, false);
    brancher({ creation: ((n: number) => (n === 1 ? "coupure-avant" : "ok")) as (n: number) => Comportement });
    await cocher(VIDEO);
    const b = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    await buf.synchroniserEtatsBuffer({ force: true, instant: Date.now() + 10 * 60_000 });
    expect((await depots().publications.obtenir(b.id))?.etatEnvoi).toBe("a-verifier");
    await buf.synchroniserEtatsBuffer({ force: true, instant: Date.now() + 31 * 60_000 });
    expect(await depots().publications.obtenir(b.id)).toMatchObject({ etatEnvoi: "absent", statut: "echec" });
    expect((await depots().notifications.lister((n) => n.type === "echec")).map((n) => n.titre)).toContain("Envoi vers Buffer non arrivé");
    expect(buffer.mutations()).toHaveLength(1);
    // Seulement maintenant, Will peut renvoyer : un second message, et un seul.
    const c = (await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).publications[0];
    expect(c).toMatchObject({ etatEnvoi: "envoye", via: "buffer" });
    expect(buffer.mutations()).toHaveLength(2);
    // L'ancienne publication est gardée (jamais effacée), marquée absente.
    expect(await depots().publications.obtenir(b.id)).toMatchObject({ etatEnvoi: "absent" });
  });

  it("en simulation, la synchronisation ne lit rien", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("fournisseur.publication", "simulation");
    expect(await buf.synchroniserEtatsBuffer({ force: true })).toEqual({ lues: 0, changees: 0 });
    expect(buffer.appels).toHaveLength(0);
  });
});

describe("R1 — « Programmer les N » en réel respecte le mode", () => {
  const CINQ = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"] as const;
  const VIDEOS = ["v-15", "v-02", "v-01", "v-11", "v-13"];

  async function sujetPret() {
    await depots().matieres.enregistrer(matiere("Un client m'a envoyé 47 factures en photo un vendredi soir."));
    const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux: [...CINQ], formatId: "avocat" });
    if (!(await gen.ecrireSujetSimule(s.id)).ok) throw new Error("écriture refusée");
    const vue = (await gen.obtenirSujet(s.id))!;
    await gen.validerVersions(vue.versions.map((x) => x.variante.id));
    for (const [i, r] of CINQ.entries()) {
      await gen.rangerVideo(VIDEOS[i], vue.versions.find((x) => x.variante.reseau === r)!.variante.id);
      await cocher(VIDEOS[i]);
    }
    return s.id;
  }

  it("brouillons dans Buffer, un message par version sur SON compte ; un second « Programmer » ne renvoie rien", async () => {
    const id = await sujetPret();
    // Deux LinkedIn chez Buffer : Will a choisi la page.
    await buf.testerBuffer();
    await buf.choisirCanalBuffer("linkedin", "e00007000000000000000000");
    const plan = await mes.planProgrammerSujet(id, { jourJ: "2026-10-12" });
    expect(plan).toMatchObject({ envoiSimule: false, modeBuffer: "brouillon" });
    const r = await mes.programmerSujet(id, { jourJ: "2026-10-12" });
    expect(r).toMatchObject({ simulation: false, modeBuffer: "brouillon" });
    const envoyes = buffer.mutations().map((m) => m.variables.input as { saveToDraft: boolean; channelId: string });
    expect(envoyes.length).toBe(r.programmees.length);
    expect(envoyes.length).toBeGreaterThan(0);
    expect(envoyes.every((x) => x.saveToDraft === true)).toBe(true);
    if (r.programmees.some((x) => x.reseau === "linkedin")) expect(envoyes.map((x) => x.channelId)).toContain("e00007000000000000000000");
    const avant = buffer.mutations().length;
    const encore = await mes.planProgrammerSujet(id, { jourJ: "2026-10-12" });
    expect(encore.creneaux.filter((c) => r.programmees.some((p) => p.code === c.code))).toEqual([]);
    await mes.programmerSujet(id, { jourJ: "2026-10-12" });
    expect(buffer.mutations().length).toBe(avant);
  });
});
