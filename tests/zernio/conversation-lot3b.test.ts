/** Lot 3b · seconde relecture (R-a, R-b, R-e, R-f). Données 100 % fictives ; port et site FAUX. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ATTENTES_INTROUVABLE_MS, doitExpirer, transition, type Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");
const MS = await import("@/services/mots-service");
const Z = await import("@/services/zernio");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0, over: Partial<Parameters<typeof C.traiterConversations>[0]> = {}) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms, ...over });
const tout = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const etatDe = async (id: string) => (await tout())[cleConversation(id)];
const lignes = () => Com.lireParametre<Array<{ id: string }>>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const A = "auteur-fictif-400";
const H = 3600_000;
const MIN = 60_000;

const graine = (etat: string, extra: Record<string, unknown> = {}) => ({
  etat, reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0 - 50 * H).toISOString(), m1Le: new Date(T0).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [], ...extra,
});
const semer = (id: string, etat: string, extra: Record<string, unknown> = {}) => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(id)]: graine(etat, extra) });
const semerPlusieurs = (l: Array<[string, string, Record<string, unknown>?]>) => Com.ecrireParametre(C.PARAM_CONVERSATIONS, Object.fromEntries(l.map(([id, etat, extra]) => [cleConversation(id), graine(etat, extra ?? {})])));
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

describe("R-a · la lecture pour opposition passe AVANT la garde, dans tous les états", () => {
  const gardes: Array<[string, () => Promise<void>, Partial<Parameters<typeof C.traiterConversations>[0]>]> = [
    ["Tout arrêter", () => Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, false), {}],
    ["disjoncteur ouvert", () => Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } }), {}],
    ["mot GUIDE en pause", () => registre("pause"), {}],
    ["compte retiré de la liste", async () => undefined, { comptesPermis: ["autre-compte"] }],
  ];
  const etats = ["attente_email", "m2_envoye", "m1_a_verifier", "m1_en_vol"];
  for (const [nomGarde, regler, over] of gardes) {
    for (const etat of etats) {
      it(`${nomGarde} · ${etat} : « stop » lu et enregistré, rien n'est envoyé`, async () => {
        await semer(A, etat);
        await regler();
        port.reponses.texte = () => "stop";
        const id = await deposerMessage(depots, {});
        await passer(T0, over);
        expect(port.lire).toBe(1);
        expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
        expect(site.vus).toHaveLength(0);
        expect((await evenement(depots, id)).charge).toMatchObject({ etat: "oppose" });
        expect((await etatDe(A)).etat).toBe("oppose");
        expect((await lignes()).length).toBeGreaterThan(0);
      });
    }
    it(`${nomGarde} : un message qui n'est pas un stop reste en attente, aucun envoi, aucun appel au site`, async () => {
      await semer(A, "attente_email");
      await regler();
      port.reponses.texte = () => "personne-fictive@example.test";
      const id = await deposerMessage(depots, {});
      const rap = await passer(T0, over);
      expect(rap.enAttente).toBe(1);
      expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
      expect(site.vus).toHaveLength(0);
      expect((await evenement(depots, id)).traite).toBe(false);
      expect((await etatDe(A)).etat).toBe("attente_email");
    });
  }
});

describe("R-a · m2_envoye expire comme attente_email", () => {
  const base = graine("m2_envoye", { m2Envoye: true, m2Le: new Date(T0).toISOString() }) as unknown as Conversation;
  it("machine : 7 jours après M2", () => {
    expect(doitExpirer(base, T0 + 7 * 24 * H - 1000)).toBe(false);
    expect(doitExpirer(base, T0 + 7 * 24 * H)).toBe(true);
  });
  it("machine : sans date de M2, repli sur M1", () => {
    const sans = { ...base, m2Le: undefined, m1Le: new Date(T0 - 7 * 24 * H).toISOString() } as Conversation;
    expect(doitExpirer(sans, T0)).toBe(true);
  });
  it("service : expirerConversations passe m2_envoye à expire, sans message", async () => {
    await semer(A, "m2_envoye", { m2Envoye: true, m2Le: new Date(T0 - 8 * 24 * H).toISOString() });
    expect(await C.expirerConversations({ env: ENV, maintenantMs: T0 })).toBe(1);
    expect((await etatDe(A)).etat).toBe("expire");
    expect(port.total()).toBe(0);
  });
  it("service : M2 envoyé enregistre sa date", async () => {
    await semer(A, "attente_email");
    port.reponses.texte = () => "bonjour";
    await deposerMessage(depots, {});
    await passer(T0 + 5 * MIN);
    const e = await etatDe(A);
    expect(e.etat).toBe("m2_envoye");
    expect(e.m2Le).toBe(new Date(T0 + 5 * MIN).toISOString());
  });
});

describe("R-b · message introuvable ≠ sans texte ; réponse mal formée = panne", () => {
  it("machine : introuvable → 5 min, 30 min, 2 h, 6 h, puis clos", () => {
    expect(ATTENTES_INTROUVABLE_MS).toEqual([5 * MIN, 30 * MIN, 2 * H, 6 * H]);
    expect([0, 1, 2, 3].map((n) => transition(null, { t: "texte_introuvable", essais: n }).apresMs)).toEqual([5 * MIN, 30 * MIN, 2 * H, 6 * H]);
    expect(transition(null, { t: "texte_introuvable", essais: 4 }).action).toBe("introuvable_clore");
  });
  it("port : liste sans message cherché → introuvable ; corps sans tableau « messages » → panne", async () => {
    const { creerPortInboxZernio } = await import("@/fournisseurs/zernio-inbox");
    const lire = (corps: unknown) => creerPortInboxZernio({ client: { requete: async () => ({ corps }) } as never, comptesPermis: [COMPTE] }).lireMessage({ idCompte: COMPTE, idConversation: "c", idMessage: "m" });
    expect(await lire({ messages: [] })).toMatchObject({ texte: null, introuvable: true });
    expect(await lire({ messages: [{ id: "autre", direction: "incoming", text: "x" }] })).toMatchObject({ introuvable: true });
    for (const mauvais of [{}, null, "oups", { messages: "pas-un-tableau" }, [], { data: [] }]) expect(await lire(mauvais)).toMatchObject({ texte: null, panne: true });
    // un message trouvé mais sortant reste « sans texte » (ni panne ni introuvable)
    const sortant = await lire({ messages: [{ id: "m", direction: "outgoing", text: "x" }] });
    expect(sortant.panne).toBeFalsy();
    expect(sortant.introuvable).toBeFalsy();
  });
  it("service : introuvable réessayé à 5 min, 30 min, 2 h, 6 h ; jamais ignoré avant la dernière lecture ; un stop apparu entre-temps est enregistré", async () => {
    await semer(A, "attente_email");
    port.reponses.lecture = () => ({ texte: null, postback: null, introuvable: true });
    const id = await deposerMessage(depots, {});
    let t = T0;
    const attendus = [5 * MIN, 30 * MIN, 2 * H, 6 * H];
    for (const a of attendus) {
      await passer(t);
      const ev = await evenement(depots, id);
      expect(ev.traite).toBe(false);
      expect(ev.charge.dernierCode).toBe("message_introuvable");
      expect(ev.charge.prochainEssaiLe - t).toBe(a);
      t = ev.charge.prochainEssaiLe;
    }
    // dernière lecture : le stop est enfin visible
    port.reponses.lecture = undefined;
    port.reponses.texte = () => "stop";
    await passer(t);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "oppose" });
    expect((await etatDe(A)).etat).toBe("oppose");
  });
  it("service : toujours introuvable à la dernière lecture → clos « ignore / introuvable »", async () => {
    await semer(A, "attente_email");
    port.reponses.lecture = () => ({ texte: null, postback: null, introuvable: true });
    const id = await deposerMessage(depots, {});
    let t = T0;
    for (let i = 0; i < 5; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      if (ev.traite) break;
      t = ev.charge.prochainEssaiLe;
    }
    expect(port.lire).toBe(5);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "ignore", dernierCode: "introuvable" });
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
  });
  it("service : panne (réponse mal formée) = réessai croissant, jamais d'abandon", async () => {
    await semer(A, "attente_email");
    port.reponses.lecture = () => ({ texte: null, postback: null, panne: true });
    const id = await deposerMessage(depots, {});
    let t = T0;
    for (let i = 0; i < 8; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      expect(ev.traite).toBe(false);
      expect(ev.charge.dernierCode).toBe("lecture_panne");
      t = ev.charge.prochainEssaiLe;
    }
  });
});

describe("R-e · un stop en commentaire oppose aussi tous les alias connus", () => {
  it("l'auteur a une conversation avec alias : toutes les empreintes sont opposées", async () => {
    await semer(A, "attente_email", { alias: ["alias-empreinte-fictif-1", "alias-empreinte-fictif-2"] });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { "alias-empreinte-fictif-1": cleConversation(A), "alias-empreinte-fictif-2": cleConversation(A) });
    const id = await deposerCommentaire(depots, { idAuteur: A, motSeul: "STOP" });
    await passer();
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "oppose" });
    const ids = (await lignes()).map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining([cleConversation(A), "alias-empreinte-fictif-1", "alias-empreinte-fictif-2"]));
    expect((await etatDe(A)).etat).toBe("oppose");
  });
  it("l'auteur du commentaire est lui-même un alias d'une autre empreinte : la conversation et ses alias sont opposés", async () => {
    await semer("principal-fictif", "attente_email", { alias: [cleConversation(A), "alias-empreinte-fictif-3"] });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { [cleConversation(A)]: cleConversation("principal-fictif"), "alias-empreinte-fictif-3": cleConversation("principal-fictif") });
    await deposerCommentaire(depots, { idAuteur: A, motSeul: "STOP" });
    await passer();
    const ids = (await lignes()).map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining([cleConversation(A), cleConversation("principal-fictif"), "alias-empreinte-fictif-3"]));
    expect((await etatDe("principal-fictif")).etat).toBe("oppose");
  });
  it("sans conversation connue : seule l'empreinte de l'auteur est opposée (inchangé)", async () => {
    const id = await deposerCommentaire(depots, { idAuteur: A, motSeul: "STOP" });
    await passer();
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "oppose" });
    expect((await lignes()).map((l) => l.id)).toEqual([cleConversation(A)]);
  });
});

describe("R-f · noterAlias ne reattribue jamais un alias déjà rattaché à une autre personne", () => {
  it("l'alias reste à la 1re personne ; refus journalisé par un code, sans identifiant", async () => {
    const autre = "personne-fictive-autre";
    const aliasCommun = cleConversation("conv-fictive-commune");
    await semerPlusieurs([[A, "attente_email", { alias: [aliasCommun] }], [autre, "attente_email"]]);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { [aliasCommun]: cleConversation(A) });
    await C.noterAlias(cleConversation(autre), [aliasCommun, "alias-empreinte-fictif-neuf"]);
    const alias = await Com.lireParametre<Record<string, string>>(C.PARAM_CONVERSATIONS_ALIAS, {});
    expect(alias[aliasCommun]).toBe(cleConversation(A));
    expect(alias["alias-empreinte-fictif-neuf"]).toBe(cleConversation(autre)); // le reste est noté
    expect((await etatDe(autre)).alias).not.toContain(aliasCommun);
    expect((await etatDe(A)).alias).toContain(aliasCommun);
    const journal = await depots().evenements.lister((e: any) => /alias_deja_rattache/.test(e.message));
    expect(journal).toHaveLength(1);
    expect(JSON.stringify(journal)).not.toContain(aliasCommun);
    expect(JSON.stringify(journal)).not.toContain(cleConversation(A));
  });
  it("refuse aussi une empreinte qui est la clé d'une autre conversation", async () => {
    await semerPlusieurs([[A, "attente_email"], ["personne-fictive-autre", "attente_email"]]);
    await C.noterAlias(cleConversation("personne-fictive-autre"), [cleConversation(A)]);
    expect((await etatDe("personne-fictive-autre")).alias).toEqual([]);
    expect(await Com.lireParametre(C.PARAM_CONVERSATIONS_ALIAS, {})).toEqual({});
  });
  it("ré-noter son propre alias reste sans effet ni journal", async () => {
    await semer(A, "attente_email", { alias: ["alias-empreinte-fictif-9"] });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { "alias-empreinte-fictif-9": cleConversation(A) });
    await C.noterAlias(cleConversation(A), ["alias-empreinte-fictif-9"]);
    expect(await depots().evenements.lister((e: any) => /alias_deja_rattache/.test(e.message))).toHaveLength(0);
  });
});
