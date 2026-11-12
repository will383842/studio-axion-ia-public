/**
 * Mots interdits à l'envoi réel (doublure de Buffer, aucun réseau) : un texte, un titre ou un commentaire refusé
 * fait échouer l'envoi AVANT toute écriture en base et tout appel à Buffer, même groupé.
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
const J = (...p: string[]) => p.join("");
const INTERDIT = J("cert", "ifié");
const YOUTUBE = { id: "e00090000000000000000001", name: "Exemple yt", displayName: "Exemple YouTube", service: "youtube", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" };
const TIKTOK = { id: "e00090000000000000000000", name: "Exemple name", displayName: "Exemple TikTok", service: "tiktok", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" };

let buffer: ReturnType<typeof fauxBuffer>;
async function cocherTout(videoId = VIDEO) {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, c, true);
}
const publications = () => depots().publications.compter((x) => x.videoId === VIDEO && x.via === "buffer");

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

describe("envoi réel : mot interdit", () => {
  it("texte du post refusé : ErreurStudio, rien en base, aucun appel à Buffer", async () => {
    await cocherTout();
    await pub.modifierTexteKit(VIDEO, "instagram", `Une formation ${INTERDIT} pour vous`, []);
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ name: "ErreurStudio", code: "TEXTE_INTERDIT" });
    expect(buffer.mutations()).toHaveLength(0);
    expect(await publications()).toBe(0);
  });

  it("envoi groupé : un seul texte refusé, AUCUN réseau ne part", async () => {
    await cocherTout();
    buffer = fauxBuffer({ canauxEnPlus: [TIKTOK] });
    vi.stubGlobal("fetch", buffer.appeler);
    await pub.modifierTexteKit(VIDEO, "tiktok", `Notre offre ${INTERDIT}`, []);
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram", "tiktok"], DEMAIN)).rejects.toMatchObject({ code: "TEXTE_INTERDIT" });
    expect(buffer.mutations()).toHaveLength(0);
    expect(await publications()).toBe(0);
  });

  it("titre YouTube refusé : même erreur, rien d'envoyé", async () => {
    await cocherTout();
    buffer = fauxBuffer({ canauxEnPlus: [YOUTUBE] });
    vi.stubGlobal("fetch", buffer.appeler);
    await pub.modifierTexteKit(VIDEO, "youtube-shorts", "Un texte propre", [], `Formation ${INTERDIT}`);
    await expect(pub.envoyerVersBuffer(VIDEO, ["youtube-shorts"], DEMAIN)).rejects.toMatchObject({ code: "TEXTE_INTERDIT" });
    expect(buffer.mutations()).toHaveLength(0);
    expect(await publications()).toBe(0);
  });

  it("TikTok, commentaire interdit posé à la main : rejet, aucun appel à Buffer, rien en base", async () => {
    await cocherTout();
    buffer = fauxBuffer({ canauxEnPlus: [TIKTOK] });
    vi.stubGlobal("fetch", buffer.appeler);
    await expect(pub.envoyerVersBuffer(VIDEO, ["tiktok"], DEMAIN, { premiersCommentaires: { tiktok: `Voir ${INTERDIT}` } })).rejects.toMatchObject({ name: "ErreurStudio", code: "COMMENTAIRE_INTERDIT" });
    expect(buffer.mutations()).toHaveLength(0);
    expect(await publications()).toBe(0);
  });

  it("textes propres : l'envoi part comme avant", async () => {
    await cocherTout();
    await pub.modifierTexteKit(VIDEO, "instagram", "Trois gestes simples.", []);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(buffer.mutations()).toHaveLength(1);
  });
});
