/**
 * HSH-01c · placement des hashtags à l'envoi et aperçu final (faux client, aucun réseau, aucune publication réelle).
 * Défaut : le texte envoyé est identique octet pour octet à celui d'avant ; réglage « premier commentaire » : les hashtags
 * passent dans le commentaire là où l'outil le transmet (Facebook, LinkedIn), restent dans le texte ailleurs (avec une phrase).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";

vi.hoisted(() => { process.env.ZERNIO_API_KEY = "cle-factice-essai"; });
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const lire = vi.hoisted(() => ({ commentaireDeLaVideo: undefined as string | undefined }));
vi.mock("@/services/premier-commentaire", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/premier-commentaire")>()), premierCommentaireDeVideo: async () => lire.commentaireDeLaVideo }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { definirPlacement } = await import("@/services/placement-hashtags");
const { estInterdit } = await import("@/reseaux/hashtags");
const { fournisseurParId } = await import("@/fournisseurs");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("../zernio/aides/faux-zernio");

const MDP = "essai-placement-envoi";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const COMMENTAIRE = "Le lien : axion-ia.com";
const CANAUX = [
  { id: "canal-li-page", organisationId: "org-exemple", nom: "Exemple LI page", service: "linkedin", genre: "page", deconnecte: false },
  { id: "canal-ig", organisationId: "org-exemple", nom: "Exemple IG", service: "instagram", deconnecte: false },
];

let envoyer: ReturnType<typeof brancherZernio>;
function brancherZernio() {
  injecterClientZernio(creerFauxClientZernio().client);
  const zernio = fournisseurParId("publication", "zernio");
  vi.spyOn(zernio, "listerCanaux").mockResolvedValue(CANAUX as never);
  let n = 0;
  return vi.spyOn(zernio, "envoyer").mockImplementation(async () => ({ idExterne: `ext-${++n}`, via: "zernio", statut: "programmee" }));
}
const demande = (i: number) => envoyer.mock.calls[i][0] as unknown as Record<string, unknown>;
async function cocherTout() {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
}
/** Le texte d'AVANT cette fiche : en-tête, texte, puis mots-dièse (sans les fourre-tout), séparés par une ligne vide. */
const texteDAvant = (r: { texte: string; motsDiese: string[] }, entete?: string) =>
  [entete ? `${entete}\n${r.texte}` : r.texte, r.motsDiese.filter((m) => !estInterdit(m)).join(" ")].filter(Boolean).join("\n\n");

beforeAll(async () => { await preparerMotDePasse(MDP); });
async function remettreAZero() {
  vi.restoreAllMocks();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  lire.commentaireDeLaVideo = undefined;
  envoyer = brancherZernio();
}
beforeEach(remettreAZero);

describe("réglage par défaut : texte inchangé octet pour octet", () => {
  it("texteAEnvoyer : mêmes octets qu'avant, avec ou sans en-tête de série, avec un mot-dièse fourre-tout", () => {
    const r = { texte: "Un texte\navec deux lignes", motsDiese: ["#axion", "#fyp", "#ia"] };
    expect(pub.texteAEnvoyer(r)).toBe(texteDAvant(r));
    expect(pub.texteAEnvoyer(r, "Série · ép. 3")).toBe(texteDAvant(r, "Série · ép. 3"));
    expect(pub.texteAEnvoyer({ texte: "", motsDiese: ["#axion"] })).toBe("#axion");
    expect(pub.texteAEnvoyer({ texte: "Seul", motsDiese: [] })).toBe("Seul");
    expect(pub.texteAEnvoyer({ ...r, reseau: "linkedin" })).toBe(texteDAvant(r));
  });

  it("envoi réel LinkedIn : le texte et le commentaire partis sont ceux d'avant", async () => {
    await cocherTout();
    const kit = (await pub.obtenirKit(VIDEO))!;
    const li = kit.reseaux.find((x) => x.reseau === "linkedin")!;
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { premiersCommentaires: { linkedin: COMMENTAIRE } });
    expect(demande(0).texte).toBe(texteDAvant(li, kit.serie?.entete));
    expect(demande(0)).toMatchObject({ premierCommentaire: COMMENTAIRE });
  });
});

describe("réglage « premier commentaire »", () => {
  it("LinkedIn (transmis) : les hashtags quittent le texte et rejoignent le premier commentaire, rien n'est perdu", async () => {
    await definirPlacement("linkedin", "premier-commentaire");
    await cocherTout();
    const li = (await pub.obtenirKit(VIDEO))!.reseaux.find((x) => x.reseau === "linkedin")!;
    const mots = li.motsDiese.filter((m) => !estInterdit(m));
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { premiersCommentaires: { linkedin: COMMENTAIRE } });
    const texte = String(demande(0).texte);
    const commentaire = String(demande(0).premierCommentaire);
    for (const m of mots) {
      expect(texte).not.toContain(m);
      expect(commentaire).toContain(m);
    }
    expect(commentaire.startsWith(COMMENTAIRE)).toBe(true);
  });

  it("Instagram (transmis par Zernio, ZRN-01) : les hashtags quittent le texte et rejoignent le premier commentaire, c'est le choix du réglage", async () => {
    await definirPlacement("instagram", "premier-commentaire");
    await cocherTout();
    const kit = (await pub.obtenirKit(VIDEO))!;
    const ig = kit.reseaux.find((x) => x.reseau === "instagram")! as import("@/services/publications").VueKitReseauApercu;
    const mots = ig.motsDiese.filter((m) => !estInterdit(m));
    expect(ig.apercuEnvoi?.repli).toBeUndefined();
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    if (mots.length) {
      expect(demande(0).texte).not.toContain(mots[0]);
      expect(demande(0).premierCommentaire).toContain(mots.join(" "));
    }
  });
});

describe("aperçu final dans le kit", () => {
  it("expose texte et premier commentaire finaux, identiques à ce qui part, sans rien envoyer", async () => {
    await definirPlacement("linkedin", "premier-commentaire");
    lire.commentaireDeLaVideo = COMMENTAIRE;
    const kit = (await pub.obtenirKit(VIDEO))!;
    expect(envoyer).not.toHaveBeenCalled();
    const li = kit.reseaux.find((x) => x.reseau === "linkedin")! as import("@/services/publications").VueKitReseauApercu;
    expect(li.apercuEnvoi).toBeDefined();
    await cocherTout();
    // Comme la feuille du kit : aucune option ; le commentaire de la vidéo ne part pas, l'aperçu le signale à poser à la main.
    await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN);
    expect(demande(0).texte).toBe(li.apercuEnvoi!.texte);
    expect(demande(0).premierCommentaire).toBe(li.apercuEnvoi!.premierCommentaire);
    expect(li.apercuEnvoi!.aPoserALaMain).toBe(COMMENTAIRE);
  });

  it("envoi SANS options (comme la feuille du kit) : l'aperçu égale ce qui part, commentaire de la vidéo signalé à la main", async () => {
    for (const reglage of ["texte", "premier-commentaire"] as const) {
      // Un envoi déjà parti n'est pas rejoué : chaque réglage repart d'un état neuf.
      await remettreAZero();
      await definirPlacement("linkedin", reglage);
      lire.commentaireDeLaVideo = COMMENTAIRE;
      const kit = (await pub.obtenirKit(VIDEO))!;
      const li = (kit.reseaux.find((x) => x.reseau === "linkedin")! as import("@/services/publications").VueKitReseauApercu).apercuEnvoi!;
      await cocherTout();
      await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN);
      expect(demande(0).texte).toBe(li.texte);
      expect(demande(0).premierCommentaire).toBe(li.premierCommentaire);
      if (reglage === "texte") expect(li.premierCommentaire).toBeUndefined();
      expect(li.aPoserALaMain).toBe(COMMENTAIRE);
    }
  });

  it("avec le réglage par défaut, l'aperçu de chaque réseau est le texte d'avant", async () => {
    const kit = (await pub.obtenirKit(VIDEO))!;
    for (const r of kit.reseaux as import("@/services/publications").VueKitReseauApercu[]) {
      expect(r.apercuEnvoi?.texte).toBe(texteDAvant(r, kit.serie?.entete));
      expect(r.apercuEnvoi?.repli).toBeUndefined();
    }
  });
});

describe("TikTok et LinkedIn : aucune réponse automatique", () => {
  it("TikTok : même réglé sur le premier commentaire, les hashtags restent dans le texte avec la phrase de repli", () => {
    const s = pub.texteAEnvoyer({ texte: "Un texte", motsDiese: ["#axion"], reseau: "tiktok" }, undefined, { placement: "premier-commentaire" });
    expect(s).toBe("Un texte\n\n#axion");
  });
});
