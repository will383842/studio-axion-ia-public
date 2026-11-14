/**
 * Réserves de la relecture de la 484 (rejeu borné sous garde) : la péremption est en lecture seule (aucun alias, aucune conversation touchée),
 * l'opposition passe toujours avant la péremption, et en mode « plusieurs mots » un commentaire récent reste reporté sans répéter le journal. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleConversation, deposerCommentaire, ENV, evenement, SECRET_EMPREINTE } from "./aides/conversation";
import { AUTEUR, C, Com, depots, envoisSortants, graineConv, MS, nettoyer, passer, preparer, registre, T0 } from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const MM = await import("@/services/parcours-mots-multiples");
const Opp = await import("@/services/oppositions-mots");

const H = 3600_000;
beforeEach(preparer);
afterEach(nettoyer);

const lignesReport = async (): Promise<number> => (await depots().evenements.lister((e: { message: string }) => /a_reessayer/.test(e.message))).length;
const toutesLesConv = () => Com.lireParametre<Record<string, unknown>>(C.PARAM_CONVERSATIONS, {});
const alias = () => Com.lireParametre<Record<string, unknown>>(C.PARAM_CONVERSATIONS_ALIAS, {});
const oppositions = () => Com.lireParametre<unknown[]>(Opp.PARAM_OPPOSITIONS_MOTS, []);

describe.each([["historique", false], ["plusieurs mots", true]])("réserves 484 · mode %s", (_nom, multi) => {
  beforeEach(async () => {
    if (multi) await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  });
  // Garde durable : en pause (historique) ou disjoncteur ouvert (plusieurs mots, où un mot en pause est écarté avant la garde).
  const bloquer = (): Promise<void> => (multi ? Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } }) : registre("pause"));

  it("1 · GUIDE reçu il y a 25 h, sans conversation : périmé, table d'alias vide, conversations inchangées", async () => {
    await bloquer();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 25 * H });
    const avant = await toutesLesConv();
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge).toMatchObject({ etat: "perime", dernierCode: "perime" });
    expect(await alias()).toEqual({});
    expect(await toutesLesConv()).toEqual(avant);
    expect(envoisSortants()).toBe(0);
  });

  it("1b · même cas après rotation des clés, personne connue sous l'ancienne clé (autre commentaire) : périmé, aucun alias écrit", async () => {
    await bloquer();
    const cle = cleConversation(AUTEUR); // forme de l'ancienne clé : la lecture par retrouver() y écrirait un alias
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: graineConv("attente_email", { idCommentaire: "com-autre" }) });
    const avant = await toutesLesConv();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 25 * H });
    await passer(T0, { env: { ...ENV, STUDIO_EMPREINTE_SECRET: "secret-fictif-nouveau-rotation-0123456789", STUDIO_EMPREINTE_SECRET_ANCIEN: SECRET_EMPREINTE } });
    const ev = await evenement(depots, id);
    expect(ev.charge).toMatchObject({ etat: "perime", dernierCode: "perime" });
    expect(await alias()).toEqual({});
    expect(await toutesLesConv()).toEqual(avant);
  });

  it("2 · « STOP » reçu il y a 25 h sous garde bloquante : oppose (pas perime), opposition enregistrée", async () => {
    await bloquer();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 25 * H, motSeul: "STOP" });
    expect(await oppositions()).toEqual([]);
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge).toMatchObject({ etat: "oppose", dernierCode: "opposition" });
    expect((await oppositions()).length).toBeGreaterThan(0);
    expect((await Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).opposee).toBe(true);
  });
});

describe("réserves 484 · journal en mode plusieurs mots", () => {
  it("3 · commentaire récent (1 h) sous garde bloquante : reste a_reessayer, une seule ligne de journal après deux passages", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } });
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 1 * H });
    await passer(T0);
    await passer(T0 + 61_000);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ etat: "a_reessayer", dernierCode: "garde_disjoncteur_ferme" });
    expect(await lignesReport()).toBe(1);
  });
});
