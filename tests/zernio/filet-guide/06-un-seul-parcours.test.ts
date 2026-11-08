/**
 * FILET GUIDE · 7 — un seul parcours par personne ; M1 jamais envoyé deux fois (état m1_en_vol écrit AVANT l'envoi).
 * Tests de caractérisation. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { cleConversation, deposerCommentaire, deposerMessage, evenement, TITRE } from "../aides/conversation";
import { ADRESSE, AUTEUR, banc, C, depots, nettoyer, passer, preparer, T0, toutesLesConversations, lireTexteDe } from "./_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

beforeEach(preparer);
afterEach(nettoyer);

const etat = async () => (await toutesLesConversations())[cleConversation(AUTEUR)];

describe("7 · un seul parcours par personne", () => {
  it("trois commentaires GUIDE de la même personne : 1 réponse publique, 1 M1, 1 conversation", async () => {
    await deposerCommentaire(depots, { reseau: "facebook", idCommentaire: "com-A" });
    await deposerCommentaire(depots, { reseau: "facebook", idCommentaire: "com-B" });
    await passer();
    await deposerCommentaire(depots, { reseau: "facebook", idCommentaire: "com-C" });
    await passer(T0 + 60_000);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
    expect(Object.keys(await toutesLesConversations())).toHaveLength(1);
    expect((await etat()).etat).toBe("attente_email");
  });
  it("le même commentaire rejoué (même identifiant redéposé) ne relance rien", async () => {
    await deposerCommentaire(depots, { reseau: "facebook", idCommentaire: "com-A" });
    await passer();
    await deposerCommentaire(depots, { reseau: "facebook", idCommentaire: "com-A" });
    await passer(T0 + 60_000);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
  });
  it("deux personnes différentes : deux parcours indépendants", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await deposerCommentaire(depots, { reseau: "facebook", idAuteur: "auteur-fictif-401" });
    await passer();
    expect(banc.port.prive).toHaveLength(2);
    expect(Object.keys(await toutesLesConversations())).toHaveLength(2);
  });
  it("après la fin du parcours (guide envoyé), un nouveau GUIDE de la même personne ne rouvre rien", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    expect((await etat()).etat).toBe("termine");
    const avant = banc.port.pub.length + banc.port.prive.length + banc.port.envoyes.length;
    await deposerCommentaire(depots, { reseau: "facebook", idCommentaire: "com-apres" });
    await passer(T0 + 2000);
    expect(banc.port.pub.length + banc.port.prive.length + banc.port.envoyes.length).toBe(avant);
    expect(banc.site.vus).toHaveLength(1);
  });
});

describe("7 · M1 jamais envoyé deux fois", () => {
  it("l'état m1_en_vol est écrit AVANT l'envoi (visible pendant l'appel au port)", async () => {
    let pendant: string | undefined;
    const reel = banc.port.port.repondreEnPrive;
    banc.port.port.repondreEnPrive = async (p) => {
      pendant = (await etat())?.etat;
      return reel(p);
    };
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(pendant).toBe("m1_en_vol");
    expect((await etat()).etat).toBe("attente_email");
    expect(banc.port.prive).toHaveLength(1);
    expect(banc.port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
  });
  it("plantage pendant l'envoi : m1_a_verifier, aucun second envoi sur 10 passages", async () => {
    banc.port.reponses.prive = () => {
      throw new Error("plantage simulé");
    };
    await deposerCommentaire(depots, { reseau: "facebook" });
    for (let i = 0; i < 10; i++) await passer(T0 + i * 60_000);
    expect(banc.port.prive).toHaveLength(1);
    expect((await etat()).etat).toBe("m1_a_verifier");
  });
  it("issue inconnue du port (a_verifier) : m1_a_verifier, jamais de renvoi", async () => {
    banc.port.reponses.prive = () => ({ statut: "a_verifier", code: "reponse-privee-inconnue", etat: "a_verifier", issueInconnue: true });
    await deposerCommentaire(depots, { reseau: "facebook" });
    for (let i = 0; i < 10; i++) await passer(T0 + i * 60_000);
    expect(banc.port.prive).toHaveLength(1);
    expect((await etat()).etat).toBe("m1_a_verifier");
  });
  it("redémarrage du processus avec un m1_en_vol resté en base : traité comme m1_a_verifier, alerte, aucun envoi", async () => {
    const { graineConv, Com } = await import("./_amorce");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(AUTEUR)]: graineConv("m1_en_vol") });
    await deposerCommentaire(depots, { reseau: "facebook", idCommentaire: "com-reprise" });
    await passer();
    expect((await etat()).etat).toBe("m1_a_verifier");
    expect((await etat()).dernierCode).toBe("redemarrage");
    expect(banc.port.prive).toHaveLength(0);
    expect(banc.port.pub).toHaveLength(0);
  });
  it("événement reporté (réponse publique à réessayer) puis repris : M1 part une seule fois", async () => {
    let n = 0;
    banc.port.reponses.pub = () => (++n < 2 ? { statut: "a_reessayer", code: "debit", reessayerApresSec: 1 } : { statut: "envoye", idMessage: "msg-sortant-fictif" });
    const id = await deposerCommentaire(depots, { reseau: "facebook" });
    for (let i = 0; i < 5; i++) await passer(T0 + i * 10_000);
    expect(banc.port.prive).toHaveLength(1);
    expect((await evenement(depots, id)).traite).toBe(true);
  });
});
