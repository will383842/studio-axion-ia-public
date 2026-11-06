/** Lot 3a · correctifs après relecture (B1 B2 B3 B4, R1 R3 R4 R5). Données 100 % fictives ; port et site FAUX. */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";
import { transition, type Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");
const MS = await import("@/services/mots-service");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0, over: Partial<Parameters<typeof C.traiterConversations>[0]> = {}) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms, ...over });
const tout = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const etatDe = async (id: string) => (await tout())[cleConversation(id)];
const lignes = () => Com.lireParametre<Array<{ id: string }>>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const A = "auteur-fictif-400";
const H = 3600_000;

const graine = (etat: string, extra: Record<string, unknown> = {}) => ({
  etat, reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0 - 50 * H).toISOString(), m1Le: null, occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [], ...extra,
});
const semer = (id: string, etat: string, extra: Record<string, unknown> = {}) => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(id)]: graine(etat, extra) });
let notifBase = 0;
const notifications = async () => (await depots().notifications.lister(() => true)).length - notifBase;

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  notifBase = (await depots().notifications.lister(() => true)).length;
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("B1 · un stop en message privé est pris en compte dans TOUT état connu", () => {
  for (const etat of ["termine", "expire", "m1_refuse", "m1_consommee", "site_refuse", "guide_demande", "pub_ok"]) {
    it(`état ${etat} : « stop » → opposition enregistrée, état oppose, aucun envoi`, async () => {
      await semer(A, etat);
      port.reponses.texte = () => "stop";
      const id = await deposerMessage(depots, {});
      await passer();
      expect((await evenement(depots, id)).charge.etat).toBe("oppose");
      expect((await etatDe(A)).etat).toBe("oppose");
      expect(await lignes()).toHaveLength(2); // l.expéditeur (= la personne) et l.alias de conversation
      expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
      expect(site.vus).toHaveLength(0);
    });
    it(`état ${etat} : un autre texte reste ignoré (silence), rien ne part`, async () => {
      await semer(A, etat);
      port.reponses.texte = () => `voici ${ADRESSE_FICTIVE}`;
      const id = await deposerMessage(depots, {});
      await passer();
      expect((await evenement(depots, id)).charge.etat).toBe("silence");
      expect((await etatDe(A)).etat).toBe(etat);
      expect(site.vus).toHaveLength(0);
      expect(port.envoyes).toHaveLength(0);
      expect(await lignes()).toHaveLength(0);
    });
  }
});

describe("B2 · un stop posté en RÉPONSE à un commentaire", () => {
  const base: Parameters<typeof transition>[1] = { t: "commentaire", idCommentaire: "c1", proprio: false, idAuteur: "a", idCompte: "c", motSeul: "STOP", estReponse: true, ageMs: 1000, maintenantMs: T0 };
  it("machine : réponse « STOP » → opposer ; réponse « GUIDE » → écartée", () => {
    expect(transition(null, base).action).toBe("opposer");
    expect(transition(null, { ...base, motSeul: "ARRETEZ" }).action).toBe("opposer");
    expect(transition(null, { ...base, motSeul: "GUIDE" })).toMatchObject({ action: "ecarter", raison: "reponse" });
  });
  it("service : réponse « STOP » → opposition enregistrée ; réponse « GUIDE » → rien", async () => {
    const idStop = await deposerCommentaire(depots, { idAuteur: "personne-reponse-1", motSeul: "STOP", estReponse: true });
    const idGuide = await deposerCommentaire(depots, { idAuteur: "personne-reponse-2", motSeul: "GUIDE", estReponse: true });
    await passer();
    expect((await evenement(depots, idStop)).charge.etat).toBe("oppose");
    expect((await evenement(depots, idGuide)).charge.etat).toBe("ecarte");
    expect(await lignes()).toHaveLength(1);
    expect(port.total()).toBe(0);
  });
  describe("crochet", () => {
    const SECRET = "secret-fictif-crochet-correctifs";
    const CROCHET_ENV = { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET };
    const fixture = (): Record<string, any> => JSON.parse(readFileSync(new URL("./fixtures/comment-received-forme-reelle.json", import.meta.url), "utf8"));
    const envoyer = (o: unknown) => {
      const corps = Buffer.from(JSON.stringify(o));
      return pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET, corps) }, { env: CROCHET_ENV, maintenantMs: T0 });
    };
    const deposes = () => depots().evenementsFournisseurs.lister(() => true);
    it("réponse « stop » : déposée, sans texte brut ; réponse « GUIDE » : toujours écartée", async () => {
      const o = fixture();
      o.comment.isReply = true;
      o.comment.text = "Stop.";
      await envoyer(o);
      const l = await deposes();
      expect(l).toHaveLength(1);
      expect(l[0].charge).toMatchObject({ motSeul: "STOP.", estReponse: true }); // mot normalisé (liste fermée), jamais le texte tel qu.écrit
      expect(JSON.stringify(l)).not.toContain("Stop.");
      reinitialiserDepots();
      const g = fixture();
      g.comment.isReply = true;
      g.comment.text = "GUIDE";
      await envoyer(g);
      expect(await deposes()).toHaveLength(0);
    });
  });
});

describe("B4 · panne de lecture ≠ message sans texte", () => {
  it("panne : réessais à délai croissant, jamais ignoré, alerte au plus 1/heure ; puis un stop est enregistré", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => {
      throw new Error("panne simulée");
    };
    const id = await deposerMessage(depots, {});
    const delais: number[] = [];
    let t = T0;
    for (let i = 0; i < 7; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      expect(ev.traite).toBe(false);
      expect(ev.charge.dernierCode).toBe("lecture_panne");
      delais.push(ev.charge.prochainEssaiLe - t);
      t = ev.charge.prochainEssaiLe;
    }
    for (let i = 1; i < delais.length; i++) expect(delais[i]).toBeGreaterThanOrEqual(delais[i - 1]);
    expect(delais[3]).toBeGreaterThan(delais[0]);
    expect(await notifications()).toBeLessThanOrEqual(Math.ceil((t - T0) / H) + 1);
    // un passage dans la même heure n'ajoute aucune alerte
    const avant = await notifications();
    await passer(t - 1000 > T0 ? T0 + 1000 : t);
    expect(await notifications()).toBe(avant);
    port.reponses.texte = () => "stop";
    await passer(t);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect((await etatDe(A)).etat).toBe("oppose");
  });
  it("message sans texte : 3 réessais puis ignoré (inchangé)", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => null;
    const id = await deposerMessage(depots, {});
    for (const t of [0, 31_000, 31_000 + 121_000, 31_000 + 121_000 + 601_000]) await passer(T0 + t);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "ignore", dernierCode: "texte_absent" });
  });
  it("port : une erreur de lecture est rendue comme panne, un message absent comme « sans texte »", async () => {
    const { creerPortInboxZernio } = await import("@/fournisseurs/zernio-inbox");
    const clientQuiEchoue = { requete: async () => { throw new Error("réseau"); } } as never;
    const p1 = creerPortInboxZernio({ client: clientQuiEchoue, comptesPermis: [COMPTE] });
    expect(await p1.lireMessage({ idCompte: COMPTE, idConversation: "c", idMessage: "m" })).toMatchObject({ texte: null, panne: true });
    const clientVide = { requete: async () => ({ corps: { messages: [] } }) } as never;
    const p2 = creerPortInboxZernio({ client: clientVide, comptesPermis: [COMPTE] });
    const r = await p2.lireMessage({ idCompte: COMPTE, idConversation: "c", idMessage: "m" });
    expect(r.texte).toBeNull();
    expect(r.panne).toBeFalsy();
  });
  it("machine : texte_panne → réessai à délai croissant, sans fin", () => {
    const ms = [0, 1, 2, 3, 4, 10, 50].map((n) => transition(null, { t: "texte_panne", essais: n }));
    expect(ms.every((s) => s.action === "texte_panne_reessai")).toBe(true);
    const a = ms.map((s) => s.apresMs!);
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThanOrEqual(a[i - 1]);
    expect(a[a.length - 1]).toBeGreaterThan(a[0]);
  });
});

describe("B3 · premier message d'une personne dont sender.id ≠ author.id", () => {
  it("(a) M1 rend un identifiant de conversation : alias posé tout de suite, le 1er message d'un autre sender est retrouvé", async () => {
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m1", idConversation: "conv-m1-fictive" });
    await deposerCommentaire(depots, {});
    await passer();
    const e = await etatDe(A);
    expect(e.alias).toHaveLength(1);
    expect(JSON.stringify(await tout())).not.toContain("conv-m1-fictive");
    port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
    const id = await deposerMessage(depots, { idExpediteur: "sender-different-fictif-7", idConversation: "conv-m1-fictive" });
    await passer(T0 + 1000);
    expect((await evenement(depots, id)).traite).toBe(true);
    expect(site.vus).toHaveLength(1);
    expect((await etatDe(A)).etat).toBe("termine");
  });
  it("(a bis) idDestinataire rendu par le port : même effet", async () => {
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m1", idDestinataire: "dest-fictif-8" });
    await deposerCommentaire(depots, {});
    await passer();
    expect((await etatDe(A)).alias).toHaveLength(1);
  });
  it("(b) orphelin jamais retrouvé : après les réessais, le texte est lu ; un stop est enregistré (sender ET conversation), sans réponse", async () => {
    port.reponses.texte = () => "STOP";
    const id = await deposerMessage(depots, { idExpediteur: "sender-orphelin-fictif", idConversation: "conv-orpheline-fictive" });
    let t = T0;
    for (let i = 0; i < 4; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      if (ev.traite) break;
      t = ev.charge.prochainEssaiLe;
    }
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge.etat).toBe("oppose");
    expect(await lignes()).toHaveLength(2);
    expect(await Opp.personneOpposee("sender-orphelin-fictif", "zernio-conversation", { env: ENV })).toBe(true);
    expect(await Opp.personneOpposee("conv-orpheline-fictive", "zernio-conversation", { env: ENV })).toBe(true);
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
  });
  it("(b bis) orphelin sans opposition : ignoré, aucune réponse, aucune ligne", async () => {
    port.reponses.texte = () => `mon adresse ${ADRESSE_FICTIVE}`;
    const id = await deposerMessage(depots, { idExpediteur: "sender-orphelin-2" });
    let t = T0;
    for (let i = 0; i < 4; i++) {
      await passer(t);
      const ev = await evenement(depots, id);
      if (ev.traite) break;
      t = ev.charge.prochainEssaiLe;
    }
    expect((await evenement(depots, id)).charge.etat).toBe("ignore");
    expect(await lignes()).toHaveLength(0);
    expect(port.envoyes).toHaveLength(0);
    expect(site.vus).toHaveLength(0);
  });
  it("machine : fin des réessais d'orphelin → lecture du texte", () => {
    expect(transition(null, { t: "orphelin", essais: 2 }).action).toBe("orphelin_lire");
  });
});

describe("R1 · alias noté seulement après une lecture réussie ; écho filtré sur direction / isOwnAccount", () => {
  it("lecture en panne : aucun alias ; lecture réussie : alias posés", async () => {
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => {
      throw new Error("panne");
    };
    await deposerMessage(depots, { idConversation: "conv-r1" });
    await passer();
    expect((await etatDe(A)).alias).toHaveLength(0);
    port.reponses.texte = () => "bonjour";
    await passer(T0 + 2 * H);
    expect((await etatDe(A)).alias).toHaveLength(1);
  });
  it("machine : un message marqué sortant est écarté (écho)", () => {
    expect(transition(null, { t: "message", idExpediteur: "x", idCompte: "c", idMessage: "m", sortant: true })).toMatchObject({ action: "ecarter", raison: "echo" });
  });
  describe("crochet", () => {
    const SECRET = "secret-fictif-crochet-r1";
    const msg = (extra: Record<string, unknown>, sender: Record<string, unknown> = { id: "personne-fictive-500" }) => ({
      id: "evt_fictif_msg_r1", event: "message.received", timestamp: "2026-10-18T10:00:00.000Z",
      account: { accountId: "compte-fictif-100", platform: "instagram" },
      message: { id: "msg-r1", conversationId: "conv-r1", sender, ...extra },
    });
    const envoyer = (o: unknown) => {
      const corps = Buffer.from(JSON.stringify(o));
      return pm.recevoirCrochetZernio({ corps, signature: signatureZernio(SECRET, corps) }, { env: { MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET }, maintenantMs: T0 });
    };
    const deposes = () => depots().evenementsFournisseurs.lister(() => true);
    it("direction sortante ou isOwnAccount : aucun dépôt ; message entrant normal : déposé", async () => {
      await envoyer(msg({ direction: "outgoing" }));
      await envoyer({ ...msg({}, { id: "personne-fictive-501", isOwnAccount: true }), id: "evt_fictif_msg_r1b" });
      expect(await deposes()).toHaveLength(0);
      await envoyer({ ...msg({ direction: "incoming" }), id: "evt_fictif_msg_r1c" });
      expect(await deposes()).toHaveLength(1);
    });
  });
});

describe("R3 · site non relié : délai et alerte limitée, pas de relecture à chaque passage", () => {
  it("2 passages rapprochés : 1 seule lecture, événement reporté, 1 notification", async () => {
    pm.injecterTransportSite(null);
    const env = { ...ENV, SITE_VIDEOS_URL: "", SITE_VIDEOS_SECRET: "" };
    await semer(A, "attente_email", { m1Le: new Date(T0).toISOString() });
    port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
    const id = await deposerMessage(depots, {});
    await passer(T0, { env });
    await passer(T0 + 5000, { env });
    await passer(T0 + 10_000, { env });
    expect(port.lire).toBe(1);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge.prochainEssaiLe).toBeGreaterThan(T0 + 10_000);
    expect(await notifications()).toBe(1);
    expect(JSON.stringify(ev)).not.toContain(ADRESSE_FICTIVE);
  });
});

describe("R4 · une opposition en privé enregistre tous les identifiants connus", () => {
  it("sender.id, conversation ET l'auteur du commentaire d'origine sont opposés", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => "stop";
    await deposerMessage(depots, { idExpediteur: A, idConversation: "conv-r4" });
    await passer(T0 + 1000);
    expect(await Opp.personneOpposee(A, "zernio-conversation", { env: ENV })).toBe(true);
    expect(await Opp.personneOpposee("conv-r4", "zernio-conversation", { env: ENV })).toBe(true);
  });
  it("sender différent de l'auteur : l'auteur du commentaire est quand même opposé", async () => {
    port.reponses.prive = () => ({ statut: "envoye", idConversation: "conv-r4b" });
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => "arrêtez";
    await deposerMessage(depots, { idExpediteur: "sender-r4-different", idConversation: "conv-r4b" });
    await passer(T0 + 1000);
    expect(await Opp.personneOpposee(A, "zernio-conversation", { env: ENV })).toBe(true);
    expect(await Opp.personneOpposee("sender-r4-different", "zernio-conversation", { env: ENV })).toBe(true);
    const n = (await lignes()).length;
    expect(n).toBeGreaterThanOrEqual(2);
    // un nouveau GUIDE du même auteur est refusé
    const avant = port.total();
    await deposerCommentaire(depots, { idCommentaire: "com-apres" });
    await passer(T0 + 2000);
    expect(port.total()).toBe(avant);
  });
});

describe("R5 · reprise après m1_refuse : mesurée depuis le refus, alias conservés", () => {
  const com = (o: Record<string, unknown>) => ({ t: "commentaire" as const, idCommentaire: "com-2", proprio: false, idAuteur: "a", idCompte: "c", motSeul: "GUIDE", estReponse: false, ageMs: 1000, maintenantMs: T0, ...o }) as Parameters<typeof transition>[1];
  const base = graine("m1_refuse") as unknown as Conversation;
  it("machine : refus récent (creeLe ancien) → silence ; refus de plus de 24 h → demarrer", () => {
    expect(transition({ ...base, refuseLe: new Date(T0 - H).toISOString() } as Conversation, com({})).action).toBe("silence");
    expect(transition({ ...base, refuseLe: new Date(T0 - 25 * H).toISOString() } as Conversation, com({})).action).toBe("demarrer");
  });
  it("machine : un refus d'envoi note la date du refus", () => {
    const s = transition({ ...base, etat: "m1_en_vol" }, { t: "m1", res: { statut: "refuse", code: "chemin-refuse" }, maintenantMs: T0 });
    expect(s.patch).toMatchObject({ etat: "m1_refuse", refuseLe: new Date(T0).toISOString() });
  });
  it("service : la reprise conserve la liste d'alias", async () => {
    await semer(A, "m1_refuse", { refuseLe: new Date(T0 - 30 * H).toISOString(), alias: ["alias-fictif-conserve"] });
    await deposerCommentaire(depots, { idCommentaire: "com-reprise" });
    await passer();
    const e = await etatDe(A);
    expect(e.alias).toContain("alias-fictif-conserve");
    expect(e.etat).not.toBe("m1_refuse");
    expect(port.prive).toHaveLength(1);
  });
});
