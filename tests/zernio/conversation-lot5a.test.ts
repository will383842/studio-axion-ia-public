/** Lot 5a · correctifs de la relecture de la PR #199 (M1, m1, m2, m3, m5). Données 100 % fictives (example.test) ; port et site FAUX. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doitExpirer, type Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { creerPortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Z = await import("@/services/zernio");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0, over: Partial<Parameters<typeof C.traiterConversations>[0]> = {}) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms, ...over });
const tout = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const etatDe = async (id: string) => (await tout())[cleConversation(id)];
const A = "auteur-fictif-400";
const H = 3600_000;
const J = 24 * H;
const alertes = async () => (await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).length;

const graine = (etat: string, extra: Record<string, unknown> = {}) => ({
  etat, reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0 - 50 * H).toISOString(), m1Le: null, occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [], ...extra,
});
const semer = async (id: string, etat: string, extra: Record<string, unknown> = {}) => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await tout()), [cleConversation(id)]: graine(etat, extra) });
const registre = async (etat: string) => {
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat, idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
};

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

const gardes: Array<[string, () => Promise<void>, Partial<Parameters<typeof C.traiterConversations>[0]>]> = [
  ["tout_arrete", () => Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, false), {}],
  ["disjoncteur_ferme", () => Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } }), {}],
  ["mot_inactif", () => registre("pause"), {}],
  ["compte_hors_liste", async () => undefined, { comptesPermis: ["autre-compte"], comptesLecture: [COMPTE] }],
];

describe.each(gardes)("M1 · garde %s : l'événement attend 60 s, sans relire Zernio à chaque tour", (nom, regler, over) => {
  it("message (garde après lecture) : lecture 1 à T0 et T0+5 s, 2 à T0+61 s", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => "bonjour";
    const id = await deposerMessage(depots, {});
    await regler();
    await passer(T0, over);
    expect(port.lire).toBe(1);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ prochainEssaiLe: T0 + 60_000, dernierCode: `garde_${nom}` });
    await passer(T0 + 5000, over);
    expect(port.lire).toBe(1);
    await passer(T0 + 61_000, over);
    expect(port.lire).toBe(2);
    expect(port.total() - port.lire).toBe(0);
    expect((await etatDe(A)).essaisSite).toBe(0);
    expect(await alertes()).toBe(1); // une alerte par heure
  });
  it("commentaire (garde initiale) : reporté de 60 s, aucun compteur d'essais touché", async () => {
    const id = await deposerCommentaire(depots, {});
    await regler();
    const rap = await passer(T0, over);
    expect(rap.enAttente).toBe(1);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ prochainEssaiLe: T0 + 60_000, dernierCode: `garde_${nom}` });
    expect(await tout()).toEqual({});
    expect((await passer(T0 + 5000, over)).enAttente).toBe(0); // pas encore dû
    expect(port.total()).toBe(0);
  });
});

describe("expirerConversations · repli sur l'état du processus", () => {
  it("sans enVol explicite, un M1 réellement en vol dans CE processus n'expire pas ; une fois parti, il expire", async () => {
    let pendant = -1;
    const enveloppe = { ...port.port, repondreEnPrive: async (p: any) => { pendant = await C.expirerConversations({ env: ENV, maintenantMs: T0 + 8 * J }); return port.port.repondreEnPrive(p); } };
    await deposerCommentaire(depots, { idAuteur: A, idCommentaire: "com-vol" });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: graine("pub_ok", { idCommentaire: "com-vol", creeLe: new Date(T0 - 10 * J).toISOString() }) });
    await C.traiterConversations({ port: enveloppe, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: T0 });
    expect(pendant).toBe(0); // en vol dans ce processus : pas expiré (repli sur processus().enVol)
    expect((await etatDe(A)).etat).toBe("attente_email");
    expect(await C.expirerConversations({ env: ENV, maintenantMs: T0 + 8 * J })).toBe(1); // une fois M1 parti, plus rien en vol : il expire bien
  });
});

describe("M1 · les deux autres chemins", () => {
  it("etapesCommentaire : la garde qui tombe entre la réponse publique et M1 reporte l'événement de 60 s", async () => {
    const id = await deposerCommentaire(depots, {});
    const enveloppe = { ...port.port, repondreCommentaire: async (p: any) => { const r = await port.port.repondreCommentaire(p); await registre("pause"); return r; } };
    const rap = await C.traiterConversations({ port: enveloppe, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: T0 });
    expect(rap.enAttente).toBe(1);
    expect(port.prive).toHaveLength(0);
    expect((await evenement(depots, id)).charge).toMatchObject({ prochainEssaiLe: T0 + 60_000, dernierCode: "garde_mot_inactif" });
    expect((await etatDe(A)).essaisPub).toBe(0);
    expect((await etatDe(A)).essaisM1).toBe(0);
  });
  it("traiterMessage, accusé (reprendre_recu) : reporté de 60 s", async () => {
    await semer(A, "guide_demande", { idMessageGuide: "msg-accuse" });
    await registre("pause");
    const id = await deposerMessage(depots, { idMessage: "msg-accuse" });
    expect((await passer(T0)).enAttente).toBe(1);
    expect((await evenement(depots, id)).charge).toMatchObject({ prochainEssaiLe: T0 + 60_000, dernierCode: "garde_mot_inactif" });
    expect((await passer(T0 + 5000)).enAttente).toBe(0);
    expect(port.envoyes).toHaveLength(0);
  });
});

describe("m1 · comptesLecture", () => {
  it("compte retiré de comptesPermis en cours de conversation : aucun envoi, « stop » lu et enregistré", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => "stop";
    const id = await deposerMessage(depots, {});
    port.ecritureAutorisee = []; // le faux port refuse (et compte) toute écriture sur un compte hors liste
    await passer(T0, { comptesPermis: [], comptesLecture: [COMPTE] });
    expect(port.lire).toBe(1);
    expect(port.refuses).toBe(0);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect((await etatDe(A)).etat).toBe("oppose");
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
    expect(site.vus).toHaveLength(0);
  });
  it("compte retiré de comptesPermis, message ordinaire : la garde bloque AVANT tout envoi (le faux port n'est jamais sollicité en écriture)", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.ecritureAutorisee = [];
    port.reponses.texte = () => `Mon adresse : ${ADRESSE_FICTIVE}`;
    const id = await deposerMessage(depots, {});
    await passer(T0, { comptesPermis: [], comptesLecture: [COMPTE] });
    expect((await evenement(depots, id)).charge).toMatchObject({ dernierCode: "garde_compte_hors_liste", prochainEssaiLe: T0 + 60_000 });
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
    expect(port.refuses).toBe(0);
    expect(site.vus).toHaveLength(0);
  });
  it("lecture impossible sur un compte des listes : l'alerte dit « panne Zernio ou réseau »", async () => {
    const texteAlerte = async () => (await depots().notifications.lister(() => true)).map((n: any) => n.message).join("|");
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.lecture = () => ({ texte: null, postback: null, panne: true });
    await deposerMessage(depots, {});
    await passer(T0);
    expect(await texteAlerte()).toContain("panne Zernio ou réseau");
    expect(await texteAlerte()).not.toContain("compte hors liste");
  });
  it("lecture impossible sur un compte hors des deux listes : l'alerte dit « compte hors liste », pas « panne Zernio ou réseau »", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.lectureAutorisee = []; // le faux port refuse la lecture de ce compte
    await deposerMessage(depots, {});
    await passer(T0, { comptesPermis: [], comptesLecture: [] });
    const messages = (await depots().notifications.lister(() => true)).map((n: any) => n.message).join("|");
    expect(messages).toContain("compte hors liste");
    expect(messages).not.toContain("panne Zernio ou réseau");
  });
  it("T6 · panne sur compte autorisé puis refus sur compte hors listes, même heure : les deux alertes sont présentes", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.lecture = () => ({ texte: null, postback: null, panne: true });
    await deposerMessage(depots, {});
    await passer(T0);
    await semer("autre-fictif-402", "attente_email", { idCompte: "compte-hors-fictif", m1Le: new Date(T0).toISOString() });
    await deposerMessage(depots, { idExpediteur: "autre-fictif-402", idCompte: "compte-hors-fictif", idMessage: "msg-t6" });
    await passer(T0, { comptesPermis: [COMPTE], comptesLecture: [COMPTE] });
    const messages = (await depots().notifications.lister(() => true)).map((n: any) => n.message).join("|");
    expect(messages).toContain("panne Zernio ou réseau");
    expect(messages).toContain("compte hors liste");
  });
  it("orphelin « stop » sur un compte hors des deux listes : jamais clos, report à +6 h, une alerte", async () => {
    port.reponses.texte = () => "stop";
    const id = await deposerMessage(depots, {});
    await depots().evenementsFournisseurs.modifier(`evf-${id}`, { charge: { ...(await evenement(depots, id)).charge, orphelins: 2 } });
    await passer(T0, { comptesPermis: ["autre-compte"], comptesLecture: ["autre-compte-2"] });
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ prochainEssaiLe: T0 + 6 * H, dernierCode: "compte_hors_liste" });
    expect(port.lire).toBe(0);
    expect(await alertes()).toBe(1);
    await passer(T0 + 30 * 60_000, { comptesPermis: ["autre-compte"], comptesLecture: ["autre-compte-2"] }); // pas dû
    expect(await alertes()).toBe(1);
  });
  it("orphelin « stop » sur un compte de comptesLecture : lu et enregistré", async () => {
    port.reponses.texte = () => "stop";
    const id = await deposerMessage(depots, {});
    await depots().evenementsFournisseurs.modifier(`evf-${id}`, { charge: { ...(await evenement(depots, id)).charge, orphelins: 2 } });
    port.ecritureAutorisee = []; // le faux port refuse (et compte) toute écriture sur un compte hors liste
    await passer(T0, { comptesPermis: [], comptesLecture: [COMPTE] });
    expect(port.lire).toBe(1);
    expect(port.refuses).toBe(0);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "oppose", dernierCode: "opposition_orpheline" });
  });
});

describe("m2 · expiration", () => {
  const base = graine("attente_email") as unknown as Conversation;
  const il = (jours: number): string => new Date(T0 - jours * J).toISOString();
  it("m2Le illisible : repli sur m1Le (vieux de 8 jours) → expiré ; m1Le récent → non expiré", () => {
    const e = { ...base, etat: "m2_envoye", m2Le: "pas-une-date", m1Le: il(8) } as Conversation;
    expect(doitExpirer(e, T0)).toBe(true);
    expect(doitExpirer({ ...e, m1Le: il(1) }, T0)).toBe(false);
  });
  it("m2Le et m1Le illisibles : repli sur creeLe", () => {
    const e = { ...base, etat: "m2_envoye", m2Le: "x", m1Le: "y" } as Conversation;
    expect(doitExpirer({ ...e, creeLe: il(8) }, T0)).toBe(true);
    expect(doitExpirer({ ...e, creeLe: il(1) }, T0)).toBe(false);
  });
  it("tout illisible : expiré", () => {
    expect(doitExpirer({ ...base, etat: "m2_envoye", m2Le: "x", m1Le: null, creeLe: "z" } as Conversation, T0)).toBe(true);
    expect(doitExpirer({ ...base, etat: "attente_email", m1Le: "x", creeLe: "z" } as Conversation, T0)).toBe(true);
  });
  it("m1_a_verifier : 8 jours → expiré, 6 jours → non ; la date de M1 prime sur creeLe", () => {
    expect(doitExpirer({ ...base, etat: "m1_a_verifier", creeLe: il(8) } as Conversation, T0)).toBe(true);
    expect(doitExpirer({ ...base, etat: "m1_a_verifier", creeLe: il(6) } as Conversation, T0)).toBe(false);
    expect(doitExpirer({ ...base, etat: "m1_a_verifier", creeLe: il(8), m1Le: il(1) } as Conversation, T0)).toBe(false);
  });
  it("m1_en_vol : 8 jours → expiré sauf s'il est en vol dans ce processus (indicateur)", () => {
    const e = { ...base, etat: "m1_en_vol", creeLe: il(8) } as Conversation;
    expect(doitExpirer(e, T0, false)).toBe(true);
    expect(doitExpirer(e, T0)).toBe(true);
    expect(doitExpirer(e, T0, true)).toBe(false);
  });
  it("service : enVol est passé à expirerConversations ; un état expiré lit encore les « stop »", async () => {
    await semer("a-vol", "m1_en_vol", { creeLe: il(8) });
    await semer("a-verifier", "m1_a_verifier", { creeLe: il(8) });
    const enVol = new Set([cleConversation("a-vol")]);
    expect(await C.expirerConversations({ env: ENV, maintenantMs: T0, enVol })).toBe(1);
    expect((await etatDe("a-vol")).etat).toBe("m1_en_vol");
    expect((await etatDe("a-verifier")).etat).toBe("expire");
    port.reponses.texte = () => "stop";
    const id = await deposerMessage(depots, { idExpediteur: "a-verifier" });
    await passer(T0);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
  });
});

describe("m3 · ordre de recherche et alias", () => {
  it("l'alias du fil passe avant la clé d'une ancienne conversation", async () => {
    const cleAncienne = cleConversation(A);
    const cleVivante = cleConversation("autre-personne-fictive");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleAncienne]: graine("termine"), [cleVivante]: graine("attente_email", { m1Le: new Date(T0).toISOString(), alias: [cleConversation("conv-fictive-700")] }) });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { [cleConversation("conv-fictive-700")]: cleVivante });
    port.reponses.texte = () => "stop";
    await deposerMessage(depots, {});
    await passer(T0);
    const t = await tout();
    expect(t[cleVivante].etat).toBe("oppose");
    expect(t[cleAncienne].etat).toBe("termine");
  });
  it("un commentaire GUIDE d'un alias donne silence : pas de second parcours", async () => {
    const cleVivante = cleConversation("autre-personne-fictive");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleVivante]: graine("attente_email", { m1Le: new Date(T0).toISOString(), alias: [cleConversation(A)] }) });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { [cleConversation(A)]: cleVivante });
    const id = await deposerCommentaire(depots, { idAuteur: A });
    await passer(T0);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "silence" });
    expect(port.pub).toHaveLength(0);
    expect(port.prive).toHaveLength(0);
    expect(Object.keys(await tout())).toEqual([cleVivante]);
  });
});

describe("port · comptesLecture", () => {
  const AUTRE = "exemple-compte-2";
  it("élargit la lecture mais aucune écriture", async () => {
    const f = creerFauxClientZernio(() => ({ statut: 200, corps: { messages: [{ id: "m", direction: "incoming", text: "bonjour" }] } }));
    const p = creerPortInboxZernio({ client: f.client, comptesPermis: [COMPTE], comptesLecture: [COMPTE, AUTRE] });
    expect(await p.lireMessage({ idCompte: AUTRE, idConversation: "c", idMessage: "m" })).toMatchObject({ texte: "bonjour" });
    const lus = f.faux.appels.length;
    expect(lus).toBe(1);
    const e = await p.envoyerMessage({ idCompte: AUTRE, idConversation: "c", texte: "x", cle: "k" });
    expect(e.statut).not.toBe("envoye");
    const r = await p.repondreEnPrive({ idCompte: AUTRE, idPost: "p", idCommentaire: "c", texte: "x" });
    expect(r.statut).not.toBe("envoye");
    const pub = await p.repondreCommentaire({ idCompte: AUTRE, idPost: "p", idCommentaire: "c", texte: "x", cle: "k" });
    expect(pub.statut).not.toBe("envoye");
    expect(f.faux.appels).toHaveLength(lus);
  });
  it("par défaut, la lecture suit comptesPermis", async () => {
    const f = creerFauxClientZernio(() => ({ statut: 200, corps: { messages: [] } }));
    const p = creerPortInboxZernio({ client: f.client, comptesPermis: [COMPTE] });
    expect(await p.lireMessage({ idCompte: AUTRE, idConversation: "c", idMessage: "m" })).toMatchObject({ panne: true });
    expect(f.faux.appels).toHaveLength(0);
  });
});

describe("m5 · de bout en bout : l'adresse n'est ni stockée ni journalisée", () => {
  it("GUIDE → M1 → message avec adresse → panne du site → accusé → « stop »", async () => {
    const journal = vi.spyOn(Com, "journaliser");
    const idCom = await deposerCommentaire(depots, { idAuteur: A, idCommentaire: "com-e2e" });
    await passer(T0);
    expect((await evenement(depots, idCom)).charge.etat).toBe("attente_email");
    expect(port.prive).toHaveLength(1);
    port.reponses.texte = () => `Voici mon adresse : ${ADRESSE_FICTIVE} merci`;
    const idMsg = await deposerMessage(depots, { idMessage: "msg-adresse" });
    site.reponses = () => ({ statut: 503 });
    await passer(T0 + 1000);
    expect(site.vus.length).toBeGreaterThan(0);
    expect((await evenement(depots, idMsg)).traite).toBe(false);
    site.reponses = () => ({ statut: 200, corps: {} });
    await passer(T0 + 2 * H);
    expect((await evenement(depots, idMsg)).charge.etat).toBe("termine");
    expect(port.envoyes).toHaveLength(1);
    port.reponses.texte = () => "stop";
    const idStop = await deposerMessage(depots, { idMessage: "msg-stop", avance: 3 * H });
    site.reponses = () => ({ statut: 503 });
    await passer(T0 + 3 * H);
    expect((await evenement(depots, idStop)).charge.etat).toBe("oppose");
    expect((await etatDe(A)).etat).toBe("oppose");

    const nul = (nom: string, v: unknown): void => {
      const s = JSON.stringify(v) ?? "";
      expect(s, nom).not.toContain(ADRESSE_FICTIVE);
      expect(s, nom).not.toContain("@example.test");
    };
    nul("journaliser", journal.mock.calls);
    nul("journal", await depots().evenements.lister(() => true));
    nul("notifications", await depots().notifications.lister(() => true));
    nul("parametres", await depots().parametres.lister(() => true));
    nul("evenements", await depots().evenementsFournisseurs.lister(() => true));
    nul("depot-evenements-charges", (await depots().evenementsFournisseurs.lister(() => true)).map((e: any) => e.charge));
    for (const m of ["log", "error", "warn", "info"] as const) nul(`console.${m}`, vi.mocked(console[m]).mock.calls);
    nul("port", [port.pub, port.prive, port.envoyes]);
    expect(await alertes()).toBe(0); // aucune panne dans ce scénario : aucune alerte
  });
});
