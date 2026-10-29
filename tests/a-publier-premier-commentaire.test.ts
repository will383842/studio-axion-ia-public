/**
 * Premier commentaire vers Buffer (envoi réel simulé par la doublure de Buffer, aucun réseau) : il arrive dans la
 * mutation createPost là où Buffer l'accepte, jamais ailleurs, et un rejeu ne crée pas de doublon.
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

// La vidéo « porte » un commentaire : seul un commentaire vide envoyé par l'écran doit le retirer.
const lire = vi.hoisted(() => ({ commentaireDeLaVideo: undefined as string | undefined }));
vi.mock("@/services/premier-commentaire", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/premier-commentaire")>()), premierCommentaireDeVideo: async () => lire.commentaireDeLaVideo }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");

const MDP = "essai-premier-commentaire";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const COMMENTAIRE = "Le lien : axion-ia.com";

let buffer: ReturnType<typeof fauxBuffer>;
async function cocherTout(videoId = VIDEO) {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, c, true);
}
const entree = (i: number) => buffer.mutations()[i].variables.input as { metadata?: Record<string, Record<string, unknown>> };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  lire.commentaireDeLaVideo = undefined;
  buffer = fauxBuffer();
  vi.stubGlobal("fetch", buffer.appeler);
});

describe("premier commentaire dans l'envoi réel", () => {
  it("Instagram : le premier commentaire arrive dans createPost (firstComment)", async () => {
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { premiersCommentaires: { instagram: COMMENTAIRE } });
    expect(buffer.mutations()).toHaveLength(1);
    expect(entree(0).metadata?.instagram).toEqual({ type: "reel", shouldShareToFeed: true, firstComment: COMMENTAIRE });
    expect(r.commentairesALaMain).toBeUndefined();
  });

  it("rejeu du même envoi : aucun doublon dans Buffer (empreinte cleEnvoi), le commentaire n'est pas reposté", async () => {
    await cocherTout();
    const options = { premiersCommentaires: { instagram: COMMENTAIRE } };
    const a = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, options);
    const b = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, options);
    expect(buffer.mutations()).toHaveLength(1);
    expect(b.publications[0].id).toBe(a.publications[0].id);
    expect(a.publications[0].cleEnvoi).toBeTruthy();
    expect(await depots().publications.compter((x) => x.videoId === VIDEO && x.reseau === "instagram" && x.via === "buffer")).toBe(1);
  });

  it("TikTok : rien n'est envoyé comme commentaire, et le résultat le dit (à poser à la main)", async () => {
    await cocherTout();
    buffer = fauxBuffer({ canauxEnPlus: [{ id: "e00090000000000000000000", name: "Exemple name", displayName: "Exemple TikTok", service: "tiktok", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" }] });
    vi.stubGlobal("fetch", buffer.appeler);
    const r = await pub.envoyerVersBuffer(VIDEO, ["tiktok"], DEMAIN, { premiersCommentaires: { tiktok: COMMENTAIRE } });
    expect(buffer.mutations()).toHaveLength(1);
    expect(JSON.stringify(buffer.mutations()[0].variables)).not.toContain("firstComment");
    expect(JSON.stringify(buffer.mutations()[0].variables)).not.toContain(COMMENTAIRE);
    expect(r.commentairesALaMain).toEqual(["tiktok"]);
  });

  it("sans commentaire : l'entrée de createPost reste celle d'avant", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(entree(0).metadata?.instagram).toEqual({ type: "reel", shouldShareToFeed: true });
  });

  it("commentaire vide envoyé par l'écran : aucun firstComment, même si la vidéo en porte un", async () => {
    await cocherTout();
    lire.commentaireDeLaVideo = "Celui de la vidéo";
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { premiersCommentaires: { instagram: "" } });
    expect(buffer.mutations()).toHaveLength(1);
    expect(JSON.stringify(buffer.mutations()[0].variables)).not.toContain("firstComment");
    expect(JSON.stringify(buffer.mutations()[0].variables)).not.toContain("Celui de la vidéo");
  });

  it("sans surcharge : le commentaire de la vidéo ne part que si l'appelant le demande", async () => {
    await cocherTout();
    lire.commentaireDeLaVideo = "Celui de la vidéo";
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(entree(0).metadata?.instagram).toEqual({ type: "reel", shouldShareToFeed: true });
  });

  it("avecPremierCommentaire : le commentaire de la vidéo part", async () => {
    await cocherTout();
    lire.commentaireDeLaVideo = "Celui de la vidéo";
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { avecPremierCommentaire: true });
    expect(entree(0).metadata?.instagram).toEqual({ type: "reel", shouldShareToFeed: true, firstComment: "Celui de la vidéo" });
  });

  it("TikTok rejoué : « à poser à la main » n'est dit qu'une fois, pas sur le rejeu", async () => {
    await cocherTout();
    buffer = fauxBuffer({ canauxEnPlus: [{ id: "e00090000000000000000000", name: "Exemple name", displayName: "Exemple TikTok", service: "tiktok", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" }] });
    vi.stubGlobal("fetch", buffer.appeler);
    const options = { premiersCommentaires: { tiktok: COMMENTAIRE } };
    const a = await pub.envoyerVersBuffer(VIDEO, ["tiktok"], DEMAIN, options);
    const b = await pub.envoyerVersBuffer(VIDEO, ["tiktok"], DEMAIN, options);
    expect(a.commentairesALaMain).toEqual(["tiktok"]);
    expect(b.commentairesALaMain).toBeUndefined();
  });
});
