/**
 * C1-a · renvoi impossible : RIEN ne part en public.
 * Quand le renvoi (mode « plusieurs mots ») ne peut pas partir en message privé, la réponse publique « je vous envoie le guide en message
 * privé » ne doit pas partir non plus. Faux port, faux site, données fictives, aucun réseau.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { CHEMIN_GUIDE } from "./aides/oppositions";
import { ADRESSE, AUTEUR, banc, C, Com, COMPTE, depots, ENV, lireTexteDe, nettoyer, passer, preparer, T0, toutesLesConversations } from "./filet-guide/_amorce";

const site = vi.hoisted(() => ({ versions: new Set<string>(["mp-m1-v4-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"]) }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => null }));

const { PARAM_MOTS_MULTIPLES } = await import("@/services/parcours-mots-multiples");

const H = 3_600_000;
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const ENV_PROD = { ...ENV };
const ENV_LIEN = { ...ENV_PROD, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const ENV_SANS_SECRET = { ...ENV_LIEN, GUIDES_RESEAU_LIEN_SECRET: undefined };
const FORMULATIONS = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"];
const SANS_DEJA_ENVOYE = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-lien-v3-1"];

const instantane = () => ({ pub: banc.port.pub.length, prive: banc.port.prive.length, envoyes: banc.port.envoyes.length, site: banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE).length });
const compteurs = () => Com.lireParametre<Record<string, any>>(C.PARAM_COMPTEURS_CONVERSATION, {});
const decrire = async (id: string) => {
  const e = await evenement(depots, id);
  return `${e.charge.etat}/${e.charge.dernierCode ?? "-"}`;
};

beforeEach(async () => {
  await preparer();
  await validerFormulationsAuParcours(FORMULATIONS);
  await Com.ecrireParametre(PARAM_MOTS_MULTIPLES, true);
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
});

/** Premier parcours livré (réponse publique + message privé + adresse + guide), puis le mot est retapé `apresMs` plus tard. */
async function livrerPuisRetaper(apresMs: number, env: Record<string, string | undefined>, id = "com-c1a-2") {
  await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-c1a-1", motSeul: "GUIDE", reseau: "facebook" });
  await passer(T0, { env: ENV_LIEN });
  lireTexteDe(ADRESSE);
  await deposerMessage(depots, { idMessage: "msg-c1a-adresse" });
  await passer(T0 + 1000, { env: ENV_LIEN });
  expect(instantane()).toMatchObject({ pub: 1, prive: 1, envoyes: 1, site: 1 });
  const evt = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: id, motSeul: "GUIDE", reseau: "facebook", ageMs: 1000 - apresMs });
  return { evt, avant: instantane(), compteurAvant: JSON.stringify(await compteurs()), rejouer: () => passer(T0 + apresMs, { env }) };
}

describe("C1-a · renvoi impossible : aucune réponse publique, aucun message privé", () => {
  it("formulation « déjà envoyé » NON validée : pub inchangé, aucun privé, m1_refuse/renvoi_impossible", async () => {
    await validerFormulationsAuParcours(SANS_DEJA_ENVOYE);
    const { evt, avant, rejouer } = await livrerPuisRetaper(25 * H, ENV_LIEN);
    await rejouer();
    expect(banc.port.pub).toHaveLength(avant.pub);
    expect(instantane()).toEqual(avant);
    expect(await decrire(evt)).toBe("m1_refuse/renvoi_impossible");
  });
  it("lien éteint : pub inchangé, aucun privé", async () => {
    const { evt, avant, rejouer } = await livrerPuisRetaper(25 * H, ENV_PROD);
    await rejouer();
    expect(instantane()).toEqual(avant);
    expect(await decrire(evt)).toBe("m1_refuse/renvoi_impossible");
  });
  it("secret du lien absent : pub inchangé, aucun privé", async () => {
    const { evt, avant, rejouer } = await livrerPuisRetaper(25 * H, ENV_SANS_SECRET);
    await rejouer();
    expect(instantane()).toEqual(avant);
    expect(await decrire(evt)).toBe("m1_refuse/renvoi_impossible");
  });
  it("le plafond horaire du compte n'est pas consommé par un renvoi impossible", async () => {
    const { avant, compteurAvant, rejouer } = await livrerPuisRetaper(25 * H, ENV_PROD);
    await rejouer();
    expect(instantane()).toEqual(avant);
    // Les compteurs sont par heure : le renvoi à T0 + 25 h ne doit y ajouter AUCUN envoi.
    const apres = await compteurs();
    const envoisA25h = Object.values(apres).filter((c: any) => c?.heure === Math.floor((T0 + 25 * H) / H) * H);
    expect(envoisA25h).toEqual([]);
    expect(compteurAvant).toBeDefined();
  });
});

describe("C1-a · non-régression : le parcours normal ne change pas", () => {
  it("renvoi possible : réponse publique + message privé (pub: 2, prive: 2)", async () => {
    const { rejouer } = await livrerPuisRetaper(25 * H, ENV_LIEN);
    await rejouer();
    expect(instantane()).toMatchObject({ pub: 2, prive: 2, site: 1 });
  });
  it("livré il y a moins de 24 h : réponse publique seule, aucun privé : aucune réponse publique, aucun privé", async () => {
    const { rejouer } = await livrerPuisRetaper(23 * H, ENV_LIEN);
    await rejouer();
    expect(instantane()).toMatchObject({ pub: 1, prive: 1, site: 1 });
  });
  it("premier envoi sans lien (réglage de production) : réponse publique puis premier message privé", async () => {
    await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-c1a-n", motSeul: "GUIDE", reseau: "facebook" });
    await passer(T0, { env: ENV_PROD });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    expect(Object.values(await toutesLesConversations())[0]).toMatchObject({ etat: "attente_email" });
  });
});
