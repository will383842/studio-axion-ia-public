/**
 * LIA-C · RETOUR ARRIÈRE : le réglage « plusieurs mots » a été allumé (des parcours `racine|…` existent), puis ÉTEINT.
 * Éteint, une personne qui n'a plus d'enregistrement ancien mais un dossier `racine|…` ne démarre JAMAIS un nouveau parcours : silence.
 * Un « stop » reste enregistré et rattrapé. Données 100 % fictives ; faux port, faux site.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTEUR,
  banc,
  C,
  Com,
  depots,
  lireTexteDe,
  nettoyer,
  passer,
  preparer,
  T0,
} from "./filet-guide/_amorce";
import {
  cleConversation,
  deposerCommentaire,
  deposerMessage,
  ENV,
  evenement,
} from "./aides/conversation";

const etat = vi.hoisted(() => ({ allume: true }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/parcours-mots-multiples", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  motsMultiplesActifs: async () => etat.allume,
}));
vi.mock("@/services/cibles-site", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  lireCiblesSite: async () => null,
}));
const OT = await import("@/services/oppositions-transmission");

const comptes = () => ({
  pub: banc.port.pub.length,
  prive: banc.port.prive.length,
});
const conv = () =>
  Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const commenter = (id: string, a = T0) =>
  deposerCommentaire(depots, {
    idAuteur: AUTEUR,
    idCommentaire: id,
    motSeul: "GUIDE",
    ageMs: 1000 - (a - T0),
    reseau: "facebook",
  });

beforeEach(async () => {
  await preparer();
  OT.reinitialiserOppositionsTransmission();
  etat.allume = true;
});
afterEach(nettoyer);

describe("LIA-C · retour arrière (allumé puis éteint)", () => {
  async function parcoursEnAttente(): Promise<string> {
    await commenter("com-ra-1");
    await passer(T0);
    expect(comptes()).toEqual({ pub: 1, prive: 1 });
    const [cle] = Object.keys(await conv());
    expect(cle).toMatch(/^p1\..+\|/); // clé de dossier `racine|…`
    return cle;
  }

  it("(i) éteint : GUIDE de la même personne = silence, aucun envoi, aucune clé nouvelle", async () => {
    const cle = await parcoursEnAttente();
    etat.allume = false;
    const evt = await commenter("com-ra-2", T0 + 60_000);
    await passer(T0 + 60_000);
    expect(comptes()).toEqual({ pub: 1, prive: 1 });
    expect((await evenement(depots, evt)).charge).toMatchObject({
      etat: "silence",
      dernierCode: "silence",
    });
    expect(Object.keys(await conv())).toEqual([cle]);
    expect(Object.keys(await conv()).includes(cleConversation(AUTEUR))).toBe(
      false,
    );
  });

  it("(i) éteint : un « stop » écrit en privé est enregistré au registre, puis rattrapé (mise en file) sans rien envoyer", async () => {
    const cle = await parcoursEnAttente();
    // L'adresse a déjà été transmise au site : un « stop » doit lui être transmis.
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: { ...(await conv())[cle], occurredAt: new Date(T0).toISOString() },
    });
    etat.allume = false;
    await deposerMessage(depots, {
      idMessage: "msg-ra-stop",
      idExpediteur: AUTEUR,
      idConversation: "conv-fictive-700",
      avance: 60_000,
    });
    lireTexteDe("stop");
    // Orphelin : deux réessais, puis le texte est lu quand même (un « stop » n'est jamais perdu).
    await passer(T0 + 60_000);
    await passer(T0 + 100_000);
    await passer(T0 + 300_000);
    expect(comptes()).toEqual({ pub: 1, prive: 1 });
    expect(banc.port.envoyes).toHaveLength(0);
    const registre = await Com.lireParametre<unknown[]>("mots.oppositions", []);
    expect(registre.length).toBeGreaterThan(0);
    // Rattrapage : la réconciliation voit le dossier opposé et met son enregistrement en file.
    expect(
      await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 + 3600_000 }),
    ).toBe(1);
    expect(
      Object.keys(await Com.lireParametre("parcours.oppositions.file", {})),
    ).toEqual([cle]);
    // Et un GUIDE ensuite reste sans effet.
    const evt = await commenter("com-ra-3", T0 + 7200_000);
    await passer(T0 + 7200_000);
    expect(comptes()).toEqual({ pub: 1, prive: 1 });
    expect((await evenement(depots, evt)).charge.etat).toBe("silence");
  });

  it("éteint, une personne SANS dossier démarre un parcours ordinaire (clé sans `|`) : l'exception ne touche que le retour arrière", async () => {
    etat.allume = false;
    await commenter("com-ra-neuf");
    await passer(T0);
    expect(comptes()).toEqual({ pub: 1, prive: 1 });
    expect(Object.keys(await conv())).toEqual([cleConversation(AUTEUR)]);
  });
});
