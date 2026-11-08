/**
 * FILET GUIDE · 5 — gardes : compte hors liste PARCOURS_CONVERSATION_COMPTES, mot inactif, textes non validés (empreinte),
 * « Tout arrêter », disjoncteur ouvert → rien n'est envoyé (ni port, ni site). Tests de caractérisation. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { comptesParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { cleConversation, deposerCommentaire, deposerMessage, evenement } from "../aides/conversation";
import { ADRESSE, AUTEUR, banc, C, Com, COMPTE, depots, ENV, envoisSortants, graineConv, lireTexteDe, MS, nettoyer, passer, preparer, registre, T0, toutesLesConversations, Z } from "./_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

beforeEach(preparer);
afterEach(nettoyer);

const cas: Array<[string, () => Promise<void>, Partial<Parameters<typeof C.traiterConversations>[0]>, string]> = [
  ["compte hors liste PARCOURS_CONVERSATION_COMPTES", async () => undefined, { comptesPermis: comptesParcours({ PARCOURS_CONVERSATION_COMPTES: "compte-fictif-autre" }) }, "garde_compte_hors_liste"],
  ["liste PARCOURS_CONVERSATION_COMPTES vide", async () => undefined, { comptesPermis: comptesParcours({}) }, "garde_compte_hors_liste"],
  ["mot GUIDE inactif (pause)", () => registre("pause"), {}, "garde_mot_inactif"],
  ["mot GUIDE absent du registre", () => Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {}), {}, "garde_mot_inactif"],
  ["textes non validés (aucune empreinte enregistrée)", () => Com.ecrireParametre(MS.PARAM_VALIDATION_GUIDE_PARCOURS, null), {}, "garde_validation_perimee"],
  ["textes validés puis modifiés (empreinte périmée)", () => Com.ecrireParametre(MS.PARAM_VALIDATION_GUIDE_PARCOURS, { empreinte: "0".repeat(64), valideLe: "2026-01-01T00:00:00.000Z" }), {}, "garde_validation_perimee"],
  ["« Tout arrêter » actif", () => Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, false), {}, "garde_tout_arrete"],
  ["disjoncteur ouvert", () => Com.ecrireParametre(MS.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "x" } }), {}, "garde_disjoncteur_ferme"],
];

describe.each(cas)("5 · %s", (_nom, regler, over, code) => {
  it("commentaire GUIDE : rien n'est envoyé, aucun état créé, l'événement attend (code de garde noté)", async () => {
    await regler();
    const id = await deposerCommentaire(depots, { reseau: "facebook" });
    const rap = await passer(T0, over);
    expect(envoisSortants()).toBe(0);
    expect(banc.site.vus).toHaveLength(0);
    expect(rap.enAttente).toBe(1);
    expect(rap.gardeBloquante).toBe("garde");
    expect(await toutesLesConversations()).toEqual({});
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ etat: "a_reessayer", dernierCode: code });
  });
  it("message avec une adresse valide : rien ne part (ni M2, ni site, ni accusé) ; l'événement attend", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(AUTEUR)]: graineConv("attente_email") });
    await regler();
    lireTexteDe(`Mon adresse : ${ADRESSE}`);
    const id = await deposerMessage(depots, {});
    await passer(T0, over);
    expect(envoisSortants()).toBe(0);
    expect(banc.site.vus).toHaveLength(0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge).toMatchObject({ etat: "a_reessayer", dernierCode: code });
  });
  it("une seule alerte par heure", async () => {
    await regler();
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer(T0, over);
    await passer(T0 + 61_000, over);
    expect(await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).toHaveLength(1);
  });
});

describe("5 · autres refus", () => {
  it("réseau non pris en charge (hors instagram / facebook) : rien ne part", async () => {
    const id = await deposerCommentaire(depots, { reseau: "linkedin" });
    await passer();
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, id)).charge.dernierCode).toBe("garde_reseau");
  });
  it("secret d'empreinte absent : aucun traitement, rien ne part, événement non touché", async () => {
    const id = await deposerCommentaire(depots, { reseau: "facebook" });
    const rap = await passer(T0, { env: { ...ENV, STUDIO_EMPREINTE_SECRET: undefined } });
    expect(rap.gardeBloquante).toBe("cles_absentes");
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, id)).traite).toBe(false);
  });
  it("interrupteur PARCOURS_CONVERSATION_ENABLED absent ou éteint : inerte (aucun appel, aucune écriture d'état)", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    for (const v of [undefined, "0", "non", ""]) {
      const rap = await passer(T0, { env: { ...ENV, PARCOURS_CONVERSATION_ENABLED: v } });
      expect(rap.actif).toBe(false);
    }
    expect(envoisSortants()).toBe(0);
    expect(await toutesLesConversations()).toEqual({});
  });
  it("(contrôle) toutes gardes levées : le même commentaire déclenche bien le parcours", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(banc.port.prive).toHaveLength(1);
    expect(COMPTE).toBe("compte-fictif-100");
  });
});
