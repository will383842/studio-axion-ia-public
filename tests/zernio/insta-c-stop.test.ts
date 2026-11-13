/**
 * INSTA-C · un « stop » gagne partout, au moindre doute RIEN ne part (branchement Instagram « suivre le compte puis OK »).
 * Données 100 % fictives ; faux port, faux site : aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";
import { cleConversation, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";

const etat = vi.hoisted(() => ({ appels: 0, opposeeDepuis: null as number | null, source: "registre" as "registre" | "doute" }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: () => true }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => null }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true }));
vi.mock("@/services/oppositions-mots", async (orig) => {
  const reel = await orig<Record<string, any>>();
  return {
    ...reel,
    personneOpposeePartout: async (p: unknown, o?: unknown) => {
      etat.appels++;
      if (etat.opposeeDepuis !== null && etat.appels >= etat.opposeeDepuis) return { opposee: true, source: etat.source };
      return reel.personneOpposeePartout(p, o);
    },
  };
});

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

const H = 3600_000;
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: "secret-fictif-du-lien-0123456789-abcdefghij", LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const iso = (ms: number) => new Date(ms).toISOString();
const racine = () => cleConversation(AUTEUR);
const cleG = (n: string) => n.padEnd(64, "0");
const suivi = { appels: 0 };
const envois: any[] = [];

async function semer(n: string, etatP: string, extra: Record<string, unknown> = {}, reseau = "instagram"): Promise<string> {
  const cle = cleParcours(racine(), cleG(n));
  const conv = await toutesLesConversations();
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    ...conv,
    [cle]: {
      ...graineConv(etatP, {
        reseau, cleIdempotenceGuide: cleG(n), idCommentaire: `com-graine-${n}`, mot: "GUIDE", nature: "premier", groupeM1: "m1-lien", titreCible: TITRE,
        versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 5 * H), m1Le: iso(T0 - 5 * H + 1000),
      }),
      ...extra,
    },
  });
  return cle;
}
const parcours = async () => Object.values(await toutesLesConversations()) as any[];
const pass = (ms: number) => passer(ms, { env: ENV_LIEN });
const T1 = T0 + 10_000;
const opposee = async () => (await Opp.personneOpposeePartout({ idsBruts: [AUTEUR], empreintes: [racine()] }, { env: ENV_LIEN, douteBloque: false })).opposee;
let Opp: any;

beforeEach(async () => {
  await preparer();
  Opp = await vi.importActual("@/services/oppositions-mots");
  etat.appels = 0; etat.opposeeDepuis = null; etat.source = "registre";
  suivi.appels = 0; envois.length = 0;
  const p = banc.port.port as any;
  p.lireSuiviInstagram = async () => (suivi.appels++, { statut: "suit" });
  const env = p.envoyerMessage;
  p.envoyerMessage = async (a: any) => (envois.push(a), env(a));
  banc.port.reponses.texte = () => "OK";
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
  await validerFormulationsAuParcours(["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", "mp-lien-v3-1"]);
});
afterEach(nettoyer);

describe("INSTA-C · stop et doute", () => {
  it("6 · « stop » en message : rien ne part, aucune lecture du suivi, opposition inscrite partout (tout le dossier)", async () => {
    await semer("1", "ig_attente_ok");
    await semer("2", "ig_pas_encore", { pasEncoreLe: iso(T0 - H) });
    banc.port.reponses.texte = () => "stop";
    const e = await deposerMessage(depots, { idMessage: "msg-stop-1", avance: 5000 });
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(suivi.appels).toBe(0);
    expect((await parcours()).map((c) => c.etat)).toEqual(["oppose", "oppose"]);
    expect((await evenement(depots, e)).charge.etat).toBe("oppose");
    expect(await opposee()).toBe(true);
  });

  it("7 · personne déjà opposée sur Facebook avant le OK : rien ne part, follow-status jamais appelé, parcours Instagram à oppose", async () => {
    await semer("1", "ig_attente_ok");
    await semer("2", "oppose", {}, "facebook");
    await deposerMessage(depots, { idMessage: "msg-ok-1", avance: 5000 });
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(suivi.appels).toBe(0);
    expect((await parcours()).every((c) => c.etat === "oppose")).toBe(true);
  });

  it("8 · doute dans le texte : rien ne part, follow-status jamais appelé, état d'attente gardé, parcours en pause", async () => {
    await semer("1", "ig_attente_ok");
    banc.port.reponses.texte = () => "arrêt maladie";
    await deposerMessage(depots, { idMessage: "msg-doute-1", avance: 5000 });
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(suivi.appels).toBe(0);
    expect((await parcours())[0]).toMatchObject({ etat: "ig_attente_ok", douteOpposition: true });
    banc.port.reponses.texte = () => "OK";
    await deposerMessage(depots, { idMessage: "msg-ok-2", avance: 20_000 });
    await pass(T1 + 30_000);
    expect(envois).toHaveLength(0);
    expect(suivi.appels).toBe(0);
  });

  it("8 · doute posé sur un AUTRE parcours du dossier (autre mot) : le OK n'envoie rien, aucune lecture", async () => {
    await semer("1", "ig_attente_ok");
    await semer("2", "attente_email", { douteOpposition: true, versionTexteM1: "mp-lien-v3-1" });
    await deposerMessage(depots, { idMessage: "msg-ok-1", avance: 5000 });
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(suivi.appels).toBe(0);
    expect((await parcours())[0].etat).toBe("ig_attente_ok");
  });

  it("stop apparu JUSTE avant l'envoi du lien (contrôle « stop partout » juste avant) : rien ne part, parcours opposé", async () => {
    await semer("1", "ig_attente_ok");
    // contrôles : 1 = entrée du message, 2 = vérification du OK, 3 = juste avant l'envoi
    etat.opposeeDepuis = 3;
    await deposerMessage(depots, { idMessage: "msg-ok-1", avance: 5000 });
    await pass(T1);
    expect(envois).toHaveLength(0);
    const c = (await parcours())[0];
    expect(c.etat).not.toBe("attente_email");
    expect(["oppose", "ig_attente_ok"]).toContain(c.etat);
  });

  it("doute apparu JUSTE avant l'envoi : rien ne part, état d'attente restauré (aucun message consommé)", async () => {
    await semer("1", "ig_attente_ok");
    etat.opposeeDepuis = 3;
    etat.source = "doute";
    await deposerMessage(depots, { idMessage: "msg-ok-1", avance: 5000 });
    await pass(T1);
    expect(envois).toHaveLength(0);
    const c = (await parcours())[0];
    expect(c.etat).toBe("ig_attente_ok");
    expect(c.idMessageOk).toBeUndefined();
  });

  it("chaque envoi porte un jeton « non opposée » (un jeton par envoi)", async () => {
    await semer("1", "ig_attente_ok");
    await semer("2", "ig_attente_ok", { creeLe: iso(T0 - 4 * H) });
    await deposerMessage(depots, { idMessage: "msg-ok-1", avance: 5000 });
    await pass(T1);
    expect(envois).toHaveLength(2);
    expect(envois.every((a) => !!a.nonOpposee)).toBe(true);
    expect(envois[0].nonOpposee).not.toBe(envois[1].nonOpposee);
  });
});
