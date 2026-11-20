/**
 * L5-02 · envoi d'un visuel (carrousel, infographie) depuis le créneau. Faux fournisseur, dépôts en mémoire, faux stockage :
 * aucun appel réel, aucun envoi réel. Données fictives. Interrupteur éditorial (L7-08) ÉTEINT par défaut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv";
import { corpsPostZernio, mediasDemandes, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const pub = await import("@/services/publications");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
const { REGLAGE_ENVOI_CALENDRIER } = await import("@/domaine/outil-publication");

const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const CIBLE = "compte-1:li:42";
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;

let appels: DemandePublication[] = [];
let comportement: (d: DemandePublication) => Promise<{ idExterne: string; via: "zernio"; statut: "brouillon" }>;
const faux = (): FournisseurPublication =>
  ({
    id: "zernio",
    type: "publication",
    nom: "faux",
    reelPrevu: "faux",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [
      { id: "compte-1:li:42", organisationId: "zernio", nom: "Page LinkedIn", service: "linkedin", genre: "page" },
      { id: "compte-2", organisationId: "zernio", nom: "Compte Instagram", service: "instagram" },
      { id: "compte-1:fb:page-1", organisationId: "zernio", nom: "Page Facebook", service: "facebook", genre: "page" },
      { id: "compte-9", organisationId: "zernio", nom: "Ancien", service: "instagram", deconnecte: true },
    ],
    envoyer: async (d: DemandePublication) => {
      appels.push(d);
      return comportement(d);
    },
  }) as unknown as FournisseurPublication;

async function ouvrirTout(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
}

async function creerVisuel(p: Record<string, unknown> = {}): Promise<string> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_1",
    famille: "carrousel",
    titre: "Cinq erreurs courantes",
    entree: { type: "sujet", sujet: "exemple" },
    statut: "valide",
    modeTexte: "api",
    versionSpec: 1,
    coutCentimes: 0,
    creeLe: le,
    modifieLe: le,
    rendu: {
      empreinte: "e1",
      pdfCle: "visuels/vis_1/carrousel.pdf",
      vignetteCle: "visuels/vis_1/v.png",
      pages: [1, 2, 3].map((i) => ({ index: i, x1Cle: `visuels/vis_1/p${i}.png`, x2Cle: `visuels/vis_1/p${i}@2x.png` })),
      renduLe: le,
    },
    ...p,
  } as never);
  return "vis_1";
}

const visuelles = async () => depots().publications.lister((p) => p.visuelId === "vis_1");

/** Écrit un créneau validé (date, compte et textes) puis envoie DEPUIS CE CRÉNEAU : l'appelant ne fournit que les textes alternatifs. */
async function envoyer(service: FournisseurPublication, visuelId: string, reseau: "linkedin" | "instagram" | "facebook", dateIso: string, o: Record<string, unknown>) {
  const id = `cr-${visuelId}-${reseau}-${String(o.cible)}-${dateIso}`;
  await depots().creneauxEditoriaux.enregistrer({
    id, jourVise: dateIso.slice(0, 10), heuresParReseau: { [reseau]: dateIso }, compteCible: String(o.cible), visuelId,
    textes: { [reseau]: { texte: String(o.legende), premierCommentaire: String(o.premierCommentaire ?? "") } },
    statut: "valide", decalages: 0, valideeLe: o.valideeLe as string | undefined, valideePar: "le fondateur",
  } as never);
  return pub.envoyerVisuel(service, id, reseau, { textesAlternatifs: o.textesAlternatifs as string[] | undefined, lireUrl: o.lireUrl as never });
}

const VALIDEE = "2026-11-12T10:00:00Z";
const options = (o: Record<string, unknown> = {}) => ({ cible: CIBLE, legende: "Légende d'exemple", valideeLe: VALIDEE, lireUrl, ...o });
/** Nombre TOTAL de publications du dépôt (toute source) : une écriture sous un autre identifiant se verrait. */
const total = async () => depots().publications.compter();

beforeEach(async () => {
  appels = [];
  comportement = async () => ({ idExterne: "ext-1", via: "zernio", statut: "brouillon" });
  vi.stubGlobal("fetch", () => Promise.reject(new Error("aucun appel réel dans ce test")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  reinitialiserDepots();
  reinitialiserRequete();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("L5-02 · envoyerVisuel : interrupteur éteint par défaut", () => {
  it("le nom du réglage lu est celui de L7-08", () => {
    expect(PARAM_EDITORIALE_ACTIVE).toBe("publication.editoriale_active");
    expect(REGLAGE_ENVOI_CALENDRIER).toBe(PARAM_EDITORIALE_ACTIVE);
  });

  it("rien n'est réglé (défaut) : refus, 0 appel, 0 publication écrite", async () => {
    const id = await creerVisuel();
    const avant = await total();
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it.each([
    ["éditorial éteint", { [PARAM_EDITORIALE_ACTIVE]: false }],
    ["calendrier éteint", { [PARAM_ENVOI_CALENDRIER]: false }],
    ["« Tout arrêter » actif", { [PARAM_ARRET_ZERNIO]: false }],
  ])("%s, les autres ouverts : refus, 0 appel", async (_n, reglage) => {
    const id = await creerVisuel();
    await ouvrirTout();
    for (const [k, v] of Object.entries(reglage)) await ecrireParametre(k, v);
    const avant = await total();
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it("l'ancien réglage d'envoi seul ouvert ne suffit pas", async () => {
    const id = await creerVisuel();
    await ecrireParametre(PARAM_ARRET_ZERNIO, true);
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
  });
});

describe("L5-02 · envoyerVisuel : contenu envoyé", () => {
  beforeEach(ouvrirTout);

  it("carrousel LinkedIn = 1 document PDF avec titre, aucune image, brouillon", async () => {
    const id = await creerVisuel();
    const r = await envoyer(faux(), id, "linkedin", DEMAIN, options({ premierCommentaire: "Voir le guide" }));
    expect(r.deja).toBe(false);
    expect(appels).toHaveLength(1);
    expect(appels[0].document).toEqual({ url: "https://exemple.test/visuels/vis_1/carrousel.pdf", titre: "Cinq erreurs courantes" });
    expect(appels[0].images).toBeUndefined();
    expect(appels[0].mode).toBe("brouillon");
    expect(appels[0].cible).toBe(CIBLE);
    expect(r.publication).toMatchObject({ visuelId: "vis_1", reseau: "linkedin", via: "zernio", etatEnvoi: "envoye", statut: "brouillon" });
    expect(r.publication.videoId).toBeUndefined();
  });

  it("Instagram : les images dans l'ordre, chacune avec son texte alternatif de 125 signes au plus", async () => {
    const id = await creerVisuel();
    await envoyer(faux(), id, "instagram", DEMAIN, options({ cible: "compte-2", textesAlternatifs: ["Page un", "Page deux", "Page trois"] }));
    expect(appels[0].images?.map((i) => i.url)).toEqual([1, 2, 3].map((i) => `https://exemple.test/visuels/vis_1/p${i}.png`));
    expect(appels[0].images?.map((i) => i.texteAlternatif)).toEqual(["Page un", "Page deux", "Page trois"]);
    expect(appels[0].document).toBeUndefined();
  });

  it("Instagram sans texte alternatif : refus avant tout appel", async () => {
    const id = await creerVisuel();
    const avant = await total();
    await expect(envoyer(faux(), id, "instagram", DEMAIN, options({ cible: "compte-2" }))).rejects.toMatchObject({ code: "VISUEL_REFUSE" });
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it.each([
    ["non validé", { statut: "brouillon" }, "VISUEL_NON_VALIDE"],
    ["à la corbeille", { corbeilleLe: "2026-11-11T08:00:00Z" }, "VISUEL_NON_VALIDE"],
    ["d'exemple", { estDemo: true }, "VISUEL_EXEMPLE"],
    ["d'essai (texte simulé)", { modeTexte: "simulation" }, "VISUEL_ESSAI"],
    ["sans rendu", { rendu: undefined }, "VISUEL_SANS_RENDU"],
    ["au titre trop long pour LinkedIn", { titre: "T".repeat(41) }, "VISUEL_REFUSE"],
  ])("visuel %s : refus %#, 0 appel, rien d'écrit", async (_n, p, code) => {
    const id = await creerVisuel(p);
    const avant = await total();
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code });
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it.each([
    ["sans valideeLe", undefined],
    ["valideeLe illisible", "pas une date"],
    ["valideeLe dans le futur", new Date(Date.now() + 86400_000).toISOString()],
  ])("aucun appel au diffuseur, même en brouillon : créneau %s", async (_n, valideeLe) => {
    const id = await creerVisuel();
    const avant = await total();
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options({ valideeLe }))).rejects.toMatchObject({ code: "CRENEAU_NON_VALIDE" });
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it.each([
    ["inconnu", "compte-inconnu"],
    ["déconnecté", "compte-9"],
  ])("compte %s : refus CIBLE_INCONNUE, 0 appel", async (_n, cible) => {
    const id = await creerVisuel();
    const avant = await total();
    await expect(envoyer(faux(), id, "instagram", DEMAIN, options({ cible, textesAlternatifs: ["a", "b", "c"] }))).rejects.toMatchObject({ code: "CIBLE_INCONNUE" });
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it("premier commentaire sur Instagram (transmis par Zernio) : plus refusé, le corps envoyé porte firstComment", async () => {
    const id = await creerVisuel();
    await envoyer(faux(), id, "instagram", DEMAIN, options({ cible: "compte-2", textesAlternatifs: ["a", "b", "c"], premierCommentaire: "Voir le guide" }));
    expect(appels).toHaveLength(1);
    const demande = appels[0] as unknown as DemandeZernio;
    expect(demande.premierCommentaire).toBe("Voir le guide");
    const corps = corpsPostZernio(demande, { maintenant: Date.now(), medias: mediasDemandes(demande), hotesPublics: new Set(["exemple.test"]), profilLinkedinProuve: true });
    expect(JSON.stringify(corps)).toContain('"firstComment":"Voir le guide"');
  });

  it("date passée : refus, 0 appel", async () => {
    const id = await creerVisuel();
    await expect(envoyer(faux(), id, "linkedin", "2020-01-01T10:00:00Z", options())).rejects.toMatchObject({ code: "DATE_PASSEE" });
    expect(appels).toHaveLength(0);
  });

  it("jamais de réponse automatique : aucun champ de réponse dans la demande LinkedIn", async () => {
    const id = await creerVisuel();
    await envoyer(faux(), id, "linkedin", DEMAIN, options());
    expect(JSON.stringify(appels[0])).not.toMatch(/autoReply|reponseAuto|replyTo/i);
  });
});

describe("L5-02 · envoyerVisuel : le créneau est relu en base, jamais fourni par l'appelant", () => {
  beforeEach(ouvrirTout);

  const creneau = (p: Record<string, unknown> = {}) => ({
    id: "cr-1", jourVise: DEMAIN.slice(0, 10), heuresParReseau: { linkedin: DEMAIN }, compteCible: CIBLE, visuelId: "vis_1",
    textes: { linkedin: { texte: "Texte du créneau", premierCommentaire: "" } }, statut: "valide", decalages: 0, valideeLe: VALIDEE, valideePar: "le fondateur", ...p,
  });
  const poser = async (p: Record<string, unknown> = {}) => { await creerVisuel(); await depots().creneauxEditoriaux.enregistrer(creneau(p) as never); };

  it("créneau valide : la date, le compte et le texte viennent du créneau stocké", async () => {
    await poser();
    const r = await pub.envoyerVisuel(faux(), "cr-1", "linkedin", { lireUrl });
    expect(appels).toHaveLength(1);
    expect(appels[0]).toMatchObject({ date: DEMAIN, cible: CIBLE, texte: "Texte du créneau" });
    expect(r.publication.visuelId).toBe("vis_1");
  });

  it.each([
    ["introuvable", "cr-absent", {}],
    ["à valider", "cr-1", { statut: "a_valider" }],
    ["proposé", "cr-1", { statut: "propose" }],
    ["sans valideeLe", "cr-1", { valideeLe: undefined }],
    ["valideeLe illisible", "cr-1", { valideeLe: "pas une date" }],
    ["valideeLe dans le futur", "cr-1", { valideeLe: new Date(Date.now() + 86400_000).toISOString() }],
    ["refusé", "cr-1", { refuseLe: "2026-11-13T10:00:00Z" }],
    ["retiré", "cr-1", { retireLe: "2026-11-13T10:00:00Z" }],
    ["celui d'une vidéo", "cr-1", { visuelId: undefined, videoId: "v1" }],
  ])("créneau %s : refus CRENEAU_NON_VALIDE, 0 appel, 0 écriture", async (_n, id, p) => {
    await poser(p);
    const avant = await total();
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", { lireUrl })).rejects.toMatchObject({ code: "CRENEAU_NON_VALIDE" });
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it.each([
    ["sans heure pour ce réseau", { heuresParReseau: {} }],
    ["sans texte pour ce réseau", { textes: {} }],
  ])("créneau %s : refus CRENEAU_INCOMPLET, 0 appel", async (_n, p) => {
    await poser(p);
    await expect(pub.envoyerVisuel(faux(), "cr-1", "linkedin", { lireUrl })).rejects.toMatchObject({ code: "CRENEAU_INCOMPLET" });
    expect(appels).toHaveLength(0);
  });

  it("créneau d'un AUTRE visuel : c'est le visuel du créneau qui est lu, jamais un autre", async () => {
    await poser({ visuelId: "vis_inconnu" });
    await expect(pub.envoyerVisuel(faux(), "cr-1", "linkedin", { lireUrl })).rejects.toMatchObject({ code: "VISUEL_NON_VALIDE" });
    expect(appels).toHaveLength(0);
  });

  it("éteint : le créneau n'est même pas lu (porte avant toute lecture)", async () => {
    await poser();
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, false);
    await expect(pub.envoyerVisuel(faux(), "cr-absent", "linkedin", { lireUrl })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
  });
});

describe("L5-02 · envoyerVisuel : anti-double envoi", () => {
  beforeEach(ouvrirTout);

  it("deux passages successifs = un seul envoi, la même publication rendue", async () => {
    const id = await creerVisuel();
    const a = await envoyer(faux(), id, "linkedin", DEMAIN, options());
    const b = await envoyer(faux(), id, "linkedin", DEMAIN, options());
    expect(appels).toHaveLength(1);
    expect(b.deja).toBe(true);
    expect(b.publication.id).toBe(a.publication.id);
    expect(await visuelles()).toHaveLength(1);
  });

  it("deux appels en même temps = un seul envoi", async () => {
    const id = await creerVisuel();
    const [a, b] = await Promise.allSettled([
      envoyer(faux(), id, "linkedin", DEMAIN, options()),
      envoyer(faux(), id, "linkedin", DEMAIN, options()),
    ]);
    expect(appels).toHaveLength(1);
    const ok = [a, b].filter((r) => r.status === "fulfilled");
    const refus = [a, b].filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(refus).toHaveLength(1);
    expect(refus[0].reason).toMatchObject({ code: "ENVOI_EN_COURS" });
    expect(await visuelles()).toHaveLength(1);
  });

  it("envoi en cours (processus mort entre la réservation et la réponse) : ne repart pas", async () => {
    const id = await creerVisuel();
    let liberer!: () => void;
    comportement = () => new Promise((res) => { liberer = () => res({ idExterne: "ext-1", via: "zernio", statut: "brouillon" }); });
    const premier = envoyer(faux(), id, "linkedin", DEMAIN, options());
    await vi.waitFor(() => expect(appels).toHaveLength(1));
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_EN_COURS" });
    expect(appels).toHaveLength(1);
    liberer();
    await premier;
  });

  it("réponse perdue : « à vérifier », aucun renvoi automatique aux passages suivants", async () => {
    const id = await creerVisuel();
    comportement = async () => { throw new ErreurZernio("indisponible", "délai dépassé", { reessayable: true }); };
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    const pubs = await visuelles();
    expect(pubs).toHaveLength(1);
    expect(pubs[0].etatEnvoi).toBe("a-verifier");
    comportement = async () => ({ idExterne: "ext-2", via: "zernio", statut: "brouillon" });
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    expect(appels).toHaveLength(1);
  });

  it("reprise après échec partiel : un refus net permet UN nouvel essai, puis plus rien ne repart", async () => {
    const id = await creerVisuel();
    comportement = async () => { throw new ErreurZernio("refuse", "refusé avant le réseau"); };
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_REFUSE" });
    expect((await visuelles()).map((p) => p.etatEnvoi)).toEqual(["refuse"]);
    comportement = async () => ({ idExterne: "ext-2", via: "zernio", statut: "brouillon" });
    const ok = await envoyer(faux(), id, "linkedin", DEMAIN, options());
    expect(ok.publication.etatEnvoi).toBe("envoye");
    const encore = await envoyer(faux(), id, "linkedin", DEMAIN, options());
    expect(encore.deja).toBe(true);
    expect(appels).toHaveLength(2);
  });

  it("même visuel, même réseau, même compte, AUTRE date : refus, 0 nouvel appel (après un envoi réussi)", async () => {
    const id = await creerVisuel();
    await envoyer(faux(), id, "linkedin", DEMAIN, options());
    const autre = new Date(Date.parse(DEMAIN) + 1000).toISOString();
    await expect(envoyer(faux(), id, "linkedin", autre, options())).rejects.toMatchObject({ code: "DEJA_DANS_OUTIL" });
    expect(appels).toHaveLength(1);
    expect(await visuelles()).toHaveLength(1);
  });

  it("même visuel, autre date, après une réponse perdue : le « à vérifier » bloque toujours, 0 nouvel appel", async () => {
    const id = await creerVisuel();
    comportement = async () => { throw new ErreurZernio("indisponible", "délai dépassé", { reessayable: true }); };
    await expect(envoyer(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    const autre = new Date(Date.parse(DEMAIN) + 86400_000).toISOString();
    await expect(envoyer(faux(), id, "linkedin", autre, options())).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    expect(appels).toHaveLength(1);
  });

  it("un autre réseau du même visuel est un autre envoi (pas un doublon)", async () => {
    const id = await creerVisuel();
    await envoyer(faux(), id, "linkedin", DEMAIN, options());
    await envoyer(faux(), id, "instagram", DEMAIN, options({ cible: "compte-2", textesAlternatifs: ["a", "b", "c"] }));
    expect(appels).toHaveLength(2);
  });
});

describe("L5-02 · envoyerVisuel : VRAI constructeur de corps (zernio-corps.ts), validé contre l'extrait OpenAPI", () => {
  beforeEach(ouvrirTout);

  const CAS: [string, "linkedin" | "instagram" | "facebook", string, Record<string, unknown>][] = [
    ["LinkedIn", "linkedin", CIBLE, {}],
    ["Instagram", "instagram", "compte-2", { textesAlternatifs: ["Page un", "Page deux", "Page trois"] }],
    ["Facebook", "facebook", "compte-1:fb:page-1", { textesAlternatifs: ["Page un", "Page deux", "Page trois"] }],
  ];

  function validateur() {
    const chemin = resolve(process.cwd(), "docs/zernio/openapi-extrait-1.418.1.json");
    expect(existsSync(chemin), `extrait OpenAPI manquant : ${chemin}`).toBe(true);
    const spec = JSON.parse(readFileSync(chemin, "utf8"));
    const racine = spec.paths["/v1/posts"].post.requestBody.content["application/json"].schema;
    const psd = racine.properties.platforms.items.properties.platformSpecificData;
    if (psd?.oneOf) { psd.anyOf = psd.oneOf; delete psd.oneOf; }
    const ajv = new Ajv({ strict: false, allErrors: true });
    return { valider: ajv.compile({ ...racine, components: spec.components }), ajv };
  }

  it.each(CAS)("%s : le corps construit par le vrai constructeur est un brouillon valide (ajv)", async (_n, reseau, cible, extra) => {
    const id = await creerVisuel();
    await envoyer(faux(), id, reseau, DEMAIN, options({ cible, ...extra }));
    const demande = appels[0] as unknown as DemandeZernio;
    const medias = mediasDemandes(demande);
    const corps = corpsPostZernio(demande, { maintenant: Date.now(), medias, hotesPublics: new Set(["exemple.test"]), profilLinkedinProuve: true });
    expect(corps.isDraft).toBe(true);
    expect(corps.metadata?.studioCle).toBe(demande.cleEnvoi);
    const { valider, ajv } = validateur();
    expect(valider(corps), ajv.errorsText(valider.errors)).toBe(true);
  });

  it("carrousel LinkedIn : 1 seul mediaItem, un document PDF avec titre", async () => {
    const id = await creerVisuel();
    await envoyer(faux(), id, "linkedin", DEMAIN, options());
    const demande = appels[0] as unknown as DemandeZernio;
    const demandes = mediasDemandes(demande);
    expect(demandes).toHaveLength(1);
    expect(demandes[0]).toMatchObject({ type: "document", title: "Cinq erreurs courantes", mimeType: "application/pdf" });
    const corps = corpsPostZernio(demande, { maintenant: Date.now(), medias: demandes, hotesPublics: new Set(["exemple.test"]), profilLinkedinProuve: true });
    expect(corps.mediaItems).toHaveLength(1);
  });

  it("Instagram et Facebook : une image par page, chacune avec son texte alternatif", async () => {
    const id = await creerVisuel();
    await envoyer(faux(), id, "instagram", DEMAIN, options({ cible: "compte-2", textesAlternatifs: ["Page un", "Page deux", "Page trois"] }));
    const demandes = mediasDemandes(appels[0] as unknown as DemandeZernio);
    expect(demandes).toHaveLength(3);
    expect(demandes.every((m) => m.type === "image")).toBe(true);
  });

  it("premier commentaire : exactement un firstComment pour LinkedIn, Facebook et Instagram (VRAI constructeur)", async () => {
    const compte = async (reseau: "linkedin" | "instagram" | "facebook", cible: string, extra: Record<string, unknown>) => {
      appels = [];
      reinitialiserDepots();
      await ouvrirTout();
      const id = await creerVisuel();
      // Le commentaire est ajouté à la demande pour interroger le constructeur lui-même.
      await envoyer(faux(), id, reseau, DEMAIN, options({ cible, ...extra }));
      const demande = { ...(appels[0] as unknown as DemandeZernio), premierCommentaire: "Voir le guide" };
      return corpsPostZernio(demande, { maintenant: Date.now(), medias: mediasDemandes(demande), hotesPublics: new Set(["exemple.test"]), profilLinkedinProuve: true });
    };
    const alt = { textesAlternatifs: ["a", "b", "c"] };
    const compteFirst = (c: unknown) => (JSON.stringify(c).match(/firstComment/g) ?? []).length;
    expect(compteFirst(await compte("linkedin", CIBLE, {}))).toBe(1);
    expect(compteFirst(await compte("facebook", "compte-1:fb:page-1", alt))).toBe(1);
    expect(compteFirst(await compte("instagram", "compte-2", alt))).toBe(1);
  });

  it("LinkedIn : le constructeur refuse des images à la place du document (un seul type de média)", async () => {
    const id = await creerVisuel();
    await envoyer(faux(), id, "linkedin", DEMAIN, options());
    const demande = { ...(appels[0] as unknown as DemandeZernio), images: [{ url: "https://exemple.test/p1.png", texteAlternatif: "a" }] };
    expect(() => mediasDemandes(demande)).toThrow();
  });
});

describe("compte par défaut : le marqueur est traduit au moment de l'envoi", () => {
  beforeEach(ouvrirTout);

  async function creneauMarqueur(reseau: "linkedin" | "instagram"): Promise<string> {
    const id = `cr-marqueur-${reseau}`;
    await depots().creneauxEditoriaux.enregistrer({
      id, jourVise: DEMAIN.slice(0, 10), heuresParReseau: { [reseau]: DEMAIN }, compteCible: "compte-studio", visuelId: "vis_1",
      textes: { [reseau]: { texte: "Légende d'exemple", premierCommentaire: "" } },
      statut: "valide", decalages: 0, valideeLe: VALIDEE, valideePar: "le fondateur",
    } as never);
    return id;
  }

  it("LinkedIn page + profil : canalId, cible et clé d'envoi portent l'id de la page, jamais le marqueur", async () => {
    await creerVisuel();
    const svc = faux();
    const base = svc.listerCanaux!;
    svc.listerCanaux = async () => [...(await base()), { id: "compte-3:li:profil", organisationId: "zernio", nom: "Profil", service: "linkedin", genre: "profile", deconnecte: false } as never];
    const id = await creneauMarqueur("linkedin");
    const r = await pub.envoyerVisuel(svc, id, "linkedin", { lireUrl });
    expect(r.publication.canalId).toBe("compte-1:li:42");
    expect(appels).toHaveLength(1);
    expect(appels[0].cible).toBe("compte-1:li:42");
    expect(appels[0].canalId).toBe("compte-1:li:42");
    expect(appels[0].cleEnvoi).not.toContain("compte-studio");
    expect(r.publication.cleEnvoi).toBe(appels[0].cleEnvoi);
    expect(JSON.stringify(await visuelles())).not.toContain("compte-studio");
  });

  it("porte fermée : ENVOI_CALENDRIER_FERME, aucun appel", async () => {
    await creerVisuel();
    await ecrireParametre(PARAM_ENVOI_CALENDRIER, false);
    const id = await creneauMarqueur("linkedin");
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", { lireUrl })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
  });
});
