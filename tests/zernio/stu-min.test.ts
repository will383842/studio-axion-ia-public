/**
 * STU-MIN · après clôture, les identifiants BRUTS d'un événement sont remplacés par null (la ligne reste, la déduplication reste,
 * le « stop » reste possible). Interrupteur PARCOURS_REDUCTION_IDS, éteint par défaut. Aucune ligne supprimée. Données 100 % fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELAI_REDUCTION_MS, reductible } from "@/domaine/guide-reseau/machine-conversation";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, cleConversation, fauxPort, silencerConsole } from "./aides/conversation";
import { graineConv, lectureParMessage, siteDouble } from "./aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const OT = await import("@/services/oppositions-transmission");
const OPP = await import("@/services/oppositions-mots");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");

const J = 24 * 3600_000;
const H = 3600_000;
const ENV_RED = { ...ENV, PARCOURS_REDUCTION_IDS: "1" };
const A = "auteur-fictif-400";
const ilYa = (ms: number) => new Date(T0 - ms).toISOString();
let n = 0;

/** Événement Zernio CLOS depuis `ageMs` (traite, modifieLe) avec tous ses identifiants bruts. */
async function evenement(o: { type?: "zernio.commentaire" | "zernio.message"; ageMs: number; traite?: boolean; idMessage?: string; idCompte?: string } ) {
  const type = o.type ?? "zernio.commentaire";
  const idEvenement = `evt-${++n}`;
  const date = ilYa(o.ageMs);
  const charge: Record<string, unknown> = type === "zernio.commentaire"
    ? { idCommentaire: `com-${n}`, idPostPlateforme: "post-plateforme-fictif-200", idCompte: o.idCompte ?? COMPTE, reseau: "instagram", idAuteur: "auteur-brut-fictif", proprio: false, motSeul: "GUIDE", estReponse: false, etat: "termine", dernierCode: null }
    : { idMessage: o.idMessage ?? `msg-${n}`, idConversation: "conv-brute-fictive", idCompte: o.idCompte ?? COMPTE, idExpediteur: "auteur-brut-fictif", idPlateforme: "plateforme-brute-fictive", etat: "termine", dernierCode: null };
  await depots().evenementsFournisseurs.enregistrer({ id: `evf-${idEvenement}`, fournisseur: "zernio", idEvenement, type, recuLe: date, traite: o.traite ?? true, creeLe: date, modifieLe: date, charge } as any);
  return `evf-${idEvenement}`;
}
const lire = async (id: string) => (await depots().evenementsFournisseurs.obtenir(id)) as any;
const reduire = (env = ENV_RED, ms = T0) => C.reduireIdentifiants({ env, maintenantMs: ms });
const conversations = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const nbLignes = async () => (await depots().evenementsFournisseurs.lister(() => true)).length;

beforeEach(() => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  pm.reinitialiserGardesParcours();
  silencerConsole();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("1 · événement de commentaire clos depuis 31 jours, interrupteur allumé", () => {
  it("identifiants bruts à null, idsReduitsLe posé, la ligne existe, idCommentaire et idCompte gardés", async () => {
    const id = await evenement({ ageMs: 31 * J });
    const avant = await lire(id);
    const lignes = await nbLignes();
    expect(await reduire()).toBe(1);
    const e = await lire(id);
    expect(e.charge).toMatchObject({ idAuteur: null, idExpediteur: null, idConversation: null, idPlateforme: null });
    expect(typeof e.charge.idsReduitsLe).toBe("string");
    expect(e.charge.idCommentaire).toBe(avant.charge.idCommentaire);
    expect(e.charge.idCompte).toBe(COMPTE);
    expect(e.idEvenement).toBe(avant.idEvenement);
    expect(e.traite).toBe(true);
    expect(await nbLignes()).toBe(lignes);
  });
  it("journal : un nombre, jamais un identifiant", async () => {
    await evenement({ ageMs: 31 * J });
    await reduire();
    const j = (await depots().evenements.lister((x: any) => /identifiants réduits/.test(x.message))) as any[];
    expect(j).toHaveLength(1);
    expect(j[0].message).toMatch(/1 identifiants? réduits?\./);
    expect(JSON.stringify(j)).not.toContain("auteur-brut-fictif");
  });
});

describe("2 · interrupteur éteint = rien ne change (non-régression)", () => {
  it.each([undefined, "0", "non"])("PARCOURS_REDUCTION_IDS=%s", async (v) => {
    const id = await evenement({ ageMs: 400 * J });
    const avant = JSON.stringify(await lire(id));
    expect(await reduire({ ...ENV, PARCOURS_REDUCTION_IDS: v })).toBe(0);
    expect(JSON.stringify(await lire(id))).toBe(avant);
  });
  it("éteint aussi quand le parcours de conversation est éteint", async () => {
    const id = await evenement({ ageMs: 400 * J });
    expect(await reduire({ ...ENV_RED, PARCOURS_CONVERSATION_ENABLED: undefined })).toBe(0);
    expect((await lire(id)).charge.idAuteur).toBe("auteur-brut-fictif");
  });
});

describe("3 et 4 · délai de 30 jours, et jamais un événement non clos", () => {
  it("clos depuis 29 jours : rien", async () => {
    const id = await evenement({ ageMs: 29 * J });
    expect(await reduire()).toBe(0);
    expect((await lire(id)).charge.idAuteur).toBe("auteur-brut-fictif");
  });
  it("événement non clos (à réessayer, ex. compte hors liste), même à 1 an : jamais réduit", async () => {
    const id = await evenement({ ageMs: 365 * J, traite: false });
    expect(await reduire()).toBe(0);
    expect((await lire(id)).charge.idAuteur).toBe("auteur-brut-fictif");
  });
});

describe("5 · PROTECTION DU « STOP » : l'événement qui porte l'adresse n'est jamais réduit", () => {
  it("idMessageAdresse clos depuis 1 an → non réduit ; le « stop » est ensuite transmis au site (scénario complet)", async () => {
    const cle = cleConversation(A);
    const idMessage = `msg-adr-${A}`;
    const conv = graineConv("oppose", { occurredAt: ilYa(365 * J), idMessageAdresse: idMessage, creeLe: ilYa(366 * J), m1Le: ilYa(366 * J) });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: conv });
    const ev = await evenement({ type: "zernio.message", ageMs: 365 * J, idMessage });
    await OPP.enregistrerOpposition(A, "zernio-conversation", { env: ENV });
    const k = (await import("@/domaine/guide-reseau/empreinte-personne")).lireClesEmpreinte(ENV);
    if (!k.ok) throw new Error("clés");
    await OT.mettreEnFileOpposition(cle, conv as any, k.courante, T0);
    // un autre événement ancien, lui, est réduit : la réduction a bien tourné
    const autre = await evenement({ ageMs: 365 * J });
    expect(await reduire()).toBeGreaterThanOrEqual(1);
    expect((await lire(autre)).charge.idAuteur).toBeNull();
    expect((await lire(ev)).charge).toMatchObject({ idConversation: "conv-brute-fictive", idExpediteur: "auteur-brut-fictif", idPlateforme: "plateforme-brute-fictive" });
    expect((await lire(ev)).charge.idsReduitsLe).toBeUndefined();
    // la file relit l'adresse et la transmet
    const port = fauxPort();
    const site = siteDouble();
    pm.injecterTransportSite(site.transport);
    lectureParMessage(port, { [idMessage]: `Voici mon adresse : ${ADRESSE_FICTIVE}, merci.` });
    const r = await OT.transmettreOppositions({ port: port.port, env: ENV, maintenantMs: T0 });
    expect(r.transmises).toBe(1);
    expect(site.opp()).toHaveLength(1);
  });
});

describe("6 · même protection pour idMessageGuide (conversations d'avant idMessageAdresse)", () => {
  it("idMessageGuide clos depuis 1 an → non réduit", async () => {
    const idMessage = "msg-guide-ancien";
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: graineConv("termine", { idMessageAdresse: null, idMessageGuide: idMessage }) });
    const ev = await evenement({ type: "zernio.message", ageMs: 365 * J, idMessage });
    expect(await reduire()).toBe(0);
    expect((await lire(ev)).charge.idConversation).toBe("conv-brute-fictive");
  });
});

describe("7 · idMessageDernier : protégé tant que la fenêtre est ouverte, réduit ensuite", () => {
  it("fenêtre ouverte (dernier message il y a 1 h) → non réduit, même clos depuis 31 jours", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: graineConv("termine", { derniereActiviteLe: ilYa(H), idMessageDernier: "msg-dernier" }) });
    const ev = await evenement({ type: "zernio.message", ageMs: 31 * J, idMessage: "msg-dernier" });
    expect(await reduire()).toBe(0);
    expect((await lire(ev)).charge.idConversation).toBe("conv-brute-fictive");
  });
  it("fenêtre fermée et plus de 30 jours → réduit", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: graineConv("termine", { derniereActiviteLe: ilYa(31 * J), idMessageDernier: "msg-dernier" }) });
    const ev = await evenement({ type: "zernio.message", ageMs: 31 * J, idMessage: "msg-dernier" });
    expect(await reduire()).toBe(1);
    expect((await lire(ev)).charge.idConversation).toBeNull();
  });
});

describe("8 · rejeu Zernio APRÈS réduction : toujours dédupliqué", () => {
  const entree = (idEvenement: string, idMessage: string) => ({ idEvenement, type: "zernio.message", idMessage });
  it("mêmes champs conservés : la clé de déduplication secondaire (idCompte + idMessage / idCommentaire) est intacte", async () => {
    const a = await evenement({ type: "zernio.message", ageMs: 31 * J, idMessage: "msg-dedup" });
    const c = await evenement({ ageMs: 31 * J });
    const avant = [await lire(a), await lire(c)];
    await reduire();
    const apres = [await lire(a), await lire(c)];
    expect(apres[0].idEvenement).toBe(avant[0].idEvenement);
    expect(apres[0].charge.idCompte).toBe(avant[0].charge.idCompte);
    expect(apres[0].charge.idMessage).toBe("msg-dedup");
    expect(apres[1].charge.idCommentaire).toBe(avant[1].charge.idCommentaire);
    expect(apres[1].charge.idCompte).toBe(avant[1].charge.idCompte);
    void entree;
  });
});

describe("9 · un « stop » écrit APRÈS réduction par une personne connue est reconnu", () => {
  it("la conversation est retrouvée par empreinte (clé de l'état), l'opposition est enregistrée", async () => {
    const cle = cleConversation(A);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: graineConv("attente_email", { idMessageAdresse: null }) });
    await evenement({ ageMs: 31 * J });
    await reduire();
    expect(Object.keys(await conversations())).toEqual([cle]); // l'état (empreintes) n'a pas bougé
    expect(await OPP.empreintesOpposees([cle], { env: ENV })).toBe(false);
    await OPP.enregistrerOpposition(A, "zernio-conversation", { env: ENV });
    expect(await OPP.empreintesOpposees([cle], { env: ENV })).toBe(true);
  });
});

describe("10 · conversation close depuis plus de 30 jours : idCommentaire réduit (sauf oppose, sauf en cours)", () => {
  it("termine → « reduit » ; oppose → inchangée (décision de l'opérateur D3 : non tranchée) ; en cours → inchangée", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cleConversation("t")]: graineConv("termine", { creeLe: ilYa(40 * J), m1Le: ilYa(39 * J) }),
      [cleConversation("o")]: graineConv("oppose", { creeLe: ilYa(40 * J), m1Le: ilYa(39 * J) }),
      [cleConversation("e")]: graineConv("attente_email", { creeLe: ilYa(40 * J), m1Le: ilYa(39 * J) }),
      [cleConversation("r")]: graineConv("termine", { creeLe: ilYa(10 * J), m1Le: ilYa(9 * J) }),
    });
    await reduire();
    const c = await conversations();
    expect(c[cleConversation("t")].idCommentaire).toBe("reduit");
    expect(c[cleConversation("o")].idCommentaire).toBe("com-graine");
    expect(c[cleConversation("e")].idCommentaire).toBe("com-graine");
    expect(c[cleConversation("r")].idCommentaire).toBe("com-graine");
    for (const k of Object.keys(c)) expect(c[k].cleIdempotenceGuide).toBe("b".repeat(64)); // clé, alias, empreintes restent
    expect(Object.keys(c)).toHaveLength(4);
  });
});

describe("11 · idempotent, plafonné, une seule écriture par événement", () => {
  it("deux passages : aucun changement au second", async () => {
    const id = await evenement({ ageMs: 31 * J });
    await reduire();
    const apresUn = JSON.stringify(await lire(id));
    expect(await reduire()).toBe(0);
    expect(JSON.stringify(await lire(id))).toBe(apresUn);
  });
  it("au plus 50 événements par passage", async () => {
    for (let i = 0; i < 60; i++) await evenement({ ageMs: 31 * J });
    expect(await reduire()).toBe(50);
    expect(await reduire()).toBe(10);
  });
  it("expirerConversations lance aussi la réduction (même cadence)", async () => {
    const id = await evenement({ ageMs: 31 * J });
    await C.expirerConversations({ env: ENV_RED, maintenantMs: T0 });
    expect((await lire(id)).charge.idAuteur).toBeNull();
  });
});

describe("reductible (fonction pure)", () => {
  const faits = { idsMessagesProteges: new Set<string>(["protege"]) };
  const ev = (o: Record<string, unknown> = {}) => ({ traite: true, recuLe: ilYa(40 * J), modifieLe: ilYa(31 * J), charge: { idMessage: "m1" } as Record<string, unknown>, ...o });
  it("vrai seulement si tout est vrai", () => {
    expect(DELAI_REDUCTION_MS).toBe(30 * J);
    expect(reductible(ev(), faits, T0)).toBe(true);
    expect(reductible(ev({ traite: false }), faits, T0)).toBe(false);
    expect(reductible(ev({ modifieLe: ilYa(30 * J - 1) }), faits, T0)).toBe(false);
    expect(reductible(ev({ modifieLe: ilYa(30 * J) }), faits, T0)).toBe(true);
    expect(reductible(ev({ charge: { idMessage: "protege" } }), faits, T0)).toBe(false);
    expect(reductible(ev({ charge: { idMessage: "m1", idsReduitsLe: ilYa(J) } }), faits, T0)).toBe(false);
    expect(reductible(ev({ modifieLe: "illisible", recuLe: "illisible" }), faits, T0)).toBe(false); // date illisible : jamais réduit (échec fermé)
  });
});
