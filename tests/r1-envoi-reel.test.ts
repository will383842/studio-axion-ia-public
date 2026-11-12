/**
 * LOT R1 — ENVOI RÉEL VERS BUFFER (brouillon d'abord). Tests ROUGES du plan (prouvés sur 03d297b, `docs/OUTILS-REELS-R1.md`) :
 *  1. envoi réel → `via: "buffer"`, statut « brouillon », identifiant Buffer, UNE mutation ;
 *  2. l'adresse de la vidéo donnée à Buffer vit au moins 6 jours (7 jours signés ; C10 : 15 min avant) ;
 *  3. coupure après l'envoi (Buffer a créé, la réponse se perd) → aucune seconde mutation, jamais.
 * Et : deux touchers simultanés → un seul message ; « Avant de publier » garde l'envoi ; un compte manquant ou ambigu
 * arrête AVANT tout envoi ; erreurs claires sans la clé ; mode « Programmer » ; l'affichage n'appelle jamais Buffer.
 *
 * Aucun réseau : `fetch` est remplacé par la doublure `helpers/r1-buffer.ts` (réponses enregistrées). R2 signe en local.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import { CANAUX, fauxBuffer, type Comportement } from "./helpers/r1-buffer";

const CLE = "cle-buffer-de-test-QUI-NE-DOIT-JAMAIS-SORTIR-9f8e";
process.env.BUFFER_API_KEY = CLE;
process.env.FOURNISSEUR_PUBLICATION = "buffer";
// Stockage R2 configuré (signature locale, aucun appel) : l'adresse donnée à Buffer est une adresse signée.
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

const MDP = "essai-r1-envoi";
/** Vidéo prête de la démonstration (selfie, 30 s, 9:16), sans licence bloquante ni publication. */
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();

let buffer: ReturnType<typeof fauxBuffer>;
function brancher(options: Parameters<typeof fauxBuffer>[0] = {}) {
  buffer = fauxBuffer(options);
  vi.stubGlobal("fetch", buffer.appeler);
  return buffer;
}
const suite = (...c: Comportement[]) => (n: number) => c[n - 1] ?? "ok";

async function cocherTout(videoId = VIDEO) {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, c, true);
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

describe("R1 — envoi réel vers Buffer, brouillon d'abord", () => {
  it("ROUGE 1 : envoi réel → brouillon dans Buffer, via buffer, identifiant Buffer, UNE mutation", async () => {
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r.simulation).toBe(false);
    expect(buffer.mutations()).toHaveLength(1);
    const p = r.publications[0];
    expect(p).toMatchObject({ reseau: "instagram", via: "buffer", statut: "brouillon", modeBuffer: "brouillon", canalId: CANAUX.instagram, etatEnvoi: "envoye" });
    expect(p.idExterne).toMatch(/^f1a2b3c4d5e6/);
    // Ce que Buffer a reçu : le BON compte, brouillon, le texte du kit avec ses mots-dièse, une vidéo, Reel Instagram.
    const input = buffer.mutations()[0].variables.input as Record<string, unknown> & { assets: { video: { url: string } }[]; metadata: { instagram: { type: string; shouldShareToFeed: boolean } } };
    expect(input).toMatchObject({ channelId: CANAUX.instagram, saveToDraft: true, schedulingType: "automatic", needsApproval: false });
    expect(input.metadata.instagram).toEqual({ type: "reel", shouldShareToFeed: true });
    const kit = (await pub.obtenirKit(VIDEO))!.reseaux.find((x) => x.reseau === "instagram")!;
    expect(input.text).toBe([kit.texte, kit.motsDiese.join(" ")].filter(Boolean).join("\n\n"));
    expect(input.assets).toHaveLength(1);
    // La clé part dans l'en-tête, et nulle part ailleurs.
    expect(buffer.mutations()[0].autorisation).toBe(`Bearer ${CLE}`);
    expect(JSON.stringify(buffer.mutations()[0].variables)).not.toContain(CLE);
    // Gardée en base comme Buffer l'a dit.
    const enBase = await depots().publications.obtenir(p.id);
    expect(enBase).toMatchObject({ via: "buffer", statut: "brouillon", idExterne: p.idExterne });
  });

  it("ROUGE 2 : l'adresse de la vidéo donnée à Buffer est celle du relais du Studio (https, /video.mp4, jeton de 30 jours, aucune signature R2)", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(buffer.mutations()).toHaveLength(1);
    const adresse = (buffer.mutations()[0].variables.input as { assets: { video: { url: string } }[] }).assets[0].video.url;
    const url = new URL(adresse);
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toMatch(/^\/api\/media-buffer\/[^/]+\/video\.mp4$/);
    expect(adresse).not.toMatch(/X-Amz|r2\.cloudflarestorage/i);
    const { verifierJetonMediaBuffer } = await import("@/lib/jeton-media-buffer");
    const fichierId = verifierJetonMediaBuffer(url.pathname.split("/")[3], Date.now() + 29 * 24 * 3600 * 1000);
    expect(fichierId).toEqual(expect.any(String));
  });

  it("ROUGE 3 : coupure APRÈS l'envoi (Buffer a créé, la réponse se perd) → « à vérifier », puis aucune seconde mutation", async () => {
    brancher({ creation: suite("coupure-apres") });
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(buffer.mutations()).toHaveLength(1);
    const p = r.publications[0];
    expect(p).toMatchObject({ etatEnvoi: "a-verifier", statut: "brouillon" });
    expect(p.idExterne).toBeUndefined();
    // Will retouche « Envoyer » : le studio RELIT Buffer, retrouve le message et le relie, sans rien renvoyer.
    const r2 = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(buffer.mutations()).toHaveLength(1);
    expect(r2.publications[0]).toMatchObject({ id: p.id, etatEnvoi: "envoye", via: "buffer", statut: "brouillon" });
    expect(r2.publications[0].idExterne).toBe([...buffer.posts.keys()][0]);
    // Et encore une fois : toujours un seul message.
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(buffer.mutations()).toHaveLength(1);
    expect(await depots().publications.compter((x) => x.videoId === VIDEO && x.reseau === "instagram" && x.via === "buffer")).toBe(1);
  });

  it("coupure AVANT que Buffer ne reçoive : « à vérifier » ; Buffer relu ne l'a pas → on ne renvoie toujours pas à l'aveugle tant que c'est récent", async () => {
    brancher({ creation: suite("coupure-avant") });
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r.publications[0]).toMatchObject({ etatEnvoi: "a-verifier" });
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    expect(buffer.mutations()).toHaveLength(1);
  });

  it("deux touchers en même temps (deux onglets) → UN seul message dans Buffer", async () => {
    brancher({ delaiMutationMs: 30 });
    await cocherTout();
    const [a, b] = await Promise.allSettled([pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN), pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)]);
    expect(buffer.mutations()).toHaveLength(1);
    expect([a.status, b.status]).toContain("fulfilled");
    expect(await depots().publications.compter((x) => x.videoId === VIDEO && x.reseau === "instagram")).toBe(1);
  });

  it("déjà dans Buffer pour ce réseau (autre date) → refus clair, aucun second message", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const apresDemain = new Date(Date.now() + 50 * 3600_000).toISOString();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], apresDemain)).rejects.toMatchObject({ code: "DEJA_DANS_BUFFER" });
    expect(buffer.mutations()).toHaveLength(1);
  });

  it("« Avant de publier » non coché → refusé, Buffer n'est pas appelé", async () => {
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ code: "AVANT_DE_PUBLIER" });
    expect(buffer.appels).toHaveLength(0);
  });

  it("compte manquant (TikTok) ou ambigu (deux LinkedIn) → message clair AVANT tout envoi ; le choix de Will lève l'ambiguïté", async () => {
    await cocherTout();
    await expect(pub.envoyerVersBuffer(VIDEO, ["tiktok"], DEMAIN)).rejects.toThrow(/TikTok/);
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN)).rejects.toThrow(/LinkedIn/);
    expect(buffer.mutations()).toHaveLength(0);
    const { choisirCanalBuffer } = await import("@/services/buffer");
    await choisirCanalBuffer("linkedin", CANAUX.linkedinPage);
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN);
    expect(r.publications[0]).toMatchObject({ canalId: CANAUX.linkedinPage, via: "buffer" });
  });

  it("Buffer refuse (union typée, 401) → message clair SANS la clé, publication en échec, jamais « via buffer » réussie", async () => {
    brancher({ creation: suite({ union: "InvalidInputError", message: `Video URL is not reachable (token ${CLE})` }) });
    await cocherTout();
    const e = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN).catch((x: Error) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toMatch(/Buffer/);
    expect((e as Error).message).not.toContain(CLE);
    const p = (await depots().publications.lister((x) => x.videoId === VIDEO))[0];
    expect(p).toMatchObject({ statut: "echec", etatEnvoi: "refuse" });
    expect(p.idExterne).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain(CLE);

    brancher({ creation: suite({ http: 401, corps: `{"error":"bad token ${CLE}"}` }) });
    const e2 = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN).catch((x: Error) => x);
    expect((e2 as Error).message).toMatch(/clé/);
    expect((e2 as Error).message).not.toContain(CLE);
  });

  it("mode « Programmer » (choix de Will) → la date part, statut programmée", async () => {
    const { definirModeBuffer } = await import("@/services/buffer");
    await definirModeBuffer("programmer");
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const input = buffer.mutations()[0].variables.input as Record<string, unknown>;
    expect(input).toMatchObject({ saveToDraft: false, mode: "customScheduled", dueAt: DEMAIN });
    expect(r.publications[0]).toMatchObject({ statut: "programmee", via: "buffer", modeBuffer: "programmer" });
  });

  it("programmation directe au-delà de 7 jours (vie de l'adresse signée) → refus clair, rien n'est envoyé", async () => {
    const { definirModeBuffer } = await import("@/services/buffer");
    await definirModeBuffer("programmer");
    await cocherTout();
    const dansHuitJours = new Date(Date.now() + 8 * 24 * 3600_000).toISOString();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], dansHuitJours)).rejects.toMatchObject({ code: "TROP_LOIN" });
    expect(buffer.mutations()).toHaveLength(0);
  });

  it("compte relié dans Buffer après la dernière lecture : relu au moment de l'envoi, puis l'envoi part", async () => {
    await cocherTout();
    // Comptes déjà lus (sans TikTok)…
    const { testerBuffer } = await import("@/services/buffer");
    await testerBuffer();
    // … puis Will relie TikTok dans Buffer.
    brancher({ canauxEnPlus: [{ id: "e00090000000000000000000", name: "Exemple name", displayName: "Exemple TikTok", service: "tiktok", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" }] });
    const r = await pub.envoyerVersBuffer(VIDEO, ["tiktok"], DEMAIN);
    expect(r.publications[0]).toMatchObject({ canalId: "e00090000000000000000000", via: "buffer", etatEnvoi: "envoye" });
    expect(buffer.mutations()).toHaveLength(1);
  });

  it("afficher le kit, le calendrier et l'état de Buffer n'appelle JAMAIS Buffer", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const avant = buffer.appels.length;
    await pub.obtenirKit(VIDEO);
    await pub.listerCalendrier("2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z");
    const { vueBuffer } = await import("@/services/buffer");
    await vueBuffer();
    expect(buffer.appels.length).toBe(avant);
  });
});
