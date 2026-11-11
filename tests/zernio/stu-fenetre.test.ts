/**
 * STU-FENETRE · fenêtre de 24 h de Meta : aucun message de conversation (M2, « adresse refusée », reçu) au-delà de 23 h après
 * le dernier message écrit par la personne. L'envoi est remplacé par le code `hors_fenetre`, rien n'est perdu, un « stop » est toujours lu.
 * Données 100 % fictives (example.test) ; port et site FAUX, sauf le constructeur de corps d'envoi (réel).
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVANCE_HORLOGE_MAX_MS, FENETRE_ENVOI_MS, activiteRetenue, dansFenetreEnvoi, type Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { creerPortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { creerFauxClientZernio } from "./aides/faux-zernio";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Opp = await import("@/services/oppositions-mots");

const H = 3600_000;
const HORS = 23 * H + 1000;
const PARAM_COMPTEURS = "parcours.conversations.compteurs";
const PARAM_VALIDATION = "parcours.validation.adresse_refusee";
const A = "auteur-fictif-400";
const iso = (ms: number): string => new Date(ms).toISOString();
const empreinteTexte = () => { const b = TEXTES_MP["mp-adresse-refusee-v2"]; return createHash("sha256").update(`${b.version}\n${b.texte}`).digest("hex"); };
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms: number, p = port.port) => C.traiterConversations({ port: p, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];
const refuse = () => ({ statut: 422, corps: { erreur: "invalide" } });
const compteurs = async () => JSON.stringify(await Com.lireParametre(PARAM_COMPTEURS, {}));

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
  await Com.ecrireParametre(PARAM_VALIDATION, { empreinte: empreinteTexte() });
  await deposerCommentaire(depots, {});
  await passer(T0); // M1 envoyé : la personne est en attente de son adresse
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

const conv = (o: Partial<Conversation>): Conversation => o as Conversation;

describe("fonctions pures", () => {
  it("dansFenetreEnvoi : vrai à 22 h 59 min 59 s, faux à 23 h 00 ; faux sans date ou date illisible", () => {
    const c = conv({ derniereActiviteLe: iso(T0) });
    expect(FENETRE_ENVOI_MS).toBe(23 * H);
    expect(dansFenetreEnvoi(c, T0 + 23 * H - 1000)).toBe(true);
    expect(dansFenetreEnvoi(c, T0 + 23 * H)).toBe(false);
    expect(dansFenetreEnvoi(conv({}), T0)).toBe(false);
    expect(dansFenetreEnvoi(conv({ derniereActiviteLe: null }), T0)).toBe(false);
    expect(dansFenetreEnvoi(conv({ derniereActiviteLe: "pas une date" }), T0)).toBe(false);
  });
  it("dansFenetreEnvoi : date à +6 min dans le futur = faux, à +4 min = vrai", () => {
    expect(AVANCE_HORLOGE_MAX_MS).toBe(5 * 60_000);
    expect(dansFenetreEnvoi(conv({ derniereActiviteLe: iso(T0 + 6 * 60_000) }), T0)).toBe(false);
    expect(dansFenetreEnvoi(conv({ derniereActiviteLe: iso(T0 + 4 * 60_000) }), T0)).toBe(true);
  });
  it("activiteRetenue : ne recule jamais ; occurredAt absent = recuLe ; futur ramené à maintenant ; rien de lisible = null", () => {
    expect(activiteRetenue(iso(T0 + H), iso(T0), iso(T0), T0 + 2 * H)).toBe(iso(T0 + H)); // l'ancienne, plus récente, est gardée
    expect(activiteRetenue(iso(T0), iso(T0 + H), iso(T0), T0 + 2 * H)).toBe(iso(T0 + H));
    expect(activiteRetenue(null, undefined, iso(T0 - 500), T0 + H)).toBe(iso(T0 - 500));
    expect(activiteRetenue(null, "illisible", iso(T0 - 500), T0 + H)).toBe(iso(T0 - 500));
    expect(activiteRetenue(null, iso(T0 + 10 * H), iso(T0), T0)).toBe(iso(T0)); // futur : ramené à maintenant
    expect(activiteRetenue(null, undefined, "nimporte quoi", T0)).toBeNull();
    expect(activiteRetenue("mauvaise", iso(T0), iso(T0), T0 + H)).toBe(iso(T0));
  });
});

describe("hors fenêtre : rien ne part, rien n'est perdu", () => {
  it("M2 : message sans adresse traité à T0 + 23 h + 1 s : 0 envoi, événement clos hors_fenetre, plafond inchangé, m2Envoye faux", async () => {
    const id = await deposerMessage(depots, { idMessage: "msg-m2-h", occurredAt: iso(T0) });
    const avant = await compteurs();
    await passer(T0 + HORS);
    expect(port.envoyes).toHaveLength(0);
    expect(await compteurs()).toBe(avant);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge.dernierCode).toBe("hors_fenetre");
    expect((await etatDe()).m2Envoye).toBeFalsy();
    expect((await etatDe()).dernierCode).toBe("hors_fenetre");
  });

  it("reçu : le site est appelé (guide demandé) mais aucun message ne part ; état termine, code hors_fenetre", async () => {
    let appels = 0;
    site.reponses = () => (++appels === 1 ? { statut: 503 } : { statut: 200, corps: {} });
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "msg-recu-h", occurredAt: iso(T0) });
    await passer(T0 + 1000); // 503 : réessai
    expect(port.envoyes).toHaveLength(0);
    await passer(T0 + HORS);
    expect(appels).toBe(2);
    expect(port.envoyes).toHaveLength(0);
    expect(await etatDe()).toMatchObject({ etat: "termine", dernierCode: "hors_fenetre" });
  });

  it("adresse refusée : 422 à T0 + 23 h + 1 s : 0 message, adresseRefuseeEnvoyee vrai, site_refuse", async () => {
    site.reponses = refuse;
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "msg-422-h", occurredAt: iso(T0) });
    await passer(T0 + HORS);
    expect(port.envoyes).toHaveLength(0);
    expect(await etatDe()).toMatchObject({ etat: "site_refuse", adresseRefuseeEnvoyee: true });
  });

  it("garde bloquée 30 h puis débloquée : le message en attente ne déclenche aucun envoi (hors_fenetre)", async () => {
    const reg = await Com.lireParametre<Record<string, any>>(MS.PARAM_REGISTRE_MOTS, {});
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { ...reg[`GUIDE|${COMPTE}`], etat: "inactif" } });
    const id = await deposerMessage(depots, { idMessage: "msg-garde", occurredAt: iso(T0) });
    await passer(T0 + 1000);
    expect((await evenement(depots, id)).traite).toBe(false);
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
    await passer(T0 + 30 * H);
    expect(port.envoyes).toHaveLength(0);
    expect((await evenement(depots, id)).charge.dernierCode).toBe("hors_fenetre");
  });
});

describe("dans la fenêtre : comportement d'avant, avec le VRAI constructeur de corps d'envoi", () => {
  function portReel() {
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: { messageId: "msg-sortant-1" } }));
    const reel = creerPortInboxZernio({ client, comptesPermis: [COMPTE] });
    return { port: { ...port.port, envoyerMessage: reel.envoyerMessage }, faux };
  }
  const posts = (p: ReturnType<typeof portReel>) => p.faux.appels.filter((a) => a.methode === "POST");

  it("M2 : 1 POST à T0 + 22 h, 0 POST à T0 + 23 h + 1 s", async () => {
    const dedans = portReel();
    await deposerMessage(depots, { idMessage: "msg-r-in", occurredAt: iso(T0) });
    await passer(T0 + 22 * H, dedans.port);
    expect(posts(dedans)).toHaveLength(1);
    expect((posts(dedans)[0].json as { message: string }).message).toBe(TEXTES_MP["mp-m2-v1"].texte);
  });
  it("M2 hors fenêtre : aucun POST au réseau", async () => {
    const dehors = portReel();
    await deposerMessage(depots, { idMessage: "msg-r-out", occurredAt: iso(T0) });
    await passer(T0 + HORS, dehors.port);
    expect(posts(dehors)).toHaveLength(0);
  });
  it("reçu et adresse refusée : 1 POST dans la fenêtre", async () => {
    const p1 = portReel();
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "msg-rc-in", occurredAt: iso(T0) });
    await passer(T0 + 22 * H, p1.port);
    expect(posts(p1)).toHaveLength(1);
    expect(await etatDe()).toMatchObject({ etat: "termine" });
  });
  it("adresse refusée dans la fenêtre : part comme avant", async () => {
    site.reponses = refuse;
    const p = portReel();
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "msg-ar-in", occurredAt: iso(T0) });
    await passer(T0 + 22 * H, p.port);
    expect(posts(p)).toHaveLength(1);
    expect((posts(p)[0].json as { message: string }).message).toBe(TEXTES_MP["mp-adresse-refusee-v2"].texte);
  });
});

describe("date de dernière activité", () => {
  it("désordre : B (T0+2 h) traité avant A (T0+1 h) : la date est celle de B, et l'identifiant est celui de B", async () => {
    await deposerMessage(depots, { idMessage: "msg-B", occurredAt: iso(T0 + 2 * H) });
    await deposerMessage(depots, { idMessage: "msg-A", occurredAt: iso(T0 + H), avance: 10 });
    await passer(T0 + 3 * H);
    expect(await etatDe()).toMatchObject({ derniereActiviteLe: iso(T0 + 2 * H), idMessageDernier: "msg-B" });
  });
  it("rejeu : le même événement reporté par une garde puis repris : date inchangée, un seul envoi", async () => {
    const reg = await Com.lireParametre<Record<string, any>>(MS.PARAM_REGISTRE_MOTS, {});
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { ...reg[`GUIDE|${COMPTE}`], etat: "inactif" } });
    await deposerMessage(depots, { idMessage: "msg-rejeu", occurredAt: iso(T0) });
    await passer(T0 + 1000);
    const premiere = (await etatDe()).derniereActiviteLe;
    expect(premiere).toBe(iso(T0));
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
    await passer(T0 + 3 * 60_000);
    expect((await etatDe()).derniereActiviteLe).toBe(premiere);
    expect(port.envoyes).toHaveLength(1);
  });
  it("écho de notre compte : la date n'est pas posée", async () => {
    await deposerMessage(depots, { idMessage: "msg-echo", idExpediteur: COMPTE, occurredAt: iso(T0) });
    await passer(T0 + 1000);
    expect((await etatDe()).derniereActiviteLe ?? null).toBeNull();
  });
  it("occurredAt absent : la date de réception de l'événement est retenue", async () => {
    await deposerMessage(depots, { idMessage: "msg-sans-date" });
    await passer(T0 + 1000);
    expect((await etatDe()).derniereActiviteLe).toBe(iso(T0 - 500));
  });
});

describe("un stop l'emporte toujours", () => {
  it("« stop » écrit à T0 + 30 h : opposition enregistrée (registre + état oppose), aucune fenêtre exigée", async () => {
    port.reponses.texte = () => "STOP";
    await deposerMessage(depots, { idMessage: "msg-stop", occurredAt: iso(T0 + 30 * H) });
    await passer(T0 + 30 * H + 1000);
    expect((await etatDe()).etat).toBe("oppose");
    expect(await Opp.personneOpposee(A, "zernio-conversation", { env: ENV })).toBe(true);
    expect(port.envoyes).toHaveLength(0);
  });
  it("personne déjà opposée puis message hors fenêtre au même passage : le code est opposee, pas hors_fenetre", async () => {
    port.reponses.texte = () => "STOP";
    await deposerMessage(depots, { idMessage: "msg-stop-1", occurredAt: iso(T0) });
    await passer(T0 + 1000);
    port.reponses.texte = () => "bonjour";
    const id = await deposerMessage(depots, { idMessage: "msg-apres", occurredAt: iso(T0), avance: 5000 });
    await passer(T0 + HORS);
    expect((await evenement(depots, id)).charge.dernierCode).toBe("opposee");
    expect(port.envoyes).toHaveLength(0);
  });
});
