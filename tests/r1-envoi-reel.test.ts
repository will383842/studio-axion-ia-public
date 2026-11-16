/**
 * LOT R1 — ENVOI RÉEL (brouillon d'abord), adapté à L0-13 : Buffer est résilié et ne peut plus envoyer (accord écrit du fondateur
 * « accord L0-13 »). Les gardes prouvées au lot R1 restent prouvées, désormais sur le chemin Zernio (faux fournisseur, aucun appel réel) :
 *  1. envoi réel → `via: "zernio"`, statut « brouillon », identifiant de l'outil, UNE seule demande ;
 *  2. coupure après l'envoi (réponse perdue) → « à vérifier », puis aucune seconde demande, jamais ;
 *  3. deux touchers simultanés → un seul envoi ; déjà chez l'outil (autre date) → refus ; « Avant de publier » garde l'envoi ;
 *  4. compte manquant ou ambigu → refus AVANT tout envoi ; refus net de l'outil → publication en échec, sans la clé.
 * Et ce que la décision change : « buffer » lu comme « zernio » (variable d'environnement et routage en base), choisir Buffer
 * est refusé (`OUTIL_RETIRE`), un envoi Buffer par appel direct est refusé avant tout appel, l'historique « via buffer » reste lu.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import type { CanalPublication } from "@/fournisseurs/types";

const CLE = "cle-zernio-de-test-QUI-NE-DOIT-JAMAIS-SORTIR-9f8e";
vi.hoisted(() => { process.env.ZERNIO_API_KEY = "cle-zernio-de-test-QUI-NE-DOIT-JAMAIS-SORTIR-9f8e"; });
delete process.env.BUFFER_API_KEY;
// L'ancienne valeur « buffer » est lue comme « zernio » : jamais de simulation silencieuse, jamais d'envoi chez Buffer.
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
const { fournisseurParId } = await import("@/fournisseurs");
const { injecterClientZernio } = await import("@/services/zernio");
const { ecrireParametre } = await import("@/services/_commun");
const { definirRoutage } = await import("@/services/routage-publication");
const { creerFauxClientZernio } = await import("./zernio/aides/faux-zernio");
const { ErreurZernio } = await import("@/fournisseurs/publication/zernio-erreurs");

const MDP = "essai-r1-envoi";
/** Vidéo prête de la démonstration (selfie, 30 s, 9:16), sans licence bloquante ni publication. */
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const canal = (id: string, nom: string, service: string, genre?: string): CanalPublication => ({ id, organisationId: "org-exemple", nom, service, deconnecte: false, ...(genre ? { genre } : {}) });
const CANAUX = {
  instagram: canal("exemple-ig", "Exemple IG", "instagram"),
  linkedinProfil: canal("exemple-li-profil", "Exemple LI profil", "linkedin", "profile"),
  linkedinPage: canal("exemple-li-page", "Exemple LI page", "linkedin", "page"),
};

type Comportement = "ok" | "coupure-apres" | "refus-net" | "refus-cle";
let canaux: CanalPublication[];
let comportement: (n: number) => Comportement;
let envoyer: ReturnType<typeof brancher>;
let faux: ReturnType<typeof creerFauxClientZernio>;
const suite = (...c: Comportement[]) => (n: number) => c[n - 1] ?? "ok";
const demande = (i: number) => envoyer.mock.calls[i][0] as unknown as Record<string, unknown>;

function brancher() {
  faux = creerFauxClientZernio();
  injecterClientZernio(faux.client);
  const zernio = fournisseurParId("publication", "zernio");
  vi.spyOn(zernio, "listerCanaux").mockImplementation(async () => canaux);
  let n = 0;
  return vi.spyOn(zernio, "envoyer").mockImplementation(async () => {
    n++;
    const c = comportement(n);
    if (c === "refus-net") throw new ErreurZernio("refuse", `Refusé (token ${CLE})`, { statut: 400 });
    if (c === "refus-cle") throw new ErreurZernio("acces", `Clé refusée ${CLE}`, { statut: 401 });
    if (c === "coupure-apres") throw new Error("coupure du réseau après l'envoi");
    await new Promise((r) => setTimeout(r, 5));
    return { idExterne: `exemple-post-${n}`, via: "zernio" as const, statut: "brouillon" as const };
  });
}

async function cocherTout(videoId = VIDEO) {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, c, true);
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  canaux = [CANAUX.instagram, CANAUX.linkedinProfil, CANAUX.linkedinPage];
  comportement = () => "ok";
  envoyer = brancher();
});

describe("R1 — envoi réel (Zernio, Buffer ne peut plus envoyer), brouillon d'abord", () => {
  it("ROUGE 1 : envoi réel → brouillon chez Zernio, via zernio, identifiant de l'outil, UNE demande, texte du kit avec ses mots-dièse", async () => {
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r.simulation).toBe(false);
    expect(envoyer).toHaveBeenCalledTimes(1);
    const p = r.publications[0];
    expect(p).toMatchObject({ reseau: "instagram", via: "zernio", statut: "brouillon", canalId: CANAUX.instagram.id, etatEnvoi: "envoye", idExterne: "exemple-post-1" });
    const kit = (await pub.obtenirKit(VIDEO))!.reseaux.find((x) => x.reseau === "instagram")!;
    expect(demande(0)).toMatchObject({ reseau: "instagram", cible: CANAUX.instagram.id });
    expect(String(demande(0).texte)).toContain(kit.texte);
    // La clé ne sort ni dans la demande, ni dans la publication gardée.
    expect(JSON.stringify(demande(0))).not.toContain(CLE);
    const enBase = await depots().publications.obtenir(p.id);
    expect(enBase).toMatchObject({ via: "zernio", statut: "brouillon", idExterne: p.idExterne });
    expect(await depots().publications.compter((x) => x.via === ("buffer" as string))).toBe(0);
  });

  it("ROUGE 2 : la vidéo est donnée à Zernio par l'adresse du relais du Studio (https, /video.mp4, jeton de 30 jours, aucune signature R2, aucune adresse Buffer)", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(envoyer).toHaveBeenCalledTimes(1);
    const adresse = String(demande(0).fichierCle);
    const url = new URL(adresse);
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toMatch(/^\/api\/media-buffer\/[^/]+\/video\.mp4$/);
    expect(adresse).not.toMatch(/X-Amz|r2\.cloudflarestorage|api\.buffer\.com/i);
    const { verifierJetonMediaBuffer } = await import("@/lib/jeton-media-buffer");
    expect(verifierJetonMediaBuffer(url.pathname.split("/")[3], Date.now() + 29 * 24 * 3600 * 1000)).toEqual(expect.any(String));
  });

  it("ROUGE 3 : coupure APRÈS l'envoi (réponse perdue) → « à vérifier », puis aucune seconde demande, jamais", async () => {
    comportement = suite("coupure-apres");
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(envoyer).toHaveBeenCalledTimes(1);
    const p = r.publications[0];
    expect(p).toMatchObject({ etatEnvoi: "a-verifier", statut: "brouillon", via: "zernio" });
    expect(p.idExterne).toBeUndefined();
    expect(r.problemes?.[0]).toMatchObject({ code: "ENVOI_A_VERIFIER" });
    // Retoucher « Envoyer » : refus net « à vérifier », rien n'est renvoyé, à chaque fois.
    for (let i = 0; i < 2; i++) await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(await depots().publications.compter((x) => x.videoId === VIDEO && x.reseau === "instagram" && x.via === "zernio")).toBe(1);
  });

  it("deuxième envoi (autre date) alors que le premier est « à vérifier » → refus ENVOI_A_VERIFIER, on ne renvoie pas à l'aveugle", async () => {
    comportement = suite("coupure-apres");
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const apresDemain = new Date(Date.now() + 50 * 3600_000).toISOString();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], apresDemain)).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it("deux touchers en même temps (deux onglets) → UNE seule demande chez Zernio", async () => {
    await cocherTout();
    const [a, b] = await Promise.allSettled([pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN), pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)]);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect([a.status, b.status]).toContain("fulfilled");
    expect(await depots().publications.compter((x) => x.videoId === VIDEO && x.reseau === "instagram")).toBe(1);
  });

  it("déjà chez Zernio pour ce réseau (autre date) → refus DEJA_DANS_OUTIL, aucune seconde demande", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const apresDemain = new Date(Date.now() + 50 * 3600_000).toISOString();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], apresDemain)).rejects.toMatchObject({ code: "DEJA_DANS_OUTIL" });
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it("« Avant de publier » non coché → refusé (AVANT_DE_PUBLIER), Zernio n'est pas appelé", async () => {
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN)).rejects.toMatchObject({ code: "AVANT_DE_PUBLIER" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(faux.faux.appels).toHaveLength(0);
  });

  it("compte choisi à l'envoi (deux LinkedIn chez Zernio) : seul le compte coché reçoit la demande ; l'identifiant d'un compte d'un autre réseau est refusé (CIBLE_ZERNIO), sans repli ni compte deviné", async () => {
    await cocherTout();
    // Identifiant d'Instagram donné pour LinkedIn : refusé net, rien ne part, aucun compte LinkedIn n'est deviné à la place.
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.instagram.id] } })).rejects.toMatchObject({ code: "CIBLE_ZERNIO" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(await depots().publications.compter((x) => x.videoId === VIDEO && x.reseau === "linkedin")).toBe(0);
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage.id] } });
    expect(r.publications[0]).toMatchObject({ canalId: CANAUX.linkedinPage.id, via: "zernio", etatEnvoi: "envoye" });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(demande(0)).toMatchObject({ cible: CANAUX.linkedinPage.id });
  });

  it("outil qui refuse (refus net, puis clé refusée) → message clair SANS la clé, publication en échec, jamais « envoyée »", async () => {
    comportement = suite("refus-net", "refus-cle");
    await cocherTout();
    const e = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN).catch((x: Error) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).not.toContain(CLE);
    const p = (await depots().publications.lister((x) => x.videoId === VIDEO))[0];
    expect(p).toMatchObject({ statut: "echec", etatEnvoi: "refuse", via: "zernio" });
    expect(p.idExterne).toBeUndefined();
    expect(JSON.stringify(p)).not.toContain(CLE);
    const e2 = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN).catch((x: Error) => x);
    expect((e2 as Error).message).not.toContain(CLE);
    expect(envoyer).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(await depots().evenements.lister())).not.toContain(CLE);
  });

  it("décision L0-13 : choisir Buffer est refusé (OUTIL_RETIRE), un envoi Buffer par appel direct est refusé avant tout appel, rien n'est écrit", async () => {
    await expect(definirRoutage("instagram", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(await depots().parametres.obtenir("publication.routage")).toBeNull();
    await cocherTout();
    const kit = (await pub.obtenirKit(VIDEO))!;
    await expect(pub.envoyerReel("buffer", fournisseurParId("publication", "zernio"), kit, ["instagram"], DEMAIN, {}, {}, false)).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(await depots().publications.compter((x) => x.videoId === VIDEO)).toBe(0);
  });

  it("un « buffer » déjà enregistré dans le routage est lu comme absent : le réseau part par Zernio, la valeur reste en base", async () => {
    await ecrireParametre("publication.routage", { instagram: "buffer", linkedin: "buffer" });
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "envoye" });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect((await depots().parametres.obtenir("publication.routage"))?.valeur).toEqual({ instagram: "buffer", linkedin: "buffer" });
  });

  it("compte relié chez Zernio après la dernière lecture : relu au moment de l'envoi, puis l'envoi part", async () => {
    canaux = [CANAUX.instagram];
    await cocherTout();
    const r0 = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r0.publications).toHaveLength(1);
    // Le compte LinkedIn est relié chez Zernio APRÈS cette première lecture.
    canaux = [CANAUX.instagram, CANAUX.linkedinPage];
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN);
    expect(r.publications[0]).toMatchObject({ canalId: CANAUX.linkedinPage.id, via: "zernio", etatEnvoi: "envoye" });
    expect(envoyer).toHaveBeenCalledTimes(2);
  });

  it("afficher le kit et le calendrier n'appelle JAMAIS l'outil de publication ; une publication historique « via buffer » reste lue telle quelle", async () => {
    await cocherTout();
    await depots().publications.enregistrer({ id: "pub-historique", videoId: "v-03", reseau: "instagram", statut: "publiee", via: "buffer", date: "2026-10-01T08:00:00.000Z", texte: "ancien", etatEnvoi: "envoye", idExterne: "ancien-1", creeLe: DEMAIN, modifieLe: DEMAIN } as never);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    const avant = { envois: envoyer.mock.calls.length, appels: faux.faux.appels.length };
    await pub.obtenirKit(VIDEO);
    const cal = await pub.listerCalendrier("2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z");
    expect(JSON.stringify(cal)).toContain("pub-historique");
    expect({ envois: envoyer.mock.calls.length, appels: faux.faux.appels.length }).toEqual(avant);
    expect(await depots().publications.obtenir("pub-historique")).toMatchObject({ via: "buffer", idExterne: "ancien-1" });
  });
});
