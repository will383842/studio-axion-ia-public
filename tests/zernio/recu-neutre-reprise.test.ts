/**
 * C5 · reçu neutre : reprise du reçu (`reprendre_recu`), report au plafond horaire, événement `recu_neutre_non_valide` une seule fois par conversation.
 * Faux port, faux site, données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Evenement } from "@/domaine/types";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { cleConversation, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { AUTEUR, banc, C, Com, COMPTE, depots, graineConv, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const H = 3_600_000;
const HEURE = Math.floor(T0 / H) * H;
const N1 = "mp-recu-neutre-v1-1";
const RECU = "mp-recu-v3-1";
const TEXTE_N1 = "Merci, c'est noté. Si le guide n'arrive pas dans votre boîte mail, regardez aussi dans vos courriers indésirables.";
const cle = () => cleConversation(AUTEUR);
const etatDe = async () => (await toutesLesConversations())[cle()];
const semerIncertain = async (extra: Record<string, unknown> = {}) =>
  Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: graineConv("guide_demande", { idMessageGuide: "msg-accuse", guideIncertain: true, ...extra }) });
const nbEvenementNeutre = async () => (await depots().evenements.lister((e: Evenement) => String(e.message).includes("recu_neutre_non_valide"))).length;

beforeEach(async () => {
  await preparer();
});
afterEach(nettoyer);

describe("C5 · reprise du reçu (reprendre_recu) avec guideIncertain", () => {
  it("recu-neutre validé : la reprise envoie le texte neutre, jamais `recu`", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU, N1]);
    await semerIncertain();
    await deposerMessage(depots, { idMessage: "msg-accuse" });
    await passer(T0);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(TEXTE_N1);
    expect(banc.port.envoyes[0].texte).not.toBe(rendreTexteMp(RECU, { titre: TITRE }));
    expect(await etatDe()).toMatchObject({ etat: "termine", formulations: { "recu-neutre": N1 } });
  });

  it("report au plafond horaire : rien ne part et aucun événement ; au passage suivant, le texte neutre est gardé", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU, N1]);
    await Com.ecrireParametre(C.PARAM_COMPTEURS_CONVERSATION, { [COMPTE]: { heure: HEURE, envois: 30 } });
    await semerIncertain();
    const id = await deposerMessage(depots, { idMessage: "msg-accuse" });
    await passer(T0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "a_reessayer", dernierCode: "plafond_heure" });
    expect((await etatDe()).guideIncertain).toBe(true);
    await passer(HEURE + H + 1000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(TEXTE_N1);
  });
});

describe("C5 · événement recu_neutre_non_valide", () => {
  it("reçu reporté au plafond : aucun événement tant que le reçu ne part pas, puis un seul quand il part", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU]); // recu-neutre non validé
    await Com.ecrireParametre(C.PARAM_COMPTEURS_CONVERSATION, { [COMPTE]: { heure: HEURE, envois: 30 } });
    await semerIncertain();
    await deposerMessage(depots, { idMessage: "msg-accuse" });
    await passer(T0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await nbEvenementNeutre()).toBe(0);
    await passer(HEURE + H + 1000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(RECU, { titre: TITRE }));
    expect(await nbEvenementNeutre()).toBe(1);
  });

  it("deux reçus pour la même conversation : un seul événement", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", RECU]);
    await semerIncertain();
    await deposerMessage(depots, { idMessage: "msg-accuse" });
    await passer(T0);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(await nbEvenementNeutre()).toBe(1);
    expect((await etatDe()).recuNeutreNonValideJournale).toBe(true);
    // Deuxième passage du reçu pour la même conversation (état remis en attente du reçu, le booléen est gardé).
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle()]: { ...(await etatDe()), etat: "guide_demande", idMessageGuide: "msg-accuse-2", dernierCode: null } });
    await deposerMessage(depots, { idMessage: "msg-accuse-2", avance: 100 });
    await passer(T0 + 60_000);
    expect(banc.port.envoyes).toHaveLength(2);
    expect(await nbEvenementNeutre()).toBe(1);
  });
});
