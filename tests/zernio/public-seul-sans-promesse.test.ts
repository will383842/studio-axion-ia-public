/**
 * C1-b · réponse publique seule sans promesse non tenue (option « a » décidée par le fondateur).
 * `deja_envoye` et `plafond_personne` : AUCUNE réponse publique (aucun message privé ne part). `en_cours` : réponse publique inchangée.
 * L'événement est clos avec le même classement qu'avant ; aucune place d'envoi n'est consommée. Faux port, faux site, données fictives.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { cleConversation, deposerCommentaire, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { AUTEUR, banc, C, Com, depots, ENV, graineConv, nettoyer, passer, preparer, T0, toutesLesConversations } from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => null }));

const { PARAM_MOTS_MULTIPLES } = await import("@/services/parcours-mots-multiples");

const H = 3_600_000;
const cleG = (n: string) => n.padEnd(64, "0");
const instantane = () => ({ pub: banc.port.pub.length, prive: banc.port.prive.length, envoyes: banc.port.envoyes.length });
const decrire = async (id: string) => {
  const e = await evenement(depots, id);
  return `${e.charge.etat}/${e.charge.dernierCode ?? "-"}`;
};
const compteurs = () => Com.lireParametre<Record<string, any>>(C.PARAM_COMPTEURS_CONVERSATION, {});

/** Un parcours déjà présent pour la personne, sous une clé de dossier `racine|n`. */
async function semer(n: string, cible: string, etat: string, extra: Record<string, unknown> = {}): Promise<void> {
  const cle = cleParcours(cleConversation(AUTEUR), cleG(n));
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    ...(await toutesLesConversations()),
    [cle]: { ...graineConv(etat, { cleIdempotenceGuide: cleG(n), idCommentaire: `com-graine-${n}`, mot: n.toUpperCase(), nature: "premier", groupeM1: "m1-lien", guide: cible, ...extra }) },
  });
}
const envoyeIlYa = (ms: number) => ({ m1Le: new Date(T0 - ms).toISOString() });

beforeEach(async () => {
  await preparer();
  await validerFormulationsAuParcours();
  await Com.ecrireParametre(PARAM_MOTS_MULTIPLES, true);
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
});

describe("C1-b · réponses publiques seules : compteur par raison", () => {
  it("deja_envoye : AUCUNE réponse publique, rien ne part, événement clos « public_seul/deja_envoye »", async () => {
    await semer("a", "guide-ia", "termine", envoyeIlYa(2 * H));
    const avant = JSON.stringify(await compteurs());
    const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-c1b-1", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV });
    expect(instantane()).toEqual({ pub: 0, prive: 0, envoyes: 0 });
    expect(await decrire(evt)).toBe("public_seul/deja_envoye");
    expect(JSON.stringify(await compteurs())).toBe(avant); // aucune place d'envoi consommée
  });

  it("plafond_personne : AUCUNE réponse publique, rien ne part, événement clos « public_seul/plafond_personne »", async () => {
    await semer("a", "gde-aaaaaa", "attente_email", envoyeIlYa(23 * H));
    await semer("b", "gde-bbbbbb", "attente_email", envoyeIlYa(10 * H));
    await semer("c", "gde-cccccc", "attente_email", envoyeIlYa(1 * H));
    const avant = JSON.stringify(await compteurs());
    const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-c1b-2", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV });
    expect(instantane()).toEqual({ pub: 0, prive: 0, envoyes: 0 });
    expect(await decrire(evt)).toBe("public_seul/plafond_personne");
    expect(JSON.stringify(await compteurs())).toBe(avant);
  });

  it("en_cours : la réponse publique part toujours (inchangé), sans message privé", async () => {
    await semer("a", "guide-ia", "pub_ok", envoyeIlYa(60_000));
    const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-c1b-3", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV });
    expect(instantane()).toEqual({ pub: 1, prive: 0, envoyes: 0 });
    expect(await decrire(evt)).toBe("public_seul/en_cours");
  });
});
