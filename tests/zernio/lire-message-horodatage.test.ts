/**
 * Lecture d'un message entrant par HORODATAGE (essai réel du 08/11) : l'id du webhook (24 hex) n'est jamais l'id de la liste
 * (« m_… » de 88 caractères). Forme réelle de la liste : { status, messages, pagination, sortOrderApplied: "asc", lastUpdated },
 * texte dans `message`. Données 100 % fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerPortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, deposerCommentaire, deposerMessage, evenement, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";
import { creerFauxClientZernio, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const CONV = "conv-fictive-700";
const mid = (n: number) => `m_${String(n).padStart(86, "x")}`; // 88 caractères fictifs
const ID_WEBHOOK = "0123456789abcdef01234567"; // 24 hex, jamais égal à l'id de la liste
const T = "2026-11-08T07:13:06.886Z";
const dec = (ms: number) => new Date(Date.parse(T) + ms).toISOString();
const msg = (n: number, o: Record<string, unknown> = {}) => ({
  id: mid(n), conversationId: CONV, accountId: COMPTE, platform: "facebook", message: "texte fictif", senderId: "personne-fictive-500", senderName: "Nom Fictif",
  direction: "incoming", createdAt: T, attachments: [], noRenderableContent: false, isEdited: false, editCount: 0, ...o,
});
const liste = (messages: unknown[], pagination: Record<string, unknown> = { hasMore: false }) => ({ status: "success", messages, pagination, sortOrderApplied: "asc", lastUpdated: T });

const fabrique = (reponses: ReponsePreparee[] | ((a: AppelEnregistre) => ReponsePreparee)) => {
  const b = creerFauxClientZernio(reponses);
  return { ...b, port: creerPortInboxZernio({ client: b.client, comptesPermis: [COMPTE], titresGuidesPermis: [TITRE] }) };
};
const lire = (port: ReturnType<typeof fabrique>["port"], o: { occurredAt?: string; idExpediteur?: string } = {}) =>
  port.lireMessage({ idCompte: COMPTE, idConversation: CONV, idMessage: ID_WEBHOOK, ...o });

describe("lireMessage · par horodatage", () => {
  it("retrouve le message entrant quand l'id du webhook ≠ l'id de la liste", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { message: "DHDH" })]) }]);
    expect(await lire(port, { occurredAt: T })).toEqual({ texte: "DHDH", postback: null });
  });
  it("le texte lu vient du champ « message » (chaîne), jamais de « text »", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { message: "vrai texte", text: "mauvais champ" })]) }]);
    expect((await lire(port, { occurredAt: T })).texte).toBe("vrai texte");
  });
  it("accepte aussi un objet { text } dans « message »", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { message: { text: "texte objet" } })]) }]);
    expect((await lire(port, { occurredAt: T })).texte).toBe("texte objet");
  });
  it("un message SORTANT à la même milliseconde n'est jamais choisi", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { direction: "outgoing", message: "réponse automatique" }), msg(2, { message: "le vrai", createdAt: dec(900) })]) }]);
    expect((await lire(port, { occurredAt: T })).texte).toBe("le vrai");
  });
  it("seulement un sortant proche : introuvable, pas le sortant", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { direction: "outgoing", message: "réponse automatique" })]) }]);
    expect(await lire(port, { occurredAt: T })).toEqual({ texte: null, postback: null, introuvable: true });
  });
  it("un entrant à 5 s d'écart n'est pas choisi", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { createdAt: dec(5000) })]) }]);
    expect(await lire(port, { occurredAt: T })).toEqual({ texte: null, postback: null, introuvable: true });
  });
  it("deux entrants proches : le plus proche", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { message: "loin", createdAt: dec(-1500) }), msg(2, { message: "proche", createdAt: dec(300) })]) }]);
    expect((await lire(port, { occurredAt: T })).texte).toBe("proche");
  });
  it("égalité d'écart : l'expéditeur connu départage", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { message: "autre", senderId: "autre-fictif", createdAt: dec(-500) }), msg(2, { message: "bonne personne", createdAt: dec(500) })]) }]);
    expect((await lire(port, { occurredAt: T, idExpediteur: "personne-fictive-500" })).texte).toBe("bonne personne");
  });
  it("l'ancienne correspondance par id passe en PREMIER choix", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { message: "par horodatage" }), msg(2, { id: ID_WEBHOOK, message: "par id", createdAt: dec(1900) })]) }]);
    expect((await lire(port, { occurredAt: T })).texte).toBe("par id");
  });
  it("occurredAt absent : comportement ancien (id seul, sinon introuvable)", async () => {
    const a = fabrique([{ statut: 200, corps: liste([msg(1, { message: "x" })]) }]);
    expect(await lire(a.port)).toEqual({ texte: null, postback: null, introuvable: true });
    const b = fabrique([{ statut: 200, corps: liste([msg(1, { id: ID_WEBHOOK, message: "par id" })]) }]);
    expect((await lire(b.port)).texte).toBe("par id");
  });
  it("liste sur 2 pages (le récent sur la page 2) : retrouvé, curseur suivi", async () => {
    const { port, faux } = fabrique((a) => a.url.includes("cursor=suite-fictive")
      ? { statut: 200, corps: liste([msg(9, { message: "page deux", createdAt: dec(100) })], { hasMore: false, nextCursor: null }) }
      : { statut: 200, corps: liste([msg(1, { createdAt: dec(-3_600_000) })], { hasMore: true, nextCursor: "suite-fictive" }) });
    expect((await lire(port, { occurredAt: T })).texte).toBe("page deux");
    expect(faux.appels).toHaveLength(2);
    expect(faux.appels[1].url).toContain("accountId=");
  });
  it("plus de 10 pages : introuvable, 10 appels au plus, aucune boucle", async () => {
    const { port, faux } = fabrique((a) => ({ statut: 200, corps: liste([msg(1, { createdAt: dec(-3_600_000) })], { hasMore: true, nextCursor: `c-${a.url.length}-${Math.random()}` }) }));
    expect(await lire(port, { occurredAt: T })).toEqual({ texte: null, postback: null, introuvable: true });
    expect(faux.appels.length).toBeLessThanOrEqual(10);
  });
  it("curseur qui se répète : arrêt immédiat, introuvable", async () => {
    const { port, faux } = fabrique(() => ({ statut: 200, corps: liste([msg(1, { createdAt: dec(-3_600_000) })], { hasMore: true, nextCursor: "meme" }) }));
    expect((await lire(port, { occurredAt: T })).introuvable).toBe(true);
    expect(faux.appels.length).toBeLessThanOrEqual(3);
  });
  it("panne sur la page 2 : panne (jamais « introuvable »)", async () => {
    const { port } = fabrique([{ statut: 200, corps: liste([msg(1, { createdAt: dec(-3_600_000) })], { hasMore: true, nextCursor: "suite" }) }, { statut: 500, corps: {} }]);
    expect((await lire(port, { occurredAt: T })).panne).toBe(true);
  });
  it("ni texte ni adresse dans les journaux", async () => {
    const { port, journal } = fabrique([{ statut: 200, corps: liste([msg(1, { message: `écris à ${ADRESSE_FICTIVE}` })]) }]);
    await lire(port, { occurredAt: T });
    expect(JSON.stringify(journal)).not.toContain(ADRESSE_FICTIVE);
    expect(JSON.stringify(journal)).not.toContain("écris à");
  });
});

describe("parcours complet · lecture par horodatage", () => {
  let site: ReturnType<typeof fauxSite>;
  const A = "auteur-fictif-400";
  beforeEach(async () => {
    reinitialiserDepots();
    C.reinitialiserParcoursConversation();
    pm.reinitialiserGardesParcours();
    silencerConsole();
    site = fauxSite();
    pm.injecterTransportSite(site.transport);
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
    await validerGuideAuParcours();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    pm.injecterTransportSite(null);
  });
  const scenario = async (texte: string) => {
    const occurredAt = new Date(T0 - 1000).toISOString();
    const b = fabrique((a) => a.methode === "GET"
      ? { statut: 200, corps: liste([
          msg(1, { direction: "outgoing", message: "message automatique", createdAt: new Date(T0 - 5000).toISOString(), senderId: COMPTE }),
          msg(2, { message: texte, createdAt: occurredAt, senderId: A }),
          msg(3, { direction: "outgoing", message: "réponse de la Page", createdAt: new Date(T0 - 998).toISOString(), senderId: COMPTE }),
        ]) }
      : { statut: 200, corps: { messageId: "sortant-fictif" } });
    await deposerCommentaire(depots, {});
    const id = await deposerMessage(depots, { idMessage: ID_WEBHOOK, occurredAt });
    const passer = (ms: number) => C.traiterConversations({ port: b.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
    await passer(T0);
    await passer(T0 + 31_000);
    await passer(T0 + 62_000);
    return { b, id };
  };
  it("« adresse@exemple.test » lu → adresse reconnue → appel au site fictif", async () => {
    const { id } = await scenario("adresse@exemple.test");
    expect(site.vus).toHaveLength(1);
    expect(JSON.parse(site.vus[0].corps)).toMatchObject({ email: "adresse@exemple.test" });
    expect((await evenement(depots, id)).dernierCode).not.toBe("introuvable");
  });
  it("« DHDH » lu → M2 envoyé (mp-m2-v1)", async () => {
    const { b } = await scenario("DHDH");
    const m2 = b.faux.appels.filter((a) => a.methode === "POST" && (a.json as { message?: string }).message === rendreTexteMp("mp-m2-v1", {}));
    expect(m2).toHaveLength(1);
    expect(site.vus).toHaveLength(0);
  });
});
