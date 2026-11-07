/** Lot 5d · scénarios de bout en bout des « stop » (rejeu, doublons, désordre, R5, fuites). Données 100 % fictives ; port et site FAUX. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, silencerConsole } from "./aides/conversation";
import { H, MIN, graineConv, lectureParMessage, siteDouble } from "./aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const OT = await import("@/services/oppositions-transmission");
const OPP = await import("@/services/oppositions-mots");
const MS = await import("@/services/mots-service");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof siteDouble>;
const A = "auteur-fictif-400";
const passer = (ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
const transmettre = (ms = T0) => OT.transmettreOppositions({ port: port.port, env: ENV, maintenantMs: ms });
const conversations = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const conv = async (id = A) => (await conversations())[cleConversation(id)];
const file = () => Com.lireParametre<Record<string, any>>(OT.PARAM_OPPOSITIONS_FILE, {});
const semer = async (etat: string, extra: Record<string, unknown> = {}, id = A) => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await conversations()), [cleConversation(id)]: graineConv(etat, extra) });
const registre = () => Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
/** Insère une opposition « venue d'ailleurs » directement au registre (sans verrou : utilisable depuis un espion de lecture). */
const opposerAilleurs = (id = A) => Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, [{ id: cleConversation(id), le: "x", transmise: false }]);
const registreIllisible = () => Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, [{ id: "p1.deadbeef." + "0".repeat(64), le: "x", transmise: false }]);
const tousLesTextes = async (): Promise<string> =>
  JSON.stringify([await depots().parametres.lister(() => true), await depots().evenements.lister(() => true), await depots().notifications.lister(() => true), await depots().evenementsFournisseurs.lister(() => true)]);

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = siteDouble();
  pm.injecterTransportSite(site.transport);
  await registre();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("demanderGuide mémorise le message de l'adresse (opaque)", () => {
  it("occurredAt et idMessageAdresse sont écrits ensemble, sans l'adresse", async () => {
    await semer("attente_email");
    lectureParMessage(port, { "msg-adr": `mon adresse ${ADRESSE_FICTIVE}` });
    site.reponseGuide = () => ({ statut: 500 });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    await passer();
    const c = await conv();
    expect(c.idMessageAdresse).toBe("msg-adr");
    expect(typeof c.occurredAt).toBe("string");
    expect(JSON.stringify(await conversations())).not.toContain(ADRESSE_FICTIVE);
  });
});

describe("rejeu et doublons", () => {
  it("le même « stop » deux fois (deux événements) : une entrée, un seul POST", async () => {
    await semer("guide_demande", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "msg-adr", idMessageGuide: "msg-adr" });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    lectureParMessage(port, { "msg-adr": `adresse ${ADRESSE_FICTIVE}`, "stop-1": "STOP", "stop-2": "stop" });
    await deposerMessage(depots, { idMessage: "stop-1" });
    await passer();
    await deposerMessage(depots, { idMessage: "stop-2" });
    await passer(T0 + MIN);
    expect((await conv()).etat).toBe("oppose");
    expect(Object.keys(await file())).toEqual([cleConversation(A)]);
    await transmettre(T0 + 2 * MIN);
    await transmettre(T0 + H);
    expect(site.opp()).toHaveLength(1);
    expect(site.invalides).toEqual([]);
  });
  it("« stop » en commentaire puis en privé : une seule entrée", async () => {
    await semer("site_reessai", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "msg-adr" });
    await deposerCommentaire(depots, { idAuteur: A, motSeul: "STOP" });
    await passer();
    expect(Object.keys(await file())).toHaveLength(1);
    const cle = (await file())[cleConversation(A)].cleIdempotence;
    lectureParMessage(port, { "stop-prive": "stop" });
    await deposerMessage(depots, { idMessage: "stop-prive" });
    await passer(T0 + MIN);
    expect(Object.keys(await file())).toHaveLength(1);
    expect((await file())[cleConversation(A)].cleIdempotence).toBe(cle);
  });
  it("« stop » en privé puis en commentaire : une seule entrée", async () => {
    await semer("attente_email", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "msg-adr" });
    lectureParMessage(port, { "stop-prive": "arrêtez" });
    await deposerMessage(depots, { idMessage: "stop-prive" });
    await passer();
    expect(Object.keys(await file())).toHaveLength(1);
    await deposerCommentaire(depots, { idAuteur: A, motSeul: "STOP" });
    await passer(T0 + MIN);
    expect(Object.keys(await file())).toHaveLength(1);
  });
  it("deux passages de transmission simultanés après un « stop » : un seul POST", async () => {
    await semer("guide_demande", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "msg-adr" });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    lectureParMessage(port, { "msg-adr": `adresse ${ADRESSE_FICTIVE}`, "stop-1": "STOP" });
    await deposerMessage(depots, { idMessage: "stop-1" });
    await passer();
    await Promise.all([transmettre(T0 + MIN), transmettre(T0 + MIN)]);
    expect(site.opp()).toHaveLength(1);
  });
});

describe("adresse acceptée par le site", () => {
  const ADRESSE_B = "autre-personne@example.test";
  it("adresse A (503) puis adresse B (200) puis « stop » : le POST d'opposition porte l'adresse B", async () => {
    await semer("attente_email");
    lectureParMessage(port, { "msg-A": `adresse ${ADRESSE_FICTIVE}`, "msg-B": `adresse ${ADRESSE_B}`, "stop-1": "STOP" });
    site.reponseGuide = () => ({ statut: 503 });
    await deposerMessage(depots, { idMessage: "msg-A" });
    await passer();
    expect((await conv()).idMessageAdresse).toBe("msg-A");
    site.reponseGuide = () => ({ statut: 200, corps: {} });
    await deposerMessage(depots, { idMessage: "msg-B" });
    await passer(T0 + 1000);
    expect((await conv()).etat).toBe("termine");
    expect((await conv()).idMessageAdresse).toBe("msg-B");
    await deposerMessage(depots, { idMessage: "stop-1" });
    await passer(T0 + 2000);
    expect((await conv()).etat).toBe("oppose");
    await transmettre(T0 + MIN);
    expect(site.opp()).toHaveLength(1);
    expect(JSON.parse(site.opp()[0].corps).email).toBe(ADRESSE_B);
    expect(JSON.stringify(await conversations())).not.toMatch(/example\.test/);
  });
});

describe("état déjà « oppose » mais absent de la file", () => {
  it("le message suivant met le « stop » en file ; un seul POST avec la bonne adresse", async () => {
    await semer("oppose", { occurredAt: new Date(T0 - H).toISOString(), idMessageAdresse: "msg-adr", idMessageGuide: "msg-adr" });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    lectureParMessage(port, { "msg-adr": `adresse ${ADRESSE_FICTIVE}`, "msg-2": "bonjour" });
    expect(await file()).toEqual({});
    const id = await deposerMessage(depots, { idMessage: "msg-2" });
    await passer();
    expect(await evenement(depots, id)).toMatchObject({ traite: true });
    expect(Object.keys(await file())).toEqual([cleConversation(A)]);
    await transmettre(T0 + MIN);
    await transmettre(T0 + 2 * H);
    expect(site.opp()).toHaveLength(1);
    expect(JSON.parse(site.opp()[0].corps).email).toBe(ADRESSE_FICTIVE);
    expect(site.invalides).toEqual([]);
  });
});

describe("désordre", () => {
  it("« stop » traité pendant site_reessai : l'opposition part, la demande de guide ne repart plus", async () => {
    await semer("attente_email");
    lectureParMessage(port, { "msg-adr": `mon adresse ${ADRESSE_FICTIVE}`, "stop-1": "STOP" });
    site.reponseGuide = () => ({ statut: 500 });
    const idAdr = await deposerMessage(depots, { idMessage: "msg-adr" });
    await passer();
    expect((await conv()).etat).toBe("attente_email");
    expect(site.guide()).toHaveLength(1);
    const prochain = (await evenement(depots, idAdr)).charge.prochainEssaiLe;
    expect(prochain).toBeGreaterThan(T0 + 1000);
    await deposerMessage(depots, { idMessage: "stop-1" });
    await passer(T0 + 1000); // l'événement de l'adresse n'est pas encore dû
    expect((await conv()).etat).toBe("oppose");
    expect(Object.keys(await file())).toHaveLength(1);
    await passer(prochain + 1000); // son réessai : silence, aucun POST
    expect(site.guide()).toHaveLength(1);
    expect(await evenement(depots, idAdr)).toMatchObject({ traite: true, charge: { etat: "silence", dernierCode: "etat" } });
    await transmettre(prochain + 2000);
    expect(site.opp()).toHaveLength(1);
    expect(JSON.parse(site.opp()[0].corps).email).toBe(ADRESSE_FICTIVE);
    expect(site.invalides).toEqual([]);
  });
  it("« stop » avant toute adresse : personne écartée, aucune file, aucun POST, aucune lecture de transmission", async () => {
    await semer("attente_email");
    lectureParMessage(port, { "stop-1": "STOP" });
    await deposerMessage(depots, { idMessage: "stop-1" });
    await passer();
    expect((await conv()).etat).toBe("oppose");
    expect(await file()).toEqual({});
    const lues = port.lire;
    await transmettre(T0 + MIN);
    expect(site.vus).toHaveLength(0);
    expect(port.lire).toBe(lues);
    expect((await Com.lireParametre<any[]>(OPP.PARAM_OPPOSITIONS_MOTS, [])).length).toBeGreaterThanOrEqual(1); // rien n'est supprimé, la personne est au registre
  });
  it("orphelin puis « stop » : opposé, rien en file", async () => {
    lectureParMessage(port, { "stop-1": "STOP" });
    await deposerMessage(depots, { idMessage: "stop-1" });
    let t = T0;
    for (let n = 0; n < 4; n++) {
      await passer(t);
      t += 5 * MIN;
    }
    expect(await OPP.personneOpposee(A, "zernio-conversation", { env: ENV })).toBe(true);
    expect(await file()).toEqual({});
    await transmettre(t);
    expect(site.vus).toHaveLength(0);
  });
});

describe("R5 · l'opposition est revérifiée juste avant CHAQUE envoi", () => {
  it("réponse publique : opposition insérée après la lecture de l'état → ni réponse publique ni M1", async () => {
    const orig = depots().parametres.obtenir.bind(depots().parametres);
    let fait = false;
    vi.spyOn(depots().parametres, "obtenir").mockImplementation(async (id: string) => {
      const r = await orig(id);
      if (id === C.PARAM_CONVERSATIONS && !fait && Object.values((r?.valeur ?? {}) as Record<string, any>).some((x) => x.etat === "nouveau")) {
        fait = true;
        await opposerAilleurs();
      }
      return r;
    });
    const id = await deposerCommentaire(depots, { idAuteur: A });
    await passer();
    expect(fait).toBe(true);
    expect(port.pub).toHaveLength(0);
    expect(port.prive).toHaveLength(0);
    expect(await evenement(depots, id)).toMatchObject({ traite: true, charge: { etat: "silence", dernierCode: "opposee" } });
  });
  it("M1 : opposition insérée pendant la réponse publique (espion) → M1 ne part pas", async () => {
    const pub = port.port.repondreCommentaire;
    port.port.repondreCommentaire = async (p) => {
      const r = await pub(p);
      await opposerAilleurs();
      return r;
    };
    const id = await deposerCommentaire(depots, { idAuteur: A });
    await passer();
    expect(port.pub).toHaveLength(1);
    expect(port.prive).toHaveLength(0);
    expect(await evenement(depots, id)).toMatchObject({ traite: true, charge: { etat: "silence", dernierCode: "opposee" } });
    expect((await conv()).etat).not.toBe("m1_en_vol");
  });
  it("M1 : registre illisible avant l'envoi → report d'une minute, M1 ne part pas, puis part une fois le registre lisible", async () => {
    const pub = port.port.repondreCommentaire;
    port.port.repondreCommentaire = async (p) => {
      const r = await pub(p);
      await registreIllisible();
      return r;
    };
    const id = await deposerCommentaire(depots, { idAuteur: A });
    await passer();
    expect(port.prive).toHaveLength(0);
    expect(await evenement(depots, id)).toMatchObject({ traite: false, charge: { dernierCode: "registre_illisible", prochainEssaiLe: T0 + MIN } });
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, []);
    await passer(T0 + MIN + 1000);
    expect(port.prive).toHaveLength(1);
  });
  it("M2 : opposition insérée après la lecture du message → M2 ne part pas", async () => {
    await semer("attente_email");
    lectureParMessage(port, { "msg-1": "bonjour" }, { surLecture: () => opposerAilleurs() });
    const id = await deposerMessage(depots, { idMessage: "msg-1" });
    await passer();
    expect(port.envoyes).toHaveLength(0);
    expect(await evenement(depots, id)).toMatchObject({ traite: true, charge: { etat: "silence", dernierCode: "opposee" } });
  });
  it("M2 : l'état relu est « oppose » (registre pas encore à jour) → M2 ne part pas", async () => {
    await semer("attente_email");
    lectureParMessage(port, { "msg-1": "bonjour" }, { surLecture: async () => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await conversations()), [cleConversation(A)]: { ...(await conv()), etat: "oppose" } }) });
    await deposerMessage(depots, { idMessage: "msg-1" });
    await passer();
    expect(port.envoyes).toHaveLength(0);
  });
  it("appel au site : opposition insérée après la lecture → aucun POST de demande, aucune file (adresse jamais transmise)", async () => {
    await semer("attente_email");
    lectureParMessage(port, { "msg-1": `adresse ${ADRESSE_FICTIVE}` }, { surLecture: () => opposerAilleurs() });
    const id = await deposerMessage(depots, { idMessage: "msg-1" });
    await passer();
    expect(site.vus).toHaveLength(0);
    expect(await evenement(depots, id)).toMatchObject({ traite: true, charge: { etat: "silence", dernierCode: "opposee" } });
    expect((await conv()).occurredAt).toBeNull();
  });
  it("appel au site : registre illisible → report d'une minute, aucun POST ; ensuite la demande part", async () => {
    await semer("attente_email");
    let casse = false;
    lectureParMessage(port, { "msg-1": `adresse ${ADRESSE_FICTIVE}` }, { surLecture: async () => (casse ? undefined : ((casse = true), registreIllisible())) });
    const id = await deposerMessage(depots, { idMessage: "msg-1" });
    await passer();
    expect(site.vus).toHaveLength(0);
    expect(await evenement(depots, id)).toMatchObject({ traite: false, charge: { dernierCode: "registre_illisible", prochainEssaiLe: T0 + MIN } });
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, []);
    await passer(T0 + MIN + 1000);
    expect(site.guide()).toHaveLength(1);
  });
  it("accusé : opposition insérée pendant l'appel au site → l'accusé ne part pas ; la réconciliation met alors le « stop » en file", async () => {
    await semer("attente_email");
    lectureParMessage(port, { "msg-1": `adresse ${ADRESSE_FICTIVE}` });
    const t = site.transport;
    pm.injecterTransportSite(async (r) => {
      const x = await t(r);
      await opposerAilleurs();
      return x;
    });
    await deposerMessage(depots, { idMessage: "msg-1" });
    await passer();
    expect(site.guide()).toHaveLength(1);
    expect(port.envoyes).toHaveLength(0);
    expect(await file()).toEqual({});
    expect(await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 })).toBe(1);
    expect(Object.keys(await file())).toEqual([cleConversation(A)]);
  });
  it("réponse sans opposition : tout part comme avant (le contrôle ne bloque rien)", async () => {
    await deposerCommentaire(depots, { idAuteur: A });
    await passer();
    expect(port.pub).toHaveLength(1);
    expect(port.prive).toHaveLength(1);
  });
});

describe("aucune fuite d'adresse sur le parcours complet", () => {
  it("adresse → panne du site → « stop » → panne Zernio → transmission : l'adresse n'existe qu'en mémoire", async () => {
    await semer("attente_email");
    let panne = true;
    lectureParMessage(port, { "msg-adr": `mon adresse ${ADRESSE_FICTIVE}`, "stop-1": "STOP" }, { exception: () => false });
    site.reponseGuide = () => ({ statut: 500 });
    await deposerMessage(depots, { idMessage: "msg-adr" });
    await passer();
    await deposerMessage(depots, { idMessage: "stop-1" });
    await passer(T0 + 1000);
    // panne de lecture Zernio à la transmission
    const lecture = port.port.lireMessage;
    port.port.lireMessage = async (p) => {
      if (panne) throw new Error(`panne ${ADRESSE_FICTIVE}`);
      return lecture(p);
    };
    await transmettre(T0 + 2000);
    panne = false;
    site.reponseOpp = () => 500;
    await transmettre(T0 + 2 * H);
    site.reponseOpp = () => 200;
    await transmettre(T0 + 3 * H);
    expect(site.opp().length).toBeGreaterThanOrEqual(2);
    const texte = await tousLesTextes();
    expect(texte).not.toMatch(/example\.test|@/);
    const sorties = JSON.stringify((["log", "error", "warn", "info"] as const).flatMap((m) => (console[m] as any).mock.calls));
    expect(sorties).not.toMatch(/example\.test|@/);
    expect(site.invalides).toEqual([]);
  });
});
