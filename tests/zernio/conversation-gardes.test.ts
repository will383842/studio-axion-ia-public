/** Lot 3a · interrupteur et gardes avant toute action sortante (18). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Z = await import("@/services/zernio");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (over: Partial<Parameters<typeof C.traiterConversations>[0]> = {}, ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms, ...over });
const registre = (etat: string) => Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat, idWorkflow: null, raison: null, modifieLe: "x" } });

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await registre("actif");
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

const cas: Array<[string, () => Promise<void>, Partial<Parameters<typeof C.traiterConversations>[0]>]> = [
  ["Tout arrêter", () => Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, false), {}],
  ["disjoncteur fermé (ouvert)", () => Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } }), {}],
  ["mot inactif", () => registre("pause"), {}],
  ["compte hors liste", async () => undefined, { comptesPermis: ["autre-compte"] }],
];

describe("18 · interrupteur absent : aucun appel, aucune écriture d'état", () => {
  it("sans PARCOURS_CONVERSATION_ENABLED (commentaire et message)", async () => {
    const c = await deposerCommentaire(depots, {});
    const m = await deposerMessage(depots, {});
    const avantParams = JSON.stringify(await depots().parametres.lister(() => true));
    const avantEvts = JSON.stringify(await depots().evenementsFournisseurs.lister(() => true));
    const rap = await passer({ env: { ...ENV, PARCOURS_CONVERSATION_ENABLED: undefined } });
    expect(rap.actif).toBe(false);
    expect(port.total()).toBe(0);
    expect(site.vus).toHaveLength(0);
    expect(JSON.stringify(await depots().parametres.lister(() => true))).toBe(avantParams);
    expect(JSON.stringify(await depots().evenementsFournisseurs.lister(() => true))).toBe(avantEvts);
    expect((await evenement(depots, c)).traite).toBe(false);
    expect((await evenement(depots, m)).traite).toBe(false);
    expect(C.parcoursConversationActif({})).toBe(false);
    expect(C.parcoursConversationActif({ PARCOURS_CONVERSATION_ENABLED: "0" })).toBe(false);
  });
});

describe.each(cas)("18 · %s", (_nom, regler, over) => {
  it("commentaire : 0 appel, événement conservé à faire", async () => {
    await regler();
    const id = await deposerCommentaire(depots, {});
    const rap = await passer(over);
    expect(port.total()).toBe(0);
    expect((await evenement(depots, id)).traite).toBe(false);
    expect(rap.enAttente).toBe(1);
    // l'alerte part au plus une fois par heure
    await passer(over, T0 + 1000);
    const alertes = await depots().evenements.lister((e: any) => /ALERTE/.test(e.message));
    expect(alertes).toHaveLength(1);
  });
  it("message : la lecture a lieu (pour y repérer un stop) mais rien ne part : 0 envoi, site non appelé", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation("auteur-fictif-400")]: { etat: "attente_email", reseau: "instagram", idCompte: COMPTE, idCommentaire: "c", idPostPlateforme: "p", versionTexteM1: "mp-m1-v2", guide: "guide-ia", cleIdempotenceGuide: "c".repeat(64), creeLe: new Date(T0).toISOString(), m1Le: new Date(T0).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [] } });
    await regler();
    const id = await deposerMessage(depots, {});
    await passer(over);
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
    expect(site.vus).toHaveLength(0);
    expect((await evenement(depots, id)).traite).toBe(false);
  });
  it("message « stop » : lu et enregistré MÊME garde active, sans aucun envoi", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation("auteur-fictif-400")]: { etat: "attente_email", reseau: "instagram", idCompte: COMPTE, idCommentaire: "c", idPostPlateforme: "p", versionTexteM1: "mp-m1-v2", guide: "guide-ia", cleIdempotenceGuide: "c".repeat(64), creeLe: new Date(T0).toISOString(), m1Le: new Date(T0).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [] } });
    await regler();
    port.reponses.texte = () => "stop";
    const id = await deposerMessage(depots, {});
    await passer(over);
    expect(port.lire).toBe(1);
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
    expect(site.vus).toHaveLength(0);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "oppose" });
    const conv = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
    expect(conv[cleConversation("auteur-fictif-400")].etat).toBe("oppose");
  });
});
