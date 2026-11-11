/**
 * STU-MENAGE · expiration des conversations « en cours » qui ne finissent jamais (nouveau, pub_ok, guide_demande), 7 jours.
 * Jamais d'envoi, aucune ligne ni clé retirée. Données 100 % fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXPIRATION_MS, doitExpirer, transition } from "@/domaine/guide-reseau/machine-conversation";
import { ETATS_EN_COURS } from "@/domaine/guide-reseau/etats-parcours";
import { COMPTE, ENV, T0, cleConversation, fauxPort, silencerConsole } from "./aides/conversation";
import { graineConv } from "./aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");

const J = 24 * 3600_000;
const A = "auteur-fictif-400";
const conv = (etat: string, extra: Record<string, unknown> = {}) => graineConv(etat, extra) as any;
const ilYa = (ms: number) => new Date(T0 - ms).toISOString();

beforeEach(() => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  silencerConsole();
});
afterEach(() => vi.restoreAllMocks());

describe("12 · nouveau, pub_ok et guide_demande expirent après 7 jours (pure)", () => {
  it.each(["nouveau", "pub_ok"])("%s : 7 j + 1 ms → expire ; 7 j − 1 ms → non (date de référence : creeLe)", (etat) => {
    expect(doitExpirer(conv(etat, { creeLe: ilYa(EXPIRATION_MS + 1), m1Le: null }), T0)).toBe(true);
    expect(doitExpirer(conv(etat, { creeLe: ilYa(EXPIRATION_MS - 1), m1Le: null }), T0)).toBe(false);
  });
  it("guide_demande : date de référence m1Le puis creeLe", () => {
    expect(doitExpirer(conv("guide_demande", { m1Le: ilYa(EXPIRATION_MS + 1), creeLe: ilYa(1000) }), T0)).toBe(true);
    expect(doitExpirer(conv("guide_demande", { m1Le: ilYa(EXPIRATION_MS - 1), creeLe: ilYa(30 * J) }), T0)).toBe(false);
    expect(doitExpirer(conv("guide_demande", { m1Le: null, creeLe: ilYa(EXPIRATION_MS + 1) }), T0)).toBe(true);
  });
  it("date illisible = expiré (jamais un état éternel)", () => {
    for (const etat of ["nouveau", "pub_ok", "guide_demande"]) expect(doitExpirer(conv(etat, { creeLe: "n'importe quoi", m1Le: null }), T0), etat).toBe(true);
  });
  it("les états finis, oppose et m1_consommee ne sont pas touchés", () => {
    for (const etat of ["termine", "site_refuse", "oppose", "m1_refuse", "m1_consommee", "expire"]) expect(doitExpirer(conv(etat, { creeLe: ilYa(90 * J) }), T0), etat).toBe(false);
  });
});

describe("12 · le passage d'expiration : aucun envoi, aucune clé retirée", () => {
  it("expire les trois états à 7 j + 1 ms, laisse les plus jeunes, retire aucune clé, n'envoie rien", async () => {
    const dernier = (e: string, creeLe: string, m1Le: string | null = null) => ({ etat: e, creeLe, m1Le });
    const seed: Record<string, any> = {
      [cleConversation("p1")]: conv("nouveau", dernier("nouveau", ilYa(EXPIRATION_MS + 1))),
      [cleConversation("p2")]: conv("pub_ok", dernier("pub_ok", ilYa(EXPIRATION_MS + 1))),
      [cleConversation("p3")]: conv("guide_demande", dernier("guide_demande", ilYa(10 * J), ilYa(EXPIRATION_MS + 1))),
      [cleConversation("j1")]: conv("nouveau", dernier("nouveau", ilYa(EXPIRATION_MS - 1))),
      [cleConversation("j2")]: conv("pub_ok", dernier("pub_ok", ilYa(EXPIRATION_MS - 1))),
      [cleConversation("j3")]: conv("guide_demande", dernier("guide_demande", ilYa(10 * J), ilYa(EXPIRATION_MS - 1))),
    };
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, seed);
    const port = fauxPort();
    const n = await C.expirerConversations({ env: ENV, maintenantMs: T0 });
    expect(n).toBe(3);
    const apres = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
    expect(Object.keys(apres).sort()).toEqual(Object.keys(seed).sort());
    for (const p of ["p1", "p2", "p3"]) expect(apres[cleConversation(p)].etat, p).toBe("expire");
    for (const j of ["j1", "j2", "j3"]) expect(apres[cleConversation(j)].etat, j).toBe(seed[cleConversation(j)].etat);
    expect(port.total()).toBe(0);
    // idempotent
    expect(await C.expirerConversations({ env: ENV, maintenantMs: T0 })).toBe(0);
  });
});

describe("13 · un message reçu sur une conversation expirée : seul un « stop » est lu", () => {
  it.each(["nouveau", "pub_ok", "guide_demande"] as const)("%s expirée : un message ne relance rien (action lire_opposition)", (etat) => {
    const e = conv("expire", { etat: "expire" });
    const s = transition(e, { t: "message", idExpediteur: A, idCompte: COMPTE, idMessage: "msg-1" });
    expect(s.action).toBe("lire_opposition");
    expect(etat).toBeTruthy();
  });
});

describe("14 · le compteur « conversations actives » baisse d'autant", () => {
  it("trois conversations bloquées en cours, expirées → le compteur actif passe de 3 à 0", async () => {
    const k = Opp; // etatRegistreEmpreintes lit les conversations
    const seed: Record<string, any> = {
      [cleConversation("p1")]: conv("nouveau", { creeLe: ilYa(8 * J), m1Le: null }),
      [cleConversation("p2")]: conv("pub_ok", { creeLe: ilYa(8 * J), m1Le: null }),
      [cleConversation("p3")]: conv("guide_demande", { creeLe: ilYa(9 * J), m1Le: ilYa(8 * J) }),
    };
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, seed);
    const actives = async () => Object.values((await k.etatRegistreEmpreintes({ env: ENV })).conversationsActivesParKid).reduce((a, b) => a + b, 0);
    expect(await actives()).toBe(3);
    await C.expirerConversations({ env: ENV, maintenantMs: T0 });
    expect(await actives()).toBe(0);
    expect(ETATS_EN_COURS).toContain("nouveau");
  });
});

void depots;
