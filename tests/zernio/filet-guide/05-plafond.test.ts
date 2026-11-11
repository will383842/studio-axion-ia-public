/**
 * FILET GUIDE · 6 — plafond d'écritures par heure et par compte (défaut 30, borné à 600). Tests de caractérisation. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOT_MAX_PAR_PASSAGE_CONVERSATION, PLAFOND_CONVERSATION_HEURE_COMPTE_DEFAUT, PLAFOND_HEURE_COMPTE_MAX, plafondHeureCompte } from "@/domaine/guide-reseau/plafonds-conversation";
import { deposerCommentaire, evenement } from "../aides/conversation";
import { banc, C, Com, COMPTE, depots, envoisSortants, nettoyer, passer, preparer, T0 } from "./_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const H = 3600_000;
const HEURE = Math.floor(T0 / H) * H;
const COMPTE2 = "compte-fictif-101";
const compteurs = () => Com.lireParametre<Record<string, any>>(C.PARAM_COMPTEURS_CONVERSATION, {});
const semer = (idCompte: string, envois: number, heure = HEURE) => Com.ecrireParametre(C.PARAM_COMPTEURS_CONVERSATION, { [idCompte]: { heure, envois } });

beforeEach(async () => {
  await preparer();
});
afterEach(nettoyer);

describe("6 · valeurs du plafond", () => {
  it("défaut 30, maximum 600, lot de 20 par passage", () => {
    expect(PLAFOND_CONVERSATION_HEURE_COMPTE_DEFAUT).toBe(30);
    expect(PLAFOND_HEURE_COMPTE_MAX).toBe(600);
    expect(LOT_MAX_PAR_PASSAGE_CONVERSATION).toBe(20);
    expect(C.PARAM_PLAFONDS_CONVERSATION).toBe("parcours.conversations.plafonds");
  });
  it.each<[unknown, number]>([[undefined, 30], [null, 30], [0, 30], [-5, 30], ["50", 30], [Number.NaN, 30], [{}, 30], [50, 50], [{ heureCompte: 80 }, 80], [1000, 600], [{ heureCompte: 100000 }, 600], [600, 600], [12.9, 12], [1, 1]])("réglage %j → plafond %d", (reglage, attendu) => {
    expect(plafondHeureCompte(reglage)).toBe(attendu);
  });
});

describe("6 · application du plafond", () => {
  it("compteur à 30 (défaut) : rien ne part, l'événement est reporté à l'heure suivante (plafond_heure), une alerte", async () => {
    await semer(COMPTE, 30);
    const id = await deposerCommentaire(depots, { reseau: "facebook" });
    const rap = await passer();
    expect(envoisSortants()).toBe(0);
    expect(rap.enAttente).toBe(1);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ etat: "a_reessayer", dernierCode: "plafond_heure", prochainEssaiLe: HEURE + H });
    expect(await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).toHaveLength(1);
  });
  it("compteur à 29 : la réponse publique part (30e écriture), puis M1 est bloqué ; à l'heure suivante M1 part, rien n'est perdu", async () => {
    await semer(COMPTE, 29);
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(0);
    await passer(HEURE + H + 1000);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
    expect((await compteurs())[COMPTE]).toEqual({ heure: HEURE + H, envois: 1 });
  });
  it("chaque écriture consomme 1 : un parcours (réponse publique + M1) = 2 sur le compteur", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect((await compteurs())[COMPTE]).toEqual({ heure: HEURE, envois: 2 });
  });
  it.each<[number, number, number, number]>([[5, 5, 4, 5], [1000, 600, 599, 600]])("réglage %d (borné à %d) : compteur à %d laisse passer l'écriture, compteur à %d la bloque", async (reglage, plafond, juste, plein) => {
    await Com.ecrireParametre(C.PARAM_PLAFONDS_CONVERSATION, reglage);
    await semer(COMPTE, plein);
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(plafondHeureCompte(reglage)).toBe(plafond);
    // nouveau cas, base propre : même réglage, compteur juste sous le plafond
    await preparer();
    await Com.ecrireParametre(C.PARAM_PLAFONDS_CONVERSATION, reglage);
    await semer(COMPTE, juste);
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(0);
  });
  it("le plafond est PAR COMPTE : un compte plein ne bloque pas l'autre", async () => {
    await Com.ecrireParametre((await import("@/services/mots-service")).PARAM_REGISTRE_MOTS, Object.fromEntries([COMPTE, COMPTE2].map((c) => [`GUIDE|${c}`, { mot: "GUIDE", compte: c, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" }])));
    await semer(COMPTE, 30);
    await deposerCommentaire(depots, { reseau: "facebook", idCompte: COMPTE });
    await deposerCommentaire(depots, { reseau: "facebook", idCompte: COMPTE2, idAuteur: "auteur-fictif-401" });
    await passer(T0, { comptesPermis: [COMPTE, COMPTE2] });
    expect(banc.port.prive).toHaveLength(1);
    expect((await compteurs())[COMPTE2].envois).toBe(2);
    expect((await compteurs())[COMPTE].envois).toBe(30);
  });
  it("une heure passée repart de zéro", async () => {
    await semer(COMPTE, 30, HEURE - H);
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(banc.port.prive).toHaveLength(1);
    expect((await compteurs())[COMPTE].heure).toBe(HEURE);
  });
  it("compteur illisible : échec fermé, rien ne part, nouvel essai dans une minute", async () => {
    await Com.ecrireParametre(C.PARAM_COMPTEURS_CONVERSATION, [1, 2, 3]);
    const id = await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, id)).charge).toMatchObject({ dernierCode: "compteur_illisible", prochainEssaiLe: T0 + 60_000 });
  });
});
