/** Lot 3a · interrupteur et gardes avant toute action sortante (18). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

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

describe("B1 · validation du GUIDE revérifiée avant tout envoi", () => {
  const alertes = () => depots().evenements.lister((e: { message: string }) => /ALERTE/.test(e.message));
  it("titre changé après validation : aucun appel, événement reporté, une alerte ; après revalidation l'envoi repart", async () => {
    await validerGuideAuParcours(TITRE);
    const id = await deposerCommentaire(depots, {});
    const rap = await passer({ titreGuide: "Autre titre fictif" });
    expect(port.total()).toBe(0);
    expect(site.vus).toHaveLength(0);
    expect((await evenement(depots, id)).traite).toBe(false);
    expect(rap.enAttente).toBe(1);
    await passer({ titreGuide: "Autre titre fictif" }, T0 + 1000);
    const a = await alertes();
    expect(a).toHaveLength(1);
    expect(a[0].message).toMatch(/Les textes du mot GUIDE ont changé/);
    await validerGuideAuParcours("Autre titre fictif");
    await passer({ titreGuide: "Autre titre fictif" }, T0 + 120_000);
    expect(port.pub.length).toBeGreaterThan(0);
  });
  it("jamais validé : aucun envoi", async () => {
    const id = await deposerCommentaire(depots, {});
    await passer();
    expect(port.total()).toBe(0);
    expect((await evenement(depots, id)).traite).toBe(false);
  });
  it("validation enregistrée avec une fausse empreinte (écrite directement) : aucun envoi", async () => {
    await Com.ecrireParametre(MS.PARAM_VALIDATION_GUIDE_PARCOURS, { empreinte: "f".repeat(64), valideLe: "x" });
    const id = await deposerCommentaire(depots, {});
    await passer();
    expect(port.total()).toBe(0);
    expect((await evenement(depots, id)).traite).toBe(false);
  });
  it("titre avec espaces côté serveur : même empreinte que la validation, l'envoi part", async () => {
    await MS.validerGuideParcours({ titre: `  ${TITRE}  `.trim(), confirmeParOperateur: true });
    await deposerCommentaire(depots, {});
    await passer({ titreGuide: TITRE });
    expect(port.pub.length).toBeGreaterThan(0);
  });
  it("validé et titre inchangé : l'envoi part", async () => {
    await validerGuideAuParcours(TITRE);
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.pub.length).toBeGreaterThan(0);
  });
});

describe("B2 · liste des comptes", () => {
  it("la garde refuse un compte actif hors comptesPermis (validation en règle)", async () => {
    await validerGuideAuParcours(TITRE);
    await deposerCommentaire(depots, {});
    await passer({ comptesPermis: ["autre-compte"] });
    expect(port.total()).toBe(0);
    const a = await depots().evenements.lister((e: { message: string }) => /pas dans la liste autorisée/.test(e.message));
    expect(a).toHaveLength(1);
  });
  it("ligne active, compte retiré : pause_auto ; compte réajouté + passage complet : aucun envoi, reste pause_auto ; après Réactiver l'envoi repart", async () => {
    await validerGuideAuParcours(TITRE);
    const sans = { ...ENV, MOTS_ENABLED: "1", PARCOURS_CONVERSATION_COMPTES: "autre-compte", PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE };
    await MS.pauserGuidesHorsListe(sans);
    const lire = async () => (await Com.lireParametre<Record<string, { etat: string }>>(MS.PARAM_REGISTRE_MOTS, {}))[`GUIDE|${COMPTE}`].etat;
    expect(await lire()).toBe("pause_auto");
    const avec = { ...sans, PARCOURS_CONVERSATION_COMPTES: `autre-compte,${COMPTE}` };
    await MS.pauserGuidesHorsListe(avec);
    await deposerCommentaire(depots, {});
    await passer({ env: avec });
    expect(port.total()).toBe(0);
    expect(await lire()).toBe("pause_auto");
    const r = await MS.reactiverMot({ mot: "GUIDE", compte: COMPTE, confirmeParOperateur: true, env: avec });
    expect(r.issue).toBe("execute");
    await passer({ env: avec }, T0 + 120_000);
    expect(port.pub.length).toBeGreaterThan(0);
  });
});
