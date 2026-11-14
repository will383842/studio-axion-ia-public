/**
 * Jamais de premier message privé tardif : Meta n'autorise la réponse privée à un commentaire que 7 jours. Une conversation pub_ok dont le commentaire a plus de
 * 7 jours passe à `expire` (événement clos « perime », aucun appel au port), garde durable ou non. Avant 7 jours, rien ne change. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleConversation, deposerCommentaire, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { AUTEUR, banc, C, Com, depots, envoisSortants, graineConv, MS, nettoyer, passer, preparer, registre, T0 } from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const MM = await import("@/services/parcours-mots-multiples");

const J = 24 * 3600_000;
beforeEach(preparer);
afterEach(nettoyer);

const conv = () => Com.lireParametre<Record<string, { etat: string }>>(C.PARAM_CONVERSATIONS, {});

describe.each([["mot unique", false], ["plusieurs mots", true]])("premier message privé tardif · %s", (_nom, multi) => {
  beforeEach(async () => {
    if (multi) await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await validerFormulationsAuParcours();
  });
  const bloquer = (): Promise<void> => (multi ? Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } }) : registre("pause"));
  const CODE = multi ? "garde_disjoncteur_ferme" : "garde_mot_inactif";
  const semer = () => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(AUTEUR)]: graineConv("pub_ok", { idCommentaire: "com-tardif" }) });
  const etatsApres = async () => Object.values(await conv()).map((e) => e.etat);

  it("pub_ok + garde + 8 jours : perime, conversation expirée, aucun appel au port", async () => {
    await bloquer();
    await semer();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 8 * J, idCommentaire: "com-tardif" });
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge).toMatchObject({ etat: "perime", dernierCode: "perime" });
    expect(await etatsApres()).toEqual(["expire"]);
    expect(envoisSortants()).toBe(0);
  });

  it("pub_ok + garde + 3 jours : reste a_reessayer, conversation intacte", async () => {
    await bloquer();
    await semer();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 3 * J, idCommentaire: "com-tardif" });
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ etat: "a_reessayer", dernierCode: CODE });
    expect(await etatsApres()).toEqual(["pub_ok"]);
  });

  it("pub_ok sans garde + 8 jours : aucun message privé, conversation expirée", async () => {
    await registre("actif");
    await semer();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 8 * J, idCommentaire: "com-tardif" });
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge).toMatchObject({ etat: "perime" });
    expect(banc.port.prive).toHaveLength(0);
    expect(envoisSortants()).toBe(0);
    expect(await etatsApres()).toEqual(["expire"]);
  });

  it("pub_ok sans garde + 2 jours : le message part", async () => {
    await registre("actif");
    await semer();
    await deposerCommentaire(depots, { reseau: "facebook", ageMs: 2 * J, idCommentaire: "com-tardif" });
    await passer(T0);
    expect(banc.port.prive).toHaveLength(1);
  });

  it("« stop » reçu après 8 jours : oppose, avant tout", async () => {
    await bloquer();
    await semer();
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 8 * J, idCommentaire: "com-tardif", motSeul: "STOP" });
    await passer(T0);
    const ev = await evenement(depots, id);
    expect(ev.charge).toMatchObject({ etat: "oppose", dernierCode: "opposition" });
    expect(envoisSortants()).toBe(0);
  });

  it("nouveau sans garde + 8 jours : ni réponse publique ni message privé, conversation expirée", async () => {
    await registre("actif");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(AUTEUR)]: graineConv("nouveau", { idCommentaire: "com-tardif" }) });
    const id = await deposerCommentaire(depots, { reseau: "facebook", ageMs: 8 * J, idCommentaire: "com-tardif" });
    await passer(T0);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "perime" });
    expect(envoisSortants()).toBe(0);
    expect(await etatsApres()).toEqual(["expire"]);
  });
});
