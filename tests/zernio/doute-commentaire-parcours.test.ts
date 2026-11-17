/**
 * PR B · B2–B9 : un commentaire en doute d'opposition met en PAUSE tout le dossier de la personne et alerte (texte fixe).
 * Aucun texte stocké, rien au registre d'opposition ni au site ; le stop clair l'emporte toujours. Faux port, faux site, données fictives.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { AUTEUR, banc, C, Com, depots, ENV, envoisSortants, graineConv, MS, nettoyer, Opp, passer, preparer, T0, toutesLesConversations } from "./filet-guide/_amorce";
import { ADRESSE_FICTIVE, cleConversation, deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: () => true }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => null }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true, validationPourEnvoi: async () => null }));
const MM = await import("@/services/parcours-mots-multiples");
const FILE = await import("@/services/oppositions-transmission");

const H = 3600_000;
const MESSAGE = "Un commentaire contient peut-être une demande d'arrêt. Aucune réponse automatique ne sera envoyée à cette personne tant qu'elle n'a pas écrit elle-même une adresse e-mail ; son parcours est en pause. À vérifier dans les commentaires (Zernio).";
const iso = (ms: number) => new Date(ms).toISOString();
const racine = () => cleConversation(AUTEUR);
const cleG = (n: string) => n.padEnd(64, "0");

/** Dépose un commentaire en doute : charge SANS texte, motSeul null, doute true. */
async function doute(o: { ageMs?: number; idCommentaire?: string; estReponse?: boolean; idAuteur?: string } = {}): Promise<string> {
  const id = await deposerCommentaire(depots, { motSeul: null, ...o });
  const ev = await evenement(depots, id);
  await depots().evenementsFournisseurs.modifier(ev.id, { charge: { ...ev.charge, doute: true } });
  return id;
}
const alertesDoute = async () => (await depots().evenements.lister((e: any) => String(e.message).includes(MESSAGE))).length;
const dossier = async () => Object.values(await toutesLesConversations()) as any[];
const oppositions = () => Com.lireParametre<any[]>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const file = () => Com.lireParametre<Record<string, unknown>>(FILE.PARAM_OPPOSITIONS_FILE, {});
const rouvrir = async (id: string) => {
  const ev = await evenement(depots, id);
  await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, etat: "a_faire", dernierCode: null } });
};
async function semer(n: string, etatP: string, extra: Record<string, unknown> = {}): Promise<string> {
  const cle = cleParcours(racine(), cleG(n));
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await toutesLesConversations()), [cle]: { ...graineConv(etatP, { cleIdempotenceGuide: cleG(n), idCommentaire: `com-graine-${n}`, mot: "GUIDE", nature: "premier", groupeM1: "m1-adresse" }), ...extra } });
  return cle;
}

beforeEach(async () => {
  await preparer();
  await validerFormulationsAuParcours();
});
afterEach(nettoyer);

describe("B2 · mode éteint, personne inconnue : pause, alerte fixe, AUCUN envoi", () => {
  it("état expire + douteOpposition + doute_opposition ; 0 appel ; registre et file inchangés ; une alerte ; événement clos silence", async () => {
    const id = await doute();
    await passer(T0);
    expect(banc.port.total()).toBe(0);
    expect(envoisSortants()).toBe(0);
    const d = await dossier();
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ etat: "expire", douteOpposition: true, dernierCode: "doute_opposition", prochainEssaiLe: null });
    expect(await oppositions()).toEqual([]);
    expect(await file()).toEqual({});
    expect(banc.site.vus).toHaveLength(0);
    expect(await alertesDoute()).toBe(1);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "silence", dernierCode: "doute_opposition" });
  });
  it("aucun texte, aucun identifiant brut dans l'alerte ; l'état ne garde pas de texte du commentaire", async () => {
    await doute();
    await passer(T0);
    const alertes = await depots().evenements.lister((e: any) => String(e.message).includes(MESSAGE));
    expect(alertes[0].message).not.toContain(AUTEUR);
    const stocke = JSON.stringify([await dossier(), await depots().evenementsFournisseurs.lister(() => true)]);
    expect(stocke).not.toMatch(/"texte"/);
    expect(stocke).not.toMatch(/stop/i);
  });
  it("personne déjà « oppose » : silence « opposee », sans alerte, état inchangé", async () => {
    const cle = cleConversation(AUTEUR);
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: graineConv("oppose") });
    const id = await doute();
    await passer(T0);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "silence", dernierCode: "opposee" });
    expect(await alertesDoute()).toBe(0);
    expect((await dossier())[0].etat).toBe("oppose");
    expect(banc.port.total()).toBe(0);
  });
  it("un doute écrit en réponse à un autre commentaire compte", async () => {
    await doute({ estReponse: true });
    await passer(T0);
    expect((await dossier())[0]).toMatchObject({ etat: "expire", douteOpposition: true });
    expect(await alertesDoute()).toBe(1);
  });
});

describe("B3 · mode éteint : la reprise d'un M1 en réessai n'envoie rien après un doute", () => {
  it("pub_ok + M1 en réessai, puis doute : aucun M1 de plus", async () => {
    await deposerCommentaire(depots, {});
    banc.port.reponses.prive = () => ({ statut: "a_reessayer", code: "5xx" });
    await passer(T0);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
    expect((await dossier())[0].etat).toBe("pub_ok");
    banc.port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" });
    await doute();
    await passer(T0 + 1000);
    expect((await dossier())[0].douteOpposition).toBe(true);
    await passer(T0 + 5 * 60_000); // la reprise du M1
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.envoyes).toHaveLength(0);
  });
});

describe("B4 · mode éteint, attente_email : jamais de M2 après un doute ; une adresse explicite déclenche encore la demande", () => {
  it("M2 jamais envoyé, puis adresse explicite : demande de guide", async () => {
    await deposerCommentaire(depots, {});
    await passer(T0);
    expect((await dossier())[0].etat).toBe("attente_email");
    await doute();
    await passer(T0 + 1000);
    expect((await dossier())[0]).toMatchObject({ etat: "attente_email", douteOpposition: true });
    banc.port.reponses.texte = () => "bonjour";
    await deposerMessage(depots, { idMessage: "msg-b4a" });
    await passer(T0 + 2000);
    expect(banc.port.envoyes).toHaveLength(0); // pas de M2
    banc.port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "msg-b4b" });
    await passer(T0 + 3000);
    expect(banc.site.vus).toHaveLength(1);
    expect(banc.port.envoyes).toHaveLength(1);
  });
});

describe("B5 · mode éteint : doute puis GUIDE 25 h plus tard → silence (état expire, pas m1_refuse)", () => {
  it("rien ne part", async () => {
    await doute();
    await passer(T0);
    const apres = await deposerCommentaire(depots, { idCommentaire: "com-guide-tard" });
    const ev = await evenement(depots, apres);
    await depots().evenementsFournisseurs.modifier(ev.id, { recuLe: iso(T0 + 25 * H) });
    await passer(T0 + 25 * H + 1000);
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, apres)).charge.etat).toBe("silence");
    expect((await dossier())[0].etat).toBe("expire");
  });
});

describe("B5b · mode éteint : doute puis GUIDE sur une entrée m1_refuse ancienne → le doute dure, rien ne part", () => {
  it("0 appel au port, l'entrée garde douteOpposition", async () => {
    const cle = racine();
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: graineConv("m1_refuse", { refuseLe: iso(T0 - 30 * H), creeLe: iso(T0 - 31 * H), m1Le: null }) });
    await doute();
    await passer(T0);
    expect((await dossier())[0]).toMatchObject({ etat: "m1_refuse", douteOpposition: true });
    const apres = await deposerCommentaire(depots, { idCommentaire: "com-guide-apres-doute" });
    await passer(T0 + 1000);
    expect(banc.port.total()).toBe(0);
    expect(envoisSortants()).toBe(0);
    const d = await dossier();
    expect(d).toHaveLength(1);
    expect(d[0].douteOpposition).toBe(true);
    expect((await evenement(depots, apres)).charge.etat).toBe("silence");
  });
});

describe("B6 · mode allumé : tout le dossier est mis en pause", () => {
  beforeEach(async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  });
  it("dossier à 2 mots : les 2 en pause, états inchangés ; nouveau GUIDE → silence, 0 appel", async () => {
    await semer("1", "attente_email");
    await semer("2", "pub_ok", { mot: "CHATGPT" });
    await doute();
    await passer(T0);
    const d = await dossier();
    expect(d).toHaveLength(2);
    expect(d.every((x) => x.douteOpposition === true)).toBe(true);
    expect(d.map((x) => x.etat).sort()).toEqual(["attente_email", "pub_ok"]);
    expect(await alertesDoute()).toBe(1);
    expect(await oppositions()).toEqual([]);
    expect(banc.port.total()).toBe(0);
    const g = await deposerCommentaire(depots, { idCommentaire: "com-guide-apres", ageMs: 500 });
    await passer(T0 + 10_000);
    expect((await evenement(depots, g)).charge.etat).toBe("silence");
    expect(banc.port.total()).toBe(0);
  });
  it("personne inconnue : une entrée expire créée sous la racine, aucun envoi", async () => {
    await doute();
    await passer(T0);
    expect((await dossier())[0]).toMatchObject({ etat: "expire", douteOpposition: true, dernierCode: "doute_opposition" });
    expect(banc.port.total()).toBe(0);
  });
  it("dossier déjà « oppose » : silence « opposee », sans alerte", async () => {
    await semer("1", "oppose");
    const id = await doute();
    await passer(T0);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "silence", dernierCode: "opposee" });
    expect(await alertesDoute()).toBe(0);
  });
});

describe("B7 · même passage : GUIDE (t0) puis doute (t1) de la même personne → le doute est traité d'abord", () => {
  it("0 envoi", async () => {
    await deposerCommentaire(depots, { ageMs: 5000 });
    await doute({ ageMs: 1000 });
    await passer(T0);
    expect(envoisSortants()).toBe(0);
    expect(banc.port.total()).toBe(0);
  });
  it("un STOP posté après un GUIDE du même lot passe aussi avant lui", async () => {
    await deposerCommentaire(depots, { ageMs: 5000 });
    await deposerCommentaire(depots, { ageMs: 1000, motSeul: "STOP" });
    await passer(T0);
    expect(envoisSortants()).toBe(0);
  });
});

describe("B8 · rejeu du traitement (plantage avant la clôture)", () => {
  it("même état, pas de 2e alerte dans l'heure", async () => {
    const id = await doute();
    await passer(T0);
    const avant = await dossier();
    await rouvrir(id);
    await passer(T0 + 60_000);
    expect(await dossier()).toEqual(avant);
    expect(await alertesDoute()).toBe(1);
    expect(banc.port.total()).toBe(0);
  });
});

describe("B9 · doute puis STOP : le stop l'emporte", () => {
  it("registre inscrit et état oppose", async () => {
    await doute();
    await passer(T0);
    expect(await oppositions()).toEqual([]);
    await deposerCommentaire(depots, { motSeul: "STOP", ageMs: 500 });
    await passer(T0 + 10_000);
    expect((await oppositions()).length).toBeGreaterThan(0);
    expect((await dossier())[0].etat).toBe("oppose");
  });
});

describe("B10 · mots-service : traiterOppositions ignore un événement doute", () => {
  it("aucune écriture au registre d'opposition", async () => {
    await doute();
    const r = await MS.traiterOppositions({ env: { ...ENV, MOTS_ENABLED: "1" } });
    expect(r.prises).toBe(0);
    expect(await oppositions()).toEqual([]);
  });
});
