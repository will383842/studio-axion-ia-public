/**
 * Premier commentaire dans l'envoi réel (L7-06 : Zernio est l'outil par défaut ; faux client, aucun réseau) : il arrive dans la
 * demande transmise à l'outil là où Zernio l'accepte (Facebook, LinkedIn), jamais ailleurs (le résultat dit alors « à poser à la
 * main »), et un rejeu ne crée pas de doublon.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";

// Clé factice posée avant l'inscription des fournisseurs : Zernio est inscrit, son client est un faux (aucun appel réseau).
vi.hoisted(() => { process.env.ZERNIO_API_KEY = "cle-factice-essai"; });
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
const { fournisseurParId } = await import("@/fournisseurs");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("./zernio/aides/faux-zernio");

const MDP = "essai-premier-commentaire";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const COMMENTAIRE = "Le lien : axion-ia.com";
const CANAUX = {
  linkedinPage: { id: "canal-li-page", organisationId: "org-exemple", nom: "Exemple LI page", service: "linkedin", genre: "page", deconnecte: false },
  linkedinProfil: { id: "canal-li-profil", organisationId: "org-exemple", nom: "Exemple LI profil", service: "linkedin", genre: "profile", deconnecte: false },
  instagram: { id: "canal-ig", organisationId: "org-exemple", nom: "Exemple IG", service: "instagram", deconnecte: false },
  tiktok: { id: "canal-tt", organisationId: "org-exemple", nom: "Exemple TikTok", service: "tiktok", deconnecte: false },
};

// Faux client Zernio : l'outil est l'espion du fournisseur ; chaque envoi accepté rend un identifiant distinct.
let envoyer: ReturnType<typeof brancherZernio>;
function brancherZernio(canaux: object[] = [CANAUX.linkedinPage, CANAUX.instagram, CANAUX.tiktok]) {
  injecterClientZernio(creerFauxClientZernio().client);
  const zernio = fournisseurParId("publication", "zernio");
  vi.spyOn(zernio, "listerCanaux").mockResolvedValue(canaux as never);
  let n = 0;
  return vi.spyOn(zernio, "envoyer").mockImplementation(async () => ({ idExterne: `ext-${++n}`, via: "zernio", statut: "programmee" }));
}
const demande = (i: number) => envoyer.mock.calls[i][0] as unknown as Record<string, unknown>;
/** TikTok : `envoyerVersBuffer` ne porte pas la case de consentement (refus TIKTOK_CASE voulu) ; la voie complète la pose. */
async function envoyerTiktok(options: { commentaire?: string } = {}) {
  return pub.envoyerReel("zernio", fournisseurParId("publication", "zernio"), (await pub.obtenirKit(VIDEO))!, ["tiktok"], DEMAIN, {}, { tiktok: options.commentaire ?? COMMENTAIRE }, false, { consentementTiktok: true });
}
/** Un compte précis de Zernio : par la voie complète (l'écran traduit ses comptes Buffer en comptes Zernio par le nom ; ici on donne l'identifiant Zernio). */
async function envoyerVers(reseau: "linkedin", dateIso: string, compteId: string) {
  return pub.envoyerReel("zernio", fournisseurParId("publication", "zernio"), (await pub.obtenirKit(VIDEO))!, [reseau], dateIso, { [reseau]: [compteId] }, {}, false);
}
async function cocherTout(videoId = VIDEO) {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(videoId, c, true);
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  vi.restoreAllMocks();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  lire.commentaireDeLaVideo = undefined;
  envoyer = brancherZernio();
});

describe("premier commentaire dans l'envoi réel", () => {
  it("LinkedIn : le premier commentaire arrive dans la demande envoyée à Zernio ; Instagram : rien n'est transmis, à poser à la main", async () => {
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { premiersCommentaires: { linkedin: COMMENTAIRE } });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(demande(0)).toMatchObject({ reseau: "linkedin", premierCommentaire: COMMENTAIRE });
    expect(r.commentairesALaMain).toBeUndefined();
    const ig = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { premiersCommentaires: { instagram: COMMENTAIRE } });
    expect(demande(1)).toMatchObject({ reseau: "instagram" });
    expect(demande(1)).not.toHaveProperty("premierCommentaire");
    expect(ig.commentairesALaMain).toEqual(["instagram"]);
  });

  it("rejeu du même envoi : aucun doublon chez l'outil (empreinte cleEnvoi), le commentaire n'est pas reposté", async () => {
    await cocherTout();
    const options = { premiersCommentaires: { linkedin: COMMENTAIRE } };
    const a = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, options);
    const b = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, options);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(b.publications[0].id).toBe(a.publications[0].id);
    expect(a.publications[0].cleEnvoi).toBeTruthy();
    expect(await depots().publications.compter((x) => x.videoId === VIDEO && x.reseau === "linkedin" && x.via === "zernio")).toBe(1);
  });

  it("TikTok : rien n'est envoyé comme commentaire, et le résultat le dit (à poser à la main)", async () => {
    await cocherTout();
    const r = await envoyerTiktok();
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(demande(0))).not.toContain("premierCommentaire");
    expect(JSON.stringify(demande(0))).not.toContain(COMMENTAIRE);
    expect(r.commentairesALaMain).toEqual(["tiktok"]);
  });

  it("sans commentaire : la demande envoyée ne porte aucun premier commentaire", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN);
    expect(demande(0)).not.toHaveProperty("premierCommentaire");
  });

  it("commentaire vide envoyé par l'écran : aucun premier commentaire, même si la vidéo en porte un", async () => {
    await cocherTout();
    lire.commentaireDeLaVideo = "Celui de la vidéo";
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { premiersCommentaires: { linkedin: "" } });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(demande(0))).not.toContain("premierCommentaire");
    expect(JSON.stringify(demande(0))).not.toContain("Celui de la vidéo");
  });

  it("sans surcharge : le commentaire de la vidéo ne part que si l'appelant le demande", async () => {
    await cocherTout();
    lire.commentaireDeLaVideo = "Celui de la vidéo";
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN);
    expect(demande(0)).not.toHaveProperty("premierCommentaire");
  });

  it("avecPremierCommentaire : le commentaire de la vidéo part", async () => {
    await cocherTout();
    lire.commentaireDeLaVideo = "Celui de la vidéo";
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { avecPremierCommentaire: true });
    expect(demande(0)).toMatchObject({ premierCommentaire: "Celui de la vidéo" });
  });

  it("TikTok rejoué : « à poser à la main » n'est dit qu'une fois, pas sur le rejeu", async () => {
    await cocherTout();
    const a = await envoyerTiktok();
    const b = await envoyerTiktok();
    expect(a.commentairesALaMain).toEqual(["tiktok"]);
    expect(b.commentairesALaMain).toBeUndefined();
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it("déjà chez l'outil (brouillon ou programmée) : le serveur refuse un second envoi (DEJA_DANS_OUTIL)", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN);
    const autreDate = new Date(Date.parse(DEMAIN) + 3600_000).toISOString();
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], autreDate)).rejects.toMatchObject({ code: "DEJA_DANS_OUTIL" });
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it("deux comptes LinkedIn : un envoi vers A laisse la ligne envoyable vers B, et le serveur refuse A (DEJA_DANS_OUTIL)", async () => {
    envoyer = brancherZernio([CANAUX.linkedinPage, CANAUX.linkedinProfil]);
    await cocherTout();
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    await envoyerVers("linkedin", DEMAIN, CANAUX.linkedinPage.id);
    const ligne = (await (await import("@/services/a-publier")).vueAPublier()).lignes.find((l) => l.cle === `${VIDEO}:linkedin`);
    // Pris : A seul (le serveur raisonne par compte). La liste de comptes à cocher de la ligne vient de Buffer (vueEnvoiBuffer) :
    // sans Buffer relié elle est absente, la ligne ne l'affiche donc pas ; le blocage par compte, lui, se prouve côté serveur ci-dessous.
    expect(ligne?.etat).toMatchObject({ comptesPris: [CANAUX.linkedinPage.id], sansCompte: false });
    const apres = new Date(Date.parse(DEMAIN) + 3600_000).toISOString();
    await expect(envoyerVers("linkedin", apres, CANAUX.linkedinPage.id)).rejects.toMatchObject({ code: "DEJA_DANS_OUTIL" });
    const r = await envoyerVers("linkedin", apres, CANAUX.linkedinProfil.id);
    expect(r.publications[0]).toMatchObject({ canalId: CANAUX.linkedinProfil.id, etatEnvoi: "envoye" });
    // Les deux comptes pris : la ligne est bloquée.
    const finale = (await (await import("@/services/a-publier")).vueAPublier()).lignes.find((l) => l.cle === `${VIDEO}:linkedin`);
    expect(finale?.etat).toMatchObject({ envoye: true });
  });
});
