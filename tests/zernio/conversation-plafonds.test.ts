/** Lot 4b · plafonds d'envoi du parcours de conversation. Données 100 % fictives ; port et site FAUX. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOT_MAX_PAR_PASSAGE_CONVERSATION, PLAFOND_CONVERSATION_HEURE_COMPTE_DEFAUT, PLAFOND_HEURE_COMPTE_MAX, plafondHeureCompte } from "@/domaine/guide-reseau/plafonds-conversation";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const COMPTE2 = "compte-fictif-101";
const H = 3600_000;
const HEURE = Math.floor(T0 / H) * H;
const PARAM_COMPTEURS = "parcours.conversations.compteurs";
const PARAM_PLAFONDS = "parcours.conversations.plafonds";
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0, over: Partial<Parameters<typeof C.traiterConversations>[0]> = {}) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE, COMPTE2], titreGuide: TITRE, env: ENV, maintenantMs: ms, ...over });
const compteurs = () => Com.lireParametre<Record<string, any>>(PARAM_COMPTEURS, {});
const semerCompteur = (idCompte: string, envois: number) => Com.ecrireParametre(PARAM_COMPTEURS, { [idCompte]: { heure: HEURE, envois } });
const tout = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const etatDe = async (id: string) => (await tout())[cleConversation(id)];
const alertes = async () => (await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).length;
const envois = () => port.pub.length + port.prive.length + port.envoyes.length;
const A = "auteur-fictif-400";
const registre = () => Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, Object.fromEntries([COMPTE, COMPTE2].map((c) => [`GUIDE|${c}`, { mot: "GUIDE", compte: c, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" }])));
const graine = (etat: string, extra: Record<string, unknown> = {}) => ({
  etat, reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0 - 50 * H).toISOString(), m1Le: null, occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [], ...extra,
});
const semer = async (id: string, etat: string, extra: Record<string, unknown> = {}) => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await tout()), [cleConversation(id)]: graine(etat, extra) });

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await registre();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("module pur", () => {
  it("défaut 30, maximum 600, lot de 20 ; réglage borné ; invalide = défaut", () => {
    expect(PLAFOND_CONVERSATION_HEURE_COMPTE_DEFAUT).toBe(30);
    expect(PLAFOND_HEURE_COMPTE_MAX).toBe(600);
    expect(LOT_MAX_PAR_PASSAGE_CONVERSATION).toBe(20);
    expect(plafondHeureCompte(undefined)).toBe(30);
    expect(plafondHeureCompte(1000)).toBe(600);
    expect(plafondHeureCompte(50)).toBe(50);
    expect(plafondHeureCompte({ heureCompte: 1000 })).toBe(600);
    for (const mauvais of ["abc", -5, 0, NaN, null, {}, []]) expect(plafondHeureCompte(mauvais)).toBe(30);
  });
});

describe("plafond d'envoi par heure et par compte", () => {
  it("le 31e envoi de l'heure est reporté sans consommer d'essai, et part l'heure suivante", async () => {
    await semerCompteur(COMPTE, 30);
    const id = await deposerCommentaire(depots, {});
    const rap = await passer();
    expect(envois()).toBe(0);
    expect(rap.enAttente).toBe(1);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ dernierCode: "plafond_heure", prochainEssaiLe: HEURE + H });
    expect((await etatDe(A)).essaisPub).toBe(0);
    expect((await compteurs())[COMPTE].envois).toBe(30); // une envoi refusé ne se compte pas
    await passer(T0 + 30 * 60_000); // même heure : rien ne part
    expect(envois()).toBe(0);
    await passer(HEURE + H + 1000);
    expect(port.pub.length).toBe(1);
    expect(port.prive.length).toBe(1);
    expect((await compteurs())[COMPTE]).toEqual({ heure: HEURE + H, envois: 2 });
  });

  it("deux comptes = deux compteurs", async () => {
    await semerCompteur(COMPTE, 30);
    await deposerCommentaire(depots, { idAuteur: "auteur-a", idCompte: COMPTE });
    await deposerCommentaire(depots, { idAuteur: "auteur-b", idCompte: COMPTE2 });
    await passer();
    expect(port.pub.length).toBe(1); // seul le compte 2 envoie
    const c = await compteurs();
    expect(c[COMPTE].envois).toBe(30);
    expect(c[COMPTE2].envois).toBe(2);
  });

  it("réservation AVANT l'envoi : un port qui plante compte quand même", async () => {
    port.port.repondreCommentaire = async () => {
      throw new Error("panne fictive");
    };
    await deposerCommentaire(depots, {});
    await passer();
    // la réponse publique plante (rien n'est vu par le faux port) : elle est comptée quand même, en plus des envois visibles
    expect((await compteurs())[COMPTE].envois).toBe(1 + port.prive.length);
  });

  it("plafond réglé à 1000 : borné à 600 ; réglé à 5 : 5 ; invalide : 30", async () => {
    await Com.ecrireParametre(PARAM_PLAFONDS, 1000);
    await semerCompteur(COMPTE, 600);
    const id = await deposerCommentaire(depots, {});
    await passer();
    expect(envois()).toBe(0);
    expect((await evenement(depots, id)).charge.dernierCode).toBe("plafond_heure");
    await Com.ecrireParametre(PARAM_PLAFONDS, 5);
    await semerCompteur(COMPTE, 5);
    await passer(HEURE + 1000 + 0 * H, { maintenantMs: T0 + 1000 });
    await Com.ecrireParametre(PARAM_PLAFONDS, "n'importe quoi");
    await semerCompteur(COMPTE, 30);
    await deposerCommentaire(depots, { idAuteur: "auteur-b" });
    await passer(T0 + 2000);
    expect(envois()).toBe(0); // 30 atteint : le défaut s'applique
  });

  it("plafond par passage : 25 dus → 20 traités, 5 restent dus", async () => {
    await Com.ecrireParametre(PARAM_PLAFONDS, 600);
    for (let i = 0; i < 25; i++) await deposerCommentaire(depots, { idAuteur: `auteur-${i}` });
    const rap = await passer();
    expect(rap.traites).toBe(20);
    const restants = await depots().evenementsFournisseurs.lister((e: any) => !e.traite);
    expect(restants.length).toBe(5);
    expect(restants.every((e: any) => e.charge.etat === "a_faire")).toBe(true);
    const rap2 = await passer(T0 + 1000);
    expect(rap2.traites).toBe(5);
  });

  it("plafond atteint : aucun changement d'état (pas de m1_en_vol), disjoncteur fermé, aucun essai consommé", async () => {
    await semerCompteur(COMPTE, 29); // la réponse publique passe, M1 est refusé par le plafond
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.pub.length).toBe(1);
    expect(port.prive.length).toBe(0);
    const e = await etatDe(A);
    expect(e.etat).toBe("pub_ok");
    expect(e.etat).not.toBe("m1_en_vol");
    expect(e.essaisM1).toBe(0);
    expect((await MS.lireGardes()).disjoncteur.ouvert).toBe(false);
    expect(await alertes()).toBe(1);
  });

  it("un « stop » n'est jamais bloqué par le plafond (message et commentaire)", async () => {
    await semerCompteur(COMPTE, 30);
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => "STOP";
    const idM = await deposerMessage(depots, {});
    const idC = await deposerCommentaire(depots, { idAuteur: "auteur-stop", motSeul: "STOP" });
    await passer();
    expect((await etatDe(A)).etat).toBe("oppose");
    expect((await evenement(depots, idM)).traite).toBe(true);
    expect((await evenement(depots, idC)).traite).toBe(true);
    expect(envois()).toBe(0);
  });

  it("M2 et accusé sont réservés ; l'appel au site est hors plafond", async () => {
    await semerCompteur(COMPTE, 30);
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => "bonjour";
    const idM2 = await deposerMessage(depots, { idMessage: "msg-a" });
    await passer();
    expect(port.envoyes.length).toBe(0);
    expect((await evenement(depots, idM2)).charge.dernierCode).toBe("plafond_heure");
    expect((await etatDe(A)).m2Envoye).toBe(false);

    reinitialiserDepots();
    await registre();
    await semerCompteur(COMPTE, 30);
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => `voici ${ADRESSE_FICTIVE}`;
    const idAdr = await deposerMessage(depots, { idMessage: "msg-b" });
    await passer(T0 + 1000);
    expect(site.vus.length).toBe(1); // le site est appelé malgré le plafond
    expect(port.envoyes.length).toBe(0); // l'accusé attend
    expect((await evenement(depots, idAdr)).charge.dernierCode).toBe("plafond_heure");
    expect((await etatDe(A)).etat).toBe("guide_demande");
    await passer(HEURE + H + 1000);
    expect(port.envoyes.length).toBe(1);
    expect(site.vus.length).toBe(1); // pas de second appel au site
  });

  it("compteur illisible : rien ne part, report d'une minute", async () => {
    for (const mauvais of ["n'importe quoi", { [COMPTE]: { heure: "x", envois: "y" } }, { [COMPTE]: { heure: HEURE, envois: -3 } }]) {
      reinitialiserDepots();
      await registre();
      await Com.ecrireParametre(PARAM_COMPTEURS, mauvais);
      const id = await deposerCommentaire(depots, {});
      await passer();
      expect(envois()).toBe(0);
      expect((await evenement(depots, id)).charge).toMatchObject({ dernierCode: "compteur_illisible", prochainEssaiLe: T0 + 60_000 });
    }
  });

  it("une seule alerte par heure, sans adresse ni identifiant", async () => {
    await semerCompteur(COMPTE, 30);
    for (let i = 0; i < 3; i++) await deposerCommentaire(depots, { idAuteur: `auteur-${i}` });
    await passer();
    await passer(HEURE + H - 1000);
    expect(await alertes()).toBe(1);
    const textes = JSON.stringify([await depots().evenements.lister(() => true), await depots().notifications.lister(() => true)]);
    expect(textes).not.toContain(COMPTE);
    expect(textes).not.toContain("@");
  });

  it("interrupteur éteint : aucune écriture, aucun appel", async () => {
    const id = await deposerCommentaire(depots, {});
    const avant = JSON.stringify(await tout());
    await passer(T0, { env: { ...ENV, PARCOURS_CONVERSATION_ENABLED: "" } });
    expect(envois() + port.lire).toBe(0);
    expect(await compteurs()).toEqual({});
    expect(JSON.stringify(await tout())).toBe(avant);
    expect((await evenement(depots, id)).charge.etat).toBe("a_faire");
  });

  it("jamais d'adresse dans le compteur", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => `voici ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, {});
    await passer();
    expect(JSON.stringify(await compteurs())).not.toContain("@");
  });
});
