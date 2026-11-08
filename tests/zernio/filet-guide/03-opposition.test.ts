/**
 * FILET GUIDE · 4 — « stop » (et variantes reconnues par opposition.ts), en commentaire ET en message privé : tout est coupé, l'opposition l'emporte.
 * Tests de caractérisation. Données fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estMotOpposition, MOTS_OPPOSITION } from "@/domaine/guide-reseau/opposition";
import { cleConversation, deposerCommentaire, deposerMessage, evenement } from "../aides/conversation";
import { ADRESSE, AUTEUR, banc, C, Com, COMPTE, depots, ENV, envoisSortants, graineConv, lireTexteDe, nettoyer, Opp, passer, preparer, T0, toutesLesConversations } from "./_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

beforeEach(preparer);
afterEach(nettoyer);

const VARIANTES = ["stop", "STOP", "Stop", "stop.", "stop !", "  stop  ", "arret", "ARRET", "arrêt", "Arrêt", "arretez", "Arrêtez", "Arrêtez !", "arrêtez."];
const NON_OPPOSITIONS = ["stoppez", "ne pas arrêter", "stop svp", "oui", "", "GUIDE"];
const lignes = () => Com.lireParametre<Array<{ id: string }>>(Opp.PARAM_OPPOSITIONS_MOTS, []);

describe("4 · reconnaissance (opposition.ts)", () => {
  it("liste exacte des mots", () => expect([...MOTS_OPPOSITION]).toEqual(["STOP", "ARRET", "ARRETEZ"]));
  it.each(VARIANTES)("« %s » est une opposition", (t) => expect(estMotOpposition(t)).toBe(true));
  it.each(NON_OPPOSITIONS)("« %s » n'est pas une opposition", (t) => expect(estMotOpposition(t)).toBe(false));
  it("null / undefined / non-texte : pas une opposition", () => {
    expect(estMotOpposition(null)).toBe(false);
    expect(estMotOpposition(undefined)).toBe(false);
  });
});

describe("4 · « stop » en commentaire", () => {
  it.each(["STOP", "ARRET", "ARRETEZ"])("« %s » : l'événement est clos « oppose », rien n'est envoyé, une ligne d'opposition est écrite", async (mot) => {
    const id = await deposerCommentaire(depots, { reseau: "facebook", motSeul: mot });
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(banc.site.vus).toHaveLength(0);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect(await lignes()).toHaveLength(1);
  });
  it("une réponse (estReponse) « STOP » coupe aussi", async () => {
    const id = await deposerCommentaire(depots, { reseau: "facebook", motSeul: "STOP", estReponse: true });
    await passer();
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
  });
  it("l'opposition l'emporte : un GUIDE ensuite, de la même personne, ne déclenche plus rien", async () => {
    await deposerCommentaire(depots, { reseau: "facebook", motSeul: "STOP" });
    await passer();
    const apres = await deposerCommentaire(depots, { reseau: "facebook", motSeul: "GUIDE" });
    await passer(T0 + 1000);
    expect(envoisSortants()).toBe(0);
    expect((await evenement(depots, apres)).traite).toBe(true);
    expect((await evenement(depots, apres)).charge.etat).toBe("silence");
  });
  it("l'opposition est enregistrée même quand une garde bloque les envois (compte hors liste)", async () => {
    const id = await deposerCommentaire(depots, { reseau: "facebook", motSeul: "STOP" });
    await passer(T0, { comptesPermis: ["autre-compte-fictif"] });
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect(await lignes()).toHaveLength(1);
  });
  it("personne déjà opposée dans le registre : un GUIDE ne démarre aucun parcours", async () => {
    await Opp.enregistrerOpposition(AUTEUR, "zernio-conversation", { env: ENV });
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(await toutesLesConversations()).toEqual({});
  });
});

describe("4 · « stop » en message privé", () => {
  beforeEach(async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(AUTEUR)]: graineConv("attente_email") });
  });
  it.each(["stop", "Arrêtez !", "ARRET"])("« %s » : état « oppose », aucun envoi, aucun appel au site", async (texte) => {
    lireTexteDe(texte);
    const id = await deposerMessage(depots, {});
    await passer();
    expect(envoisSortants()).toBe(0);
    expect(banc.site.vus).toHaveLength(0);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect((await toutesLesConversations())[cleConversation(AUTEUR)].etat).toBe("oppose");
    expect(await lignes()).toHaveLength(2);
  });
  it("l'opposition l'emporte : après un « stop » privé, un message avec une adresse valide ne produit ni appel au site ni accusé", async () => {
    lireTexteDe("stop");
    await deposerMessage(depots, {});
    await passer();
    lireTexteDe(`Finalement, ${ADRESSE}`);
    const apres = await deposerMessage(depots, {});
    await passer(T0 + 1000);
    expect(banc.site.vus).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect((await evenement(depots, apres)).charge.etat).toBe("silence");
  });
  it("le « stop » est lu et pris en compte même quand toutes les gardes bloquent (Tout arrêter, compte hors liste)", async () => {
    await Com.ecrireParametre((await import("@/services/zernio")).PARAM_ARRET_ZERNIO, false);
    lireTexteDe("stop");
    const id = await deposerMessage(depots, {});
    await passer(T0, { comptesPermis: ["autre-compte-fictif"], comptesLecture: [COMPTE] });
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect(envoisSortants()).toBe(0);
  });
  it("un « stop » arrivé entre-temps dans le registre arrête l'envoi juste avant le site (R5)", async () => {
    lireTexteDe(`Mon adresse : ${ADRESSE}`);
    const lire = banc.port.port.lireMessage;
    banc.port.port.lireMessage = async (p) => {
      const r = await lire(p);
      await Opp.enregistrerOpposition(AUTEUR, "zernio-conversation", { env: ENV }); // opposition posée pendant la lecture
      return r;
    };
    const id = await deposerMessage(depots, {});
    await passer();
    expect(banc.site.vus).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect((await evenement(depots, id)).traite).toBe(true);
  });
});
