/**
 * LOT 4c · branchement du parcours de conversation au démarrage et dans la boucle. Valeurs fictives, aucun réseau.
 * Le test qui échoue si le branchement manque : (a) statique et (b) exécution de `register()`.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot } from "@/services/mots-service";

const lire = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/* ---------------------------------------------------------------------------------------------------------------- */
/* Service : branchements-zernio                                                                                     */
/* ---------------------------------------------------------------------------------------------------------------- */
const PORT_FAUX = { faux: "port" };
const creerPort = vi.fn((_o: unknown) => PORT_FAUX);
const clientFaux = { faux: "client" };
const clientZernio = vi.fn((): unknown => clientFaux);
const traiterConversations = vi.fn(async (_d: unknown) => ({ actif: true, traites: 0, enAttente: 0 }));
const transmettreOppositions = vi.fn(async (_o: unknown) => ({ actif: true, traitees: 0, transmises: 0 }));
const rattraperOppositions = vi.fn(async (_o?: unknown) => 0);
const traiterOppositionsAncien = vi.fn(async () => ({ actif: false, prises: 0, transmises: 0 }));
const appliquerToutArreter = vi.fn(async () => ({ arret: false, pauses: 0 }));
const ordre: string[] = [];

vi.mock("@/fournisseurs/zernio-inbox", () => ({ creerPortInboxZernio: (o: unknown) => creerPort(o) }));
vi.mock("@/services/zernio", async (orig) => ({ ...(await orig<typeof import("@/services/zernio")>()), clientZernio: () => clientZernio() }));
vi.mock("@/services/parcours-conversation", async (orig) => ({ ...(await orig<typeof import("@/services/parcours-conversation")>()), traiterConversations: (d: unknown) => (ordre.push("conversations"), traiterConversations(d)) }));
vi.mock("@/services/oppositions-transmission", async (orig) => ({
  ...(await orig<typeof import("@/services/oppositions-transmission")>()),
  transmettreOppositions: (o: unknown) => (ordre.push("transmettre"), transmettreOppositions(o)),
  rattraperOppositions: (o?: unknown) => (ordre.push("rattraper"), rattraperOppositions(o)),
}));
vi.mock("@/services/mots-service", async (orig) => ({
  ...(await orig<typeof import("@/services/mots-service")>()),
  traiterOppositions: () => (ordre.push("ancien"), traiterOppositionsAncien()),
  appliquerToutArreter: () => (ordre.push("toutArreter"), appliquerToutArreter()),
}));
// Le vrai module, avec un espion sur le passage (même chemin que la boucle : import dynamique de ce module).
const passageEspion = vi.fn<(o?: unknown) => Promise<void>>();
async function fabriqueEspion(orig: <T>() => Promise<T>) {
  const reel = await orig<typeof import("@/services/branchements-zernio")>();
  passageEspion.mockImplementation((o) => reel.passageParcoursZernio(o as never));
  return { ...reel, passageParcoursZernio: (o?: unknown) => passageEspion(o) };
}
vi.mock("@/services/branchements-zernio", fabriqueEspion);
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const B = await import("@/services/branchements-zernio");

const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const ENV_BASE = {
  PARCOURS_CONVERSATION_ENABLED: "1",
  ZERNIO_API_KEY: "cle-fictive-zernio",
  SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-0123456789-0123456789",
  STUDIO_EMPREINTE_SECRET: "secret-fictif-empreinte-0123456789-ab",
  PARCOURS_CONVERSATION_COMPTES: "ig_1, fb_1, ig_hors_lecture",
  PARCOURS_CONVERSATION_TITRE_GUIDE: "Guide fictif",
};
const COMPTES_ZERNIO = { lusLe: "2026-11-07T10:00:00.000Z", comptes: [{ id: "ig_1", reseau: "instagram", nom: "A" }, { id: "fb_1", reseau: "facebook", nom: "B" }, { id: "ig_2", reseau: "instagram", nom: "C" }, { id: "li_1", reseau: "linkedin", nom: "D" }] };
const CLE_GLOBALE = Symbol.for("studio-axion-ia.branchements-zernio");
const razGlobale = () => delete (globalThis as Record<symbol, unknown>)[CLE_GLOBALE];
const instantane = async () => JSON.stringify({ p: await depots().parametres.lister(), e: await depots().evenementsFournisseurs.lister(() => true) });
const reseau = vi.fn(async () => new Response("{}"));
let jeu = 0;

beforeEach(async () => {
  reinitialiserDepots();
  razGlobale();
  ordre.length = 0;
  vi.clearAllMocks();
  jeu = 0;
  vi.stubGlobal("fetch", reseau);
  await ecrireParametre("zernio.comptes", COMPTES_ZERNIO);
});
afterEach(() => vi.unstubAllGlobals());
/** Chaque appel de `passage` tombe 1 min après le précédent (le plafond de 15 s ne gêne pas). */
const passage = (env: Record<string, string | undefined>, plus = 0) => B.passageParcoursZernio({ env, maintenantMs: T0 + plus + jeu++ * 60_000 });
const alertes = async () => (await depots().notifications.lister(() => true)).filter((n) => n.lien === "/mots");

describe("brancherParcoursZernio", () => {
  it("double appel : un seul état, aucun réseau, aucun interrupteur allumé", () => {
    const env: Record<string, string | undefined> = { ...ENV_BASE, PARCOURS_CONVERSATION_ENABLED: undefined };
    const a = B.brancherParcoursZernio(env);
    const etat1 = JSON.stringify(B.etatBranchementZernio());
    const b = B.brancherParcoursZernio(env);
    expect(JSON.stringify(B.etatBranchementZernio())).toBe(etat1);
    expect(a).toEqual(b);
    expect((globalThis as Record<symbol, unknown>)[CLE_GLOBALE]).toBeDefined();
    expect(reseau).not.toHaveBeenCalled();
    expect(creerPort).not.toHaveBeenCalled();
    expect(env.PARCOURS_CONVERSATION_ENABLED).toBeUndefined();
    expect(process.env.PARCOURS_CONVERSATION_ENABLED).toBeUndefined();
  });

  it("état lisible : des booléens et des codes, jamais une valeur de secret", () => {
    const etat = B.brancherParcoursZernio(ENV_BASE);
    expect(etat).toMatchObject({ branche: true, cleZernio: true, secretSite: true, cleEmpreinte: true, comptesEnvoi: true, titreGuide: true });
    const texte = JSON.stringify(B.etatBranchementZernio());
    for (const v of ["cle-fictive-zernio", "secret-fictif", "Guide fictif", "ig_1"]) expect(texte).not.toContain(v);
    razGlobale();
    const vide = B.brancherParcoursZernio({});
    expect(vide).toMatchObject({ cleZernio: false, secretSite: false, cleEmpreinte: false, comptesEnvoi: false, titreGuide: false });
    expect(B.etatBranchementZernio()?.codes.length).toBeGreaterThan(0);
  });

  it("n'importe ni zernio-inbox ni le client au chargement", () => {
    B.brancherParcoursZernio(ENV_BASE);
    expect(creerPort).not.toHaveBeenCalled();
    expect(clientZernio).not.toHaveBeenCalled();
    expect(lire("src/services/branchements-zernio.ts")).not.toMatch(/^import[^\n]*zernio-inbox/m);
  });
});

describe("passageParcoursZernio", () => {
  it("interrupteur éteint et file vide : ni port ni client, paramètres et événements identiques à l'octet près", async () => {
    B.brancherParcoursZernio({ ...ENV_BASE, PARCOURS_CONVERSATION_ENABLED: undefined });
    await depots().evenementsFournisseurs.enregistrer({ id: "ev1", fournisseur: "zernio", type: "zernio.commentaire", idEvenement: "e1", recuLe: "2026-11-07T10:00:00.000Z", creeLe: "2026-11-07T10:00:00.000Z", modifieLe: "2026-11-07T10:00:00.000Z", traite: false, charge: { idCommentaire: "c1" } } as never);
    const avant = await instantane();
    await passage({ ...ENV_BASE, PARCOURS_CONVERSATION_ENABLED: "" });
    await passage({ ...ENV_BASE, PARCOURS_CONVERSATION_ENABLED: undefined });
    expect(creerPort).not.toHaveBeenCalled();
    expect(clientZernio).not.toHaveBeenCalled();
    expect(traiterConversations).not.toHaveBeenCalled();
    expect(traiterOppositionsAncien).not.toHaveBeenCalled();
    expect(await instantane()).toBe(avant);
    expect(reseau).not.toHaveBeenCalled();
  });

  it("interrupteur éteint mais une opposition attend dans la file : elle continue d'être transmise", async () => {
    B.brancherParcoursZernio(ENV_BASE);
    await ecrireParametre("parcours.oppositions.file", { cle1: { etat: "a_transmettre", cleIdempotence: "k", reseau: "instagram", creeLe: "2026-11-07T10:00:00.000Z", essais: 0, prochainEssaiLe: null, dernierCode: null, depuis: "x", lectures: 0 } });
    await passage({ ...ENV_BASE, PARCOURS_CONVERSATION_ENABLED: undefined });
    expect(transmettreOppositions).toHaveBeenCalledTimes(1);
    expect(traiterConversations).not.toHaveBeenCalled();
  });

  it("interrupteur allumé SANS branchement : une alerte (1/h), rien traité", async () => {
    await passage(ENV_BASE);
    await passage(ENV_BASE);
    expect(creerPort).not.toHaveBeenCalled();
    expect(traiterConversations).not.toHaveBeenCalled();
    expect(await alertes()).toHaveLength(1);
    // plus d'une heure plus tard : une nouvelle alerte
    await passage(ENV_BASE, 3600_000 + 120_000);
    expect(await alertes()).toHaveLength(2);
  });

  const FILE_STOP = { cle1: { etat: "a_transmettre", cleIdempotence: "k", reseau: "instagram", creeLe: "2026-11-07T10:00:00.000Z", essais: 0, prochainEssaiLe: null, dernierCode: null, depuis: "x", lectures: 0 } };
  it.each([
    ["liste d'envoi vide", { PARCOURS_CONVERSATION_COMPTES: "" }],
    ["aucun compte d'envoi n'est un compte de lecture", { PARCOURS_CONVERSATION_COMPTES: "li_1, inconnu" }],
    ["titre du guide absent", { PARCOURS_CONVERSATION_TITRE_GUIDE: "  " }],
  ])("%s : alerte, aucune conversation ni envoi, mais un « stop » en file est transmis", async (_nom, surcharge) => {
    const env = { ...ENV_BASE, ...surcharge };
    B.brancherParcoursZernio(env);
    await ecrireParametre("parcours.conversations", { cle1: { etat: "attente_email", m1Le: "2026-11-07T09:00:00.000Z" } });
    await ecrireParametre("parcours.oppositions.file", FILE_STOP);
    const avant = JSON.stringify(await lireParametre("parcours.conversations", {}));
    await passage(env);
    expect(traiterConversations).not.toHaveBeenCalled();
    expect(transmettreOppositions).toHaveBeenCalledTimes(1);
    expect(rattraperOppositions).toHaveBeenCalledTimes(1);
    // Le port existe, mais sans liste d'envoi (aucune écriture possible) quand la liste est vide.
    const o = creerPort.mock.calls[0][0] as { comptesPermis: string[]; comptesLecture: string[] };
    if (!("PARCOURS_CONVERSATION_TITRE_GUIDE" in surcharge)) expect(o.comptesPermis).toEqual([]);
    expect(o.comptesLecture).toEqual(["ig_1", "fb_1", "ig_2"]);
    expect(JSON.stringify(await lireParametre("parcours.conversations", {}))).toBe(avant);
    expect(await alertes()).toHaveLength(1);
    expect(JSON.stringify(await alertes())).not.toMatch(/m1_refuse/);
    expect(reseau).not.toHaveBeenCalled();
  });

  it("titre absent : le port refuse aussi toute écriture (aucune écriture ne passe), les « stop » sont transmis", async () => {
    const env = { ...ENV_BASE, PARCOURS_CONVERSATION_TITRE_GUIDE: "" };
    B.brancherParcoursZernio(env);
    await ecrireParametre("parcours.oppositions.file", FILE_STOP);
    await passage(env);
    expect(transmettreOppositions).toHaveBeenCalledTimes(1);
    expect(traiterConversations).not.toHaveBeenCalled();
  });

  it("le port construit avec une liste d'envoi vide refuse toute écriture, sans appel réseau", async () => {
    const { creerPortInboxZernio } = await vi.importActual<typeof import("@/fournisseurs/zernio-inbox")>("@/fournisseurs/zernio-inbox");
    const requete = vi.fn(async () => ({ statut: 200, corps: {}, entetes: {} }));
    const port = creerPortInboxZernio({ client: { requete } as never, comptesPermis: [], comptesLecture: ["ig_1"] });
    // Le client réel refuse (liste fermée absente) ; ici le faux client doit au moins recevoir une liste vide.
    await port.envoyerMessage({ idCompte: "ig_1", idConversation: "cv", texte: "Bonjour", cle: "k" } as never);
    const req = requete.mock.calls[0] as unknown as [{ comptesPermis: string[] }];
    expect(req[0].comptesPermis).toEqual([]);
  });

  it("compte de lecture disparu et « stop » en file : alerte « opposition en attente », entrée conservée, aucun envoi", async () => {
    await ecrireParametre("zernio.comptes", { lusLe: "x", comptes: [] });
    B.brancherParcoursZernio(ENV_BASE);
    await ecrireParametre("parcours.oppositions.file", FILE_STOP);
    await passage(ENV_BASE);
    expect(traiterConversations).not.toHaveBeenCalled();
    expect((creerPort.mock.calls[0][0] as { comptesPermis: string[]; comptesLecture: string[] })).toMatchObject({ comptesPermis: [], comptesLecture: [] });
    expect(transmettreOppositions).toHaveBeenCalledTimes(1);
    const textes = JSON.stringify(await alertes());
    expect(textes).toMatch(/Opposition en attente/);
    expect(await lireParametre("parcours.oppositions.file", {})).toEqual(FILE_STOP);
    expect(reseau).not.toHaveBeenCalled();
  });

  it("au plus un passage toutes les 15 s", async () => {
    B.brancherParcoursZernio(ENV_BASE);
    await B.passageParcoursZernio({ env: ENV_BASE, maintenantMs: T0 });
    await B.passageParcoursZernio({ env: ENV_BASE, maintenantMs: T0 + 14_999 });
    expect(traiterConversations).toHaveBeenCalledTimes(1);
    await B.passageParcoursZernio({ env: ENV_BASE, maintenantMs: T0 + 15_000 });
    expect(traiterConversations).toHaveBeenCalledTimes(2);
  });

  it("allumé et branché : même liste de lecture pour le service et le port, envoi = liste ∩ lecture, ordre fixe", async () => {
    B.brancherParcoursZernio(ENV_BASE);
    await passage(ENV_BASE);
    expect(creerPort).toHaveBeenCalledTimes(1);
    const o = creerPort.mock.calls[0][0] as { client: unknown; comptesPermis: string[]; comptesLecture: string[]; domainesPermis: string[]; titresGuidesPermis: string[] };
    expect(o.client).toBe(clientFaux);
    expect(o.comptesLecture).toEqual(["ig_1", "fb_1", "ig_2"]);
    expect(o.comptesPermis).toEqual(["ig_1", "fb_1"]);
    expect(o.titresGuidesPermis).toEqual(["Guide fictif"]);
    expect(o.domainesPermis).toEqual(["axion-ia.com"]);
    const d = traiterConversations.mock.calls[0][0] as { port: unknown; comptesPermis: string[]; comptesLecture: string[]; titreGuide: string };
    expect(d.port).toBe(PORT_FAUX);
    expect(d.comptesLecture).toEqual(o.comptesLecture);
    expect(d.comptesPermis).toEqual(o.comptesPermis);
    expect(d.titreGuide).toBe("Guide fictif");
    expect((transmettreOppositions.mock.calls[0][0] as { port: unknown }).port).toBe(PORT_FAUX);
    expect(ordre).toEqual(["toutArreter", "conversations", "transmettre", "rattraper", "ancien"]);
  });

  it("clé Zernio absente : alerte et rien n'est traité (le client refuse)", async () => {
    B.brancherParcoursZernio(ENV_BASE);
    clientZernio.mockImplementationOnce(() => {
      throw new Error("ZERNIO_NON_RELIE");
    });
    await passage(ENV_BASE);
    expect(traiterConversations).not.toHaveBeenCalled();
    expect(await alertes()).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------------------------------------------------------- */
/* Boutons « Activer » / « Mettre en pause » de l'écran /mots (lignes locales)                                        */
/* ---------------------------------------------------------------------------------------------------------------- */
describe("écran /mots : boutons du mot GUIDE local", () => {
  const vide = { interrupteurAllume: true, toutArrete: false, disjoncteur: { ouvert: false, raison: null, ouvertLe: null }, plafonds: { heureCompte: 600, jourMot: 1000 }, lignes: [] as LigneMot[], oppositions: 0, parcoursAllume: false, oppositionsNonTransmises: 0 };
  const local = (etat: LigneMot["etat"]): LigneMot => ({ mot: "GUIDE", compte: "c1", etat, idWorkflow: null, raison: "local", modifieLe: "" });
  const services = { mettreEnPause: vi.fn(), reactiver: vi.fn(), refermerDisjoncteur: vi.fn(), reglerPlafonds: vi.fn(), activerLocal: vi.fn(), mettreEnPauseLocal: vi.fn() };

  it("ligne locale en pause : « Activer » ; ligne locale active : « Mettre en pause » ; ligne Zernio : boutons habituels", async () => {
    const { EcranMots } = await import("@/components/mots/EcranMots");
    const rendu = (l: LigneMot) => renderToStaticMarkup(createElement(EcranMots, { vue: { ...vide, guideValide: false, guidePerime: false, lignes: [l] }, services }));
    expect(rendu(local("pause"))).toContain(">Activer<");
    expect(rendu(local("pause"))).not.toContain("Réactiver");
    expect(rendu(local("actif"))).toContain("Mettre en pause");
    expect(rendu({ ...local("pause"), idWorkflow: "wf_1" })).toContain("Réactiver");
    expect(rendu({ ...local("pause"), idWorkflow: "wf_1" })).not.toContain(">Activer<");
  });

  it("sans confirmation de l'opérateur, aucun geste n'est appelé ; avec, l'appel part", async () => {
    const { creerGestesMotLocal } = await import("@/components/mots/gestes-mot-local");
    const s = { activerLocal: vi.fn(async () => ({ issue: "execute" as const, raison: "activation_locale" })), mettreEnPauseLocal: vi.fn(async () => ({ issue: "execute" as const, raison: "pause" })) };
    const apres = vi.fn();
    const non = creerGestesMotLocal(s, { confirmer: () => false, apres });
    await non.activer("c1");
    await non.pause("GUIDE", "c1");
    expect(s.activerLocal).not.toHaveBeenCalled();
    expect(s.mettreEnPauseLocal).not.toHaveBeenCalled();
    const oui = creerGestesMotLocal(s, { confirmer: () => true, apres });
    await oui.activer("c1");
    await oui.pause("GUIDE", "c1");
    expect(s.activerLocal).toHaveBeenCalledWith("c1");
    expect(s.mettreEnPauseLocal).toHaveBeenCalledWith("GUIDE", "c1");
    expect(apres).toHaveBeenCalledTimes(2);
  });

  it("gestes serveur : session exigée (refus propagé), refus sans validation, pause sans réseau", async () => {
    const auth = await import("@/services/auth");
    const Ges = await import("@/services/mots-gestes");
    const S = await import("@/services/mots-service");
    const appels: unknown[] = [];
    S.injecterExecuteurMots(async (r) => (appels.push(r), { statut: 200, corps: {} }));
    vi.mocked(auth.exigerSession).mockRejectedValueOnce(new Error("session"));
    await expect(Ges.gesteActiverMotLocal("c1")).rejects.toThrow();
    vi.mocked(auth.exigerSession).mockRejectedValueOnce(new Error("session"));
    await expect(Ges.gesteMettreEnPauseLocal("GUIDE", "c1")).rejects.toThrow();
    expect(await lireParametre(S.PARAM_REGISTRE_MOTS, {})).toEqual({});
    expect(await S.activerMotLocal({ mot: "GUIDE", compte: "c1", confirmeParOperateur: false, env: { MOTS_ENABLED: "1" } })).toMatchObject({ issue: "refuse", raison: "validation_operateur_absente" });
    await ecrireParametre(S.PARAM_REGISTRE_MOTS, { "GUIDE|c1": local("actif") });
    expect(await Ges.gesteMettreEnPauseLocal("GUIDE", "c1")).toMatchObject({ issue: "execute" });
    expect(appels).toHaveLength(0);
    expect(reseau).not.toHaveBeenCalled();
    S.injecterExecuteurMots(null);
  });
});

/* ---------------------------------------------------------------------------------------------------------------- */
/* Mineurs de la relecture de #203 ((c) : voir oppositions-transmission.test.ts)                                      */
/* ---------------------------------------------------------------------------------------------------------------- */
describe("mineurs #203", () => {
  it("(a) mettreEnPauseLocal refuse une ligne qui a un idWorkflow (ligne Zernio)", async () => {
    const S = await import("@/services/mots-service");
    await ecrireParametre(S.PARAM_REGISTRE_MOTS, { "GUIDE|c1": { mot: "GUIDE", compte: "c1", etat: "actif", idWorkflow: "wf_1", raison: null, modifieLe: "" } });
    const r = await S.mettreEnPauseLocal({ mot: "GUIDE", compte: "c1", confirmeParOperateur: true, env: {} });
    expect(r.issue).toBe("refuse");
    expect((await lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {}))["GUIDE|c1"].etat).toBe("actif");
  });

  it("(b) échec fermé : idWorkflow vide est une ligne locale, jamais traité comme une ligne Zernio", () => {
    expect(lire("src/services/mots-service.ts")).not.toMatch(/ligne\.idWorkflow === null/);
    expect(lire("src/services/mots-service.ts")).toMatch(/!ligne\.idWorkflow/);
  });
});

// Ces blocs réinitialisent le registre des modules : ils passent en DERNIER.
/* ---------------------------------------------------------------------------------------------------------------- */
/* Boucle : contenuDuTour                                                                                             */
/* ---------------------------------------------------------------------------------------------------------------- */
/** L'annexe part hors du tour : on attend (au plus 3 s) qu'elle ait tourné. */
const attendre = async (condition: () => boolean) => {
  for (let n = 0; n < 300 && !condition(); n++) await new Promise((r) => setTimeout(r, 10));
};
describe("contenuDuTour lance l'annexe", () => {
  it("une fois par tour, et une erreur ne casse pas le tour", async () => {
    // Les tests de register() ont retiré la doublure du module : on la repose, puis on recharge la boucle.
    vi.resetModules();
    vi.doMock("@/services/branchements-zernio", fabriqueEspion);
    const boucle = await import("@/services/boucle");
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    passageEspion.mockResolvedValueOnce(undefined);
    const options = { synchroBuffer: async () => undefined, synchroZernio: async () => undefined };
    await boucle.contenuDuTour(options);
    await attendre(() => passageEspion.mock.calls.length >= 1);
    expect(passageEspion).toHaveBeenCalledTimes(1);
    passageEspion.mockRejectedValueOnce(new Error("panne fictive"));
    await expect(boucle.contenuDuTour(options)).resolves.toBeUndefined();
    await attendre(() => passageEspion.mock.calls.length >= 2);
    await attendre(() => erreurs.mock.calls.some((c) => String(c[0]).includes("parcours de conversation")));
    expect(passageEspion).toHaveBeenCalledTimes(2);
    expect(erreurs.mock.calls.some((c) => String(c[0]).includes("parcours de conversation"))).toBe(true);
    erreurs.mockRestore();
    vi.doUnmock("@/services/branchements-zernio");
  }, 30_000);
});

/* ---------------------------------------------------------------------------------------------------------------- */
/* (a) statique, (b) exécution de register()                                                                         */
/* ---------------------------------------------------------------------------------------------------------------- */
describe("instrumentation.ts : le branchement est présent", () => {
  it("(a) statique : import de @/services/branchements-zernio et appel brancherParcoursZernio( dans register", () => {
    const code = lire("src/instrumentation.ts");
    expect(code).toMatch(/import\(\s*["']@\/services\/branchements-zernio["']\s*\)/);
    expect(code).toMatch(/brancherParcoursZernio\(/);
    // Appelé AVANT le démarrage de la boucle, hors du bloc DATABASE_URL.
    expect(code.indexOf("brancherParcoursZernio(")).toBeLessThan(code.indexOf("demarrerBoucleUnique("));
    const bloc = code.slice(code.indexOf("if (process.env.DATABASE_URL)"), code.indexOf("const lancerAvecLeVerrou"));
    expect(bloc).not.toMatch(/brancherParcoursZernio/);
  });

  it("(b) exécution : register() appelle brancherParcoursZernio exactement une fois (sans DATABASE_URL)", async () => {
    vi.resetModules();
    const brancher = vi.fn();
    vi.doMock("@/lib/demarrage", () => ({ avecReessais: vi.fn(), refusDemarrageSansBase: () => null, refusRenduSansCle: () => null }));
    vi.doMock("@/services/boucle", () => ({ demarrerBoucleUnique: vi.fn(async () => false) }));
    vi.doMock("@/services/branchements-zernio", () => ({ brancherParcoursZernio: brancher }));
    const avant = { runtime: process.env.NEXT_RUNTIME, base: process.env.DATABASE_URL };
    process.env.NEXT_RUNTIME = "nodejs";
    delete process.env.DATABASE_URL;
    try {
      const { register } = await import("@/instrumentation");
      await register();
      expect(brancher).toHaveBeenCalledTimes(1);
    } finally {
      if (avant.runtime === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = avant.runtime;
      if (avant.base !== undefined) process.env.DATABASE_URL = avant.base;
      vi.doUnmock("@/lib/demarrage");
      vi.doUnmock("@/services/boucle");
      vi.doUnmock("@/services/branchements-zernio");
      vi.resetModules();
    }
  });

  it("un échec du branchement ne bloque pas le démarrage : code seulement dans le journal", async () => {
    vi.resetModules();
    const demarrer = vi.fn(async () => false);
    vi.doMock("@/lib/demarrage", () => ({ avecReessais: vi.fn(), refusDemarrageSansBase: () => null, refusRenduSansCle: () => null }));
    vi.doMock("@/services/boucle", () => ({ demarrerBoucleUnique: demarrer }));
    vi.doMock("@/services/branchements-zernio", () => ({
      brancherParcoursZernio: () => {
        throw new Error("secret-fictif-ne-doit-pas-sortir");
      },
    }));
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const avant = process.env.DATABASE_URL;
    const runtimeAvant = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    delete process.env.DATABASE_URL;
    try {
      const { register } = await import("@/instrumentation");
      await register();
      expect(demarrer).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(erreurs.mock.calls)).not.toContain("secret-fictif");
    } finally {
      if (avant !== undefined) process.env.DATABASE_URL = avant;
      if (runtimeAvant !== undefined) process.env.NEXT_RUNTIME = runtimeAvant;
      else delete process.env.NEXT_RUNTIME;
      erreurs.mockRestore();
      vi.doUnmock("@/lib/demarrage");
      vi.doUnmock("@/services/boucle");
      vi.doUnmock("@/services/branchements-zernio");
      vi.resetModules();
    }
  });

  it("boucle.ts lance l'annexe « parcours de conversation » via branchements-zernio, jamais le service ni le port", () => {
    const code = lire("src/services/boucle.ts");
    expect(code).toMatch(/lancerAnnexe\(\s*"parcours de conversation"[\s\S]*?import\(\s*"\.\/branchements-zernio"\s*\)[\s\S]*?passageParcoursZernio\(\)/);
    for (const f of ["src/services/boucle.ts", "src/instrumentation.ts"]) {
      expect(lire(f)).not.toMatch(/parcours-conversation|zernio-inbox/);
    }
  });
});

