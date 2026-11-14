/**
 * Mots interdits à l'envoi réel (L7-06 : Zernio est l'outil par défaut ; faux client, aucun réseau) : un texte, un titre ou un
 * commentaire refusé fait échouer l'envoi AVANT toute écriture en base et tout appel à l'outil, même groupé.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import { fauxBuffer } from "./helpers/r1-buffer";

// Clé factice posée avant l'inscription des fournisseurs : Zernio est inscrit, son client est un faux (aucun appel réseau).
vi.hoisted(() => { process.env.ZERNIO_API_KEY = "cle-factice-essai"; });
// YouTube n'est pas porté par Zernio : son titre n'est filtré qu'avec un choix explicite de Buffer (doublure de Buffer, aucun réseau).
process.env.BUFFER_API_KEY = "cle-buffer-de-test-QUI-NE-DOIT-JAMAIS-SORTIR-9f8e";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
// Stockage R2 configuré (signature locale, aucun appel) : l'adresse donnée à l'outil est une adresse signée.
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
const { definirRoutage } = await import("@/services/routage-publication");
const { fournisseurParId } = await import("@/fournisseurs");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("./zernio/aides/faux-zernio");

const MDP = "essai-premier-commentaire";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const J = (...p: string[]) => p.join("");
const INTERDIT = J("cert", "ifié");
const YOUTUBE_BUFFER = { id: "e00090000000000000000001", name: "Exemple yt", displayName: "Exemple YouTube", service: "youtube", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" };
const canal = (id: string, nom: string, service: string, genre?: string) => ({ id, organisationId: "org-exemple", nom, service, ...(genre ? { genre } : {}), deconnecte: false });
const CANAUX = [canal("canal-ig", "Exemple IG", "instagram"), canal("canal-li", "Exemple LI", "linkedin", "page"), canal("canal-yt", "Exemple YouTube", "youtube"), canal("canal-tt", "Exemple TikTok", "tiktok")];

// Faux client Zernio : l'espion du fournisseur remplace l'envoi réel et compte chaque demande.
let envoyer: ReturnType<typeof brancherZernio>;
function brancherZernio() {
  injecterClientZernio(creerFauxClientZernio().client);
  const zernio = fournisseurParId("publication", "zernio");
  vi.spyOn(zernio, "listerCanaux").mockResolvedValue(CANAUX as never);
  let n = 0;
  return vi.spyOn(zernio, "envoyer").mockImplementation(async () => ({ idExterne: `ext-${++n}`, via: "zernio", statut: "programmee" }));
}
async function cocherTout(videoId = VIDEO) {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, c, true);
}
const publications = () => depots().publications.compter((x) => x.videoId === VIDEO && x.via === "zernio");

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  lire.commentaireDeLaVideo = undefined;
  envoyer = brancherZernio();
});

describe("envoi réel : mot interdit", () => {
  it("texte du post refusé : ErreurStudio, rien en base, aucun appel à l'outil", async () => {
    await cocherTout();
    await pub.modifierTexteKit(VIDEO, "instagram", `Une formation ${INTERDIT} pour vous`, []);
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ name: "ErreurStudio", code: "TEXTE_INTERDIT" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(await publications()).toBe(0);
  });

  it("envoi groupé : un seul texte refusé, AUCUN réseau ne part", async () => {
    await cocherTout();
    await pub.modifierTexteKit(VIDEO, "linkedin", `Notre offre ${INTERDIT}`, []);
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram", "linkedin"], DEMAIN)).rejects.toMatchObject({ code: "TEXTE_INTERDIT" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(await publications()).toBe(0);
  });

  it("titre YouTube refusé (YouTube part par Buffer, choix explicite) : même erreur, rien d'envoyé", async () => {
    await cocherTout();
    await definirRoutage("youtube-shorts", "buffer");
    const buffer = fauxBuffer({ canauxEnPlus: [YOUTUBE_BUFFER] });
    vi.stubGlobal("fetch", buffer.appeler);
    await pub.modifierTexteKit(VIDEO, "youtube-shorts", "Un texte propre", [], `Formation ${INTERDIT}`);
    await expect(pub.envoyerVersBuffer(VIDEO, ["youtube-shorts"], DEMAIN)).rejects.toMatchObject({ code: "TEXTE_INTERDIT" });
    expect(buffer.mutations()).toHaveLength(0);
    expect(envoyer).not.toHaveBeenCalled();
    expect(await depots().publications.compter((x) => x.videoId === VIDEO)).toBe(0);
  });

  it("TikTok, commentaire interdit posé à la main : rejet, aucun appel à l'outil, rien en base", async () => {
    await cocherTout();
    // `envoyerVersBuffer` ne porte pas la case de consentement TikTok (refus TIKTOK_CASE voulu) : la voie complète la pose.
    const kit = (await pub.obtenirKit(VIDEO))!;
    await expect(pub.envoyerReel("zernio", fournisseurParId("publication", "zernio"), kit, ["tiktok"], DEMAIN, {}, { tiktok: `Voir ${INTERDIT}` }, false, { consentementTiktok: true })).rejects.toMatchObject({ name: "ErreurStudio", code: "COMMENTAIRE_INTERDIT" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(await publications()).toBe(0);
  });

  it("textes propres : l'envoi part comme avant", async () => {
    await cocherTout();
    await pub.modifierTexteKit(VIDEO, "instagram", "Trois gestes simples.", []);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(envoyer).toHaveBeenCalledTimes(1);
  });
});
