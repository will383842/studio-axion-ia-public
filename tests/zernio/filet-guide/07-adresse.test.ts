/**
 * FILET GUIDE · 8 — adresse invalide → M2 ; adresse valide → appel au site fictif puis accusé mp-recu-v2.
 * Tests de caractérisation. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { cleConversation, deposerCommentaire, deposerMessage, evenement, TITRE } from "../aides/conversation";
import { ADRESSE, AUTEUR, banc, depots, lireTexteDe, nettoyer, passer, pm, preparer, T0, toutesLesConversations } from "./_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

beforeEach(async () => {
  await preparer();
  await deposerCommentaire(depots, { reseau: "facebook" });
  await passer(); // réponse publique + M1 → attente_email
});
afterEach(nettoyer);

const etat = async () => (await toutesLesConversations())[cleConversation(AUTEUR)];
const M2 = () => rendreTexteMp("mp-m2-v1", {});

describe("8 · adresse invalide → M2", () => {
  it.each(["bonjour, je veux le guide", "mon adresse : pas-une-adresse", "adresse@", "@exemple.test", "adresse@exemple", "12345", "adresse arobase exemple point test"])("« %s » : M2 envoyé une fois, site non appelé, l'état passe à m2_envoye", async (texte) => {
    lireTexteDe(texte);
    const id = await deposerMessage(depots, { idMessage: "msg-invalide" });
    await passer(T0 + 1000);
    expect(banc.site.vus).toHaveLength(0);
    expect(banc.port.envoyes).toEqual([{ texte: M2(), cle: "msg-invalide" }]);
    expect((await etat()).m2Envoye).toBe(true);
    expect((await etat()).etat).toBe("m2_envoye");
    expect((await evenement(depots, id)).traite).toBe(true);
  });
  it("M2 n'est jamais envoyé deux fois : un 2e message sans adresse reste sans réponse", async () => {
    lireTexteDe("rien");
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    await deposerMessage(depots, {});
    await passer(T0 + 2000);
    expect(banc.port.envoyes.filter((e) => e.texte === M2())).toHaveLength(1);
    expect(banc.site.vus).toHaveLength(0);
  });
  it("après M2, une adresse valide déclenche bien la demande de guide puis l'accusé", async () => {
    lireTexteDe("rien");
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    lireTexteDe(`Voici : ${ADRESSE}`);
    await deposerMessage(depots, { idMessage: "msg-adresse" });
    await passer(T0 + 2000);
    expect(banc.site.vus).toHaveLength(1);
    expect(banc.port.envoyes.at(-1)).toEqual({ texte: rendreTexteMp("mp-recu-v2", { titre: TITRE }), cle: "msg-adresse" });
    expect((await etat()).etat).toBe("termine");
  });
});

describe("8 · adresse valide → site fictif puis accusé mp-recu-v2", () => {
  it.each([ADRESSE, `Voici mon adresse : ${ADRESSE}`, `${ADRESSE.toUpperCase()}`, `  ${ADRESSE}  `])("« %s » : un appel au site, puis l'accusé, état termine", async (texte) => {
    lireTexteDe(texte);
    const id = await deposerMessage(depots, { idMessage: "msg-adresse" });
    await passer(T0 + 1000);
    expect(banc.site.vus).toHaveLength(1);
    expect(banc.site.vus[0].chemin).toBe(pm.CHEMIN_DEMANDES_GUIDE);
    expect(JSON.parse(banc.site.vus[0].corps).email.toLowerCase()).toBe(ADRESSE);
    expect(banc.port.envoyes).toEqual([{ texte: rendreTexteMp("mp-recu-v2", { titre: TITRE }), cle: "msg-adresse" }]);
    expect(banc.port.envoyes[0].texte).toContain(TITRE);
    expect((await etat()).etat).toBe("termine");
    expect((await etat()).dernierCode).toBeNull();
    expect((await evenement(depots, id)).charge.etat).toBe("termine");
  });
  it("l'ordre est strict : l'appel au site précède l'envoi de l'accusé", async () => {
    const ordre: string[] = [];
    const transport = banc.site.transport;
    banc.site.transport = async (r) => (ordre.push("site"), transport(r));
    pm.injecterTransportSite(banc.site.transport);
    const env = banc.port.port.envoyerMessage;
    banc.port.port.envoyerMessage = async (p) => (ordre.push("accuse"), env(p));
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    expect(ordre).toEqual(["site", "accuse"]);
  });
  it("le site refuse (422 définitif) : aucun accusé, état site_refuse", async () => {
    banc.site.reponses = () => ({ statut: 422, corps: {} });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    expect(banc.port.envoyes).toHaveLength(0);
    expect((await etat()).etat).toBe("site_refuse");
  });
  it("le site est en panne (503) : aucun accusé, l'événement attend et la demande est rejouée avec les mêmes octets", async () => {
    banc.site.reponses = () => ({ statut: 503 });
    lireTexteDe(ADRESSE);
    const id = await deposerMessage(depots, {});
    await passer(T0 + 1000);
    await passer(T0 + 8 * 3600_000);
    expect(banc.port.envoyes).toHaveLength(0);
    expect((await evenement(depots, id)).traite).toBe(false);
    expect(new Set(banc.site.vus.map((v) => v.corps)).size).toBe(1);
  });
  it("une fois terminé, un message de plus n'envoie plus rien (pas de deuxième demande ni de deuxième accusé)", async () => {
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    await deposerMessage(depots, {});
    await passer(T0 + 2000);
    expect(banc.site.vus).toHaveLength(1);
    expect(banc.port.envoyes).toHaveLength(1);
  });
});
