/**
 * Premier commentaire LinkedIn posé à la main (décision de Will) : le studio n'en envoie JAMAIS à Buffer pour LinkedIn,
 * Instagram et Facebook le reçoivent, la page « À publier » montre le texte LinkedIn à copier. Aucun réseau (doublure de Buffer).
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
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

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

describe("premier commentaire LinkedIn : à la main", () => {
  it("source unique : seul LinkedIn est posé à la main", async () => {
    const { commentaireALaMain, commentaireParBuffer } = await import("@/domaine/commentaire-a-la-main");
    expect(commentaireALaMain("linkedin")).toBe(true);
    expect(["instagram", "facebook", "tiktok", "youtube"].some((r) => commentaireALaMain(r as "instagram"))).toBe(false);
    expect(commentaireParBuffer("linkedin", true)).toBe(false);
    expect(commentaireParBuffer("instagram", true)).toBe(true);
    expect(commentaireParBuffer("instagram", false)).toBe(false);
  });

  it("LinkedIn : aucun firstComment envoyé à Buffer, surcharge de l'écran ou commentaire de la vidéo, et le résultat le dit", async () => {
    await cocherTout();
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    lire.commentaireDeLaVideo = "Celui de la vidéo";
    const r = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] }, premiersCommentaires: { linkedin: COMMENTAIRE }, avecPremierCommentaire: true });
    expect(buffer.mutations()).toHaveLength(1);
    const charge = JSON.stringify(buffer.mutations()[0].variables);
    expect(charge).not.toContain("firstComment");
    expect(charge).not.toContain(COMMENTAIRE);
    expect(charge).not.toContain("Celui de la vidéo");
    expect(r.commentairesALaMain).toEqual(["linkedin"]);
  });

  it("Instagram et Facebook : firstComment toujours envoyé à Buffer", async () => {
    await cocherTout();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { premiersCommentaires: { instagram: COMMENTAIRE } });
    expect(entree(0).metadata?.instagram).toMatchObject({ firstComment: COMMENTAIRE });
    const r = await pub.envoyerVersBuffer(VIDEO, ["facebook"], DEMAIN, { comptes: { facebook: [CANAUX.facebook1] }, premiersCommentaires: { facebook: COMMENTAIRE } });
    expect(buffer.mutations()).toHaveLength(2);
    expect(entree(1).metadata?.facebook).toMatchObject({ firstComment: COMMENTAIRE });
    expect(r.commentairesALaMain).toBeUndefined();
  });

  it("page « À publier » : le texte LinkedIn est donné à copier (à poser par Will), pas mêlé à Instagram où Buffer le pose", async () => {
    await cocherTout();
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    lire.commentaireDeLaVideo = COMMENTAIRE;
    const { vueAPublier } = await import("@/services/a-publier");
    const lignes = (await vueAPublier()).lignes;
    const li = lignes.find((l) => l.cle === `${VIDEO}:linkedin`);
    const ig = lignes.find((l) => l.cle === `${VIDEO}:instagram`);
    expect(li).toMatchObject({ premierCommentaire: COMMENTAIRE, commentaireAPoserParWill: true, commentaireTransmissible: false });
    expect(ig).toMatchObject({ premierCommentaire: COMMENTAIRE, commentaireAPoserParWill: false, commentaireTransmissible: true });
  });

  it("l'écran LinkedIn montre la mention, le texte et le bouton Copier ; Instagram garde sa zone modifiable", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { LignesAPublier } = await import("@/components/publication/LignesAPublier");
    await cocherTout();
    await depots().videos.modifier(VIDEO, { etapeEditoriale: "validee" });
    lire.commentaireDeLaVideo = COMMENTAIRE;
    const { vueAPublier } = await import("@/services/a-publier");
    const vue = await vueAPublier();
    const html = renderToStaticMarkup(createElement(LignesAPublier, { vue: { ...vue, lignes: vue.lignes.filter((l) => l.videoId === VIDEO && ["linkedin", "instagram"].includes(l.reseau)) } }));
    const bloc = html.slice(html.indexOf('data-testid="commentaire-a-la-main"'));
    expect(bloc).toContain("À poser à la main sur LinkedIn par Will");
    expect(bloc).toContain(COMMENTAIRE);
    expect(bloc).toContain("Copier");
    expect(html.match(/commentaire-a-la-main/g)).toHaveLength(1);
    expect(html).toContain("<textarea");
  });
});

describe("mots interdits : le premier commentaire est contrôlé avant tout envoi", () => {
  it("la revendication « certifié » + le nom est refusée dans le premier commentaire (Instagram)", async () => {
    await cocherTout();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { premiersCommentaires: { instagram: "Nous sommes certifiés Certifexemple" } })).rejects.toBeTruthy();
    expect(buffer.mutations()).toHaveLength(0);
  });
  // ÉCART CONSTATÉ (pas corrigé ici : le filtre n'est pas modifié) : « certifié » seul et le nom seul ne sont pas bloqués,
  // et la phrase du post n'est contrôlée par aucun filtre de mots à l'envoi.
  it.todo("« certifié » seul et le nom de la certification seul : refusés TOUJOURS, sans condition, dans la phrase du post et le premier commentaire");
});
