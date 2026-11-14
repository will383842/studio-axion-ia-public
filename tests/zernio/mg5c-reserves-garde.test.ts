/**
 * PR-A2 · réserves des relectures de la garde d'envoi par mot (suite de MG-5b). Faux Zernio, faux site : aucun réseau, données fictives.
 *  - « plusieurs mots » éteint / Instagram pas encore : l'événement est CLOS (jamais reporté), l'état et les données restent ;
 *  - GUIDE avec le réglage ÉTEINT : chemin strictement inchangé (aucun appel à la vérification par mot, mêmes états).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleConversation, deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { ADRESSE, AUTEUR, banc, Com, COMPTE, depots, ENV, graineConv, lireTexteDe, MS, nettoyer, passer, preparer, T0, TITRE } from "./filet-guide/_amorce";
import { CHEMIN_GUIDE } from "./aides/oppositions";

const site = vi.hoisted(() => ({ versions: new Set<string>(["mp-m1-v4-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"]), catalogue: null as unknown, lectures: [] as Array<number | undefined> }));
const espion = vi.hoisted(() => ({ verifier: 0, multiples: 0 }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async (o?: { maintenantMs?: number }) => (site.lectures.push(o?.maintenantMs), site.catalogue) }));
vi.mock("@/services/mots-validation-par-mot", async (orig) => {
  const m = await orig<Record<string, any>>();
  return { ...m, verifierMotPourEnvoi: async (...a: unknown[]) => (espion.verifier++, m.verifierMotPourEnvoi(...a)) };
});

const MM = await import("@/services/parcours-mots-multiples");
const V = await import("@/services/mots-validation-par-mot");

const ENV_TITRE = { PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE };
const ENV_LIEN = { ...ENV, ...ENV_TITRE, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: "secret-fictif-du-lien-0123456789-abcdefghij", LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const FORMULATIONS = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"];
const CODE = "gde-essai01";
const catalogue = (guideCible = "guide-ia") => ({
  catalogue: [
    { code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false },
    { code: CODE, type: "guide" as const, titre: "Titre essai", actif: true, test: false },
  ],
  liaisons: [
    { mot: "GUIDE", reseau: "tous" as const, codeCible: guideCible, actif: true },
    { mot: "CHATGPT", reseau: "tous" as const, codeCible: CODE, actif: true },
  ],
  luLe: T0, ignores: 0, depuisCopie: false,
});
const registre = async () => {
  const reg: Record<string, unknown> = {};
  for (const mot of ["GUIDE", "CHATGPT"]) reg[`${mot}|${COMPTE}`] = { mot, compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};
const demandes = () => banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE);
const conversations = () => Com.lireParametre<Record<string, any>>("parcours.conversations", {});

beforeEach(async () => {
  espion.verifier = 0;
  site.lectures.length = 0;
  await preparer();
  await validerFormulationsAuParcours(FORMULATIONS);
  site.catalogue = catalogue();
  await registre();
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
});

/** Parcours en base d'un mot autre que GUIDE ; l'adresse arrive ; le réglage / le réseau bloque. Retourne l'événement du message. */
async function semerEtEcrire(extra: Record<string, unknown>, id: string): Promise<string> {
  await Com.ecrireParametre("parcours.conversations", { [cleConversation(AUTEUR)]: graineConv("attente_email", { mot: "CHATGPT", guide: CODE, titreCible: "Titre essai", versionTexteM1: "mp-m1-v4-1", ...extra }) });
  lireTexteDe(ADRESSE);
  return deposerMessage(depots, { idMessage: id, idExpediteur: AUTEUR });
}
const decrire = async (id: string) => {
  const e = await evenement(depots, id);
  return { etat: e.charge.etat as string, code: e.charge.dernierCode as string | null, traite: e.traite as boolean };
};

describe("R2 · « plusieurs mots » éteint : l'événement est CLOS, jamais reporté (rien ne part après un rallumage)", () => {
  it("l'adresse d'un parcours CHATGPT, réglage éteint : ecarte / garde_plusieurs_mots_eteint ; l'état reste ; rallumé plus tard, rien ne part", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, false);
    const id = await semerEtEcrire({}, "msg-r2");
    const avant = Object.keys(await conversations());
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(await decrire(id)).toEqual({ etat: "ecarte", code: "garde_plusieurs_mots_eteint", traite: true });
    expect(Object.keys(await conversations())).toEqual(avant); // rien n'est supprimé : le parcours reste tel quel (seule l'activité est notée)
    expect(Object.values(await conversations())[0]).toMatchObject({ etat: "attente_email", mot: "CHATGPT" });
    // Rallumage des jours plus tard : l'événement est clos, l'adresse ne part pas.
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await passer(T0 + 3 * 24 * 3600_000, { env: ENV_LIEN });
    expect(demandes()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
  });
});

describe("R2 · reprise d'un message déjà reçu (état guide_demande) : même clôture", () => {
  it("réglage éteint : ecarte / garde_plusieurs_mots_eteint, état conservé", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, false);
    const id = await semerEtEcrire({ etat: "guide_demande", idMessageGuide: "msg-r2-reprise" }, "msg-r2-reprise");
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(await decrire(id)).toEqual({ etat: "ecarte", code: "garde_plusieurs_mots_eteint", traite: true });
    expect(Object.values(await conversations())[0]).toMatchObject({ etat: "guide_demande", mot: "CHATGPT" });
    expect(banc.port.envoyes).toHaveLength(0);
  });
});

describe("R2 · Instagram pas encore (autre mot) : l'événement est CLOS, jamais reporté", () => {
  it("l'adresse d'un parcours CHATGPT sur Instagram : ecarte / garde_instagram_pas_encore, rien ne part, même après un rallumage", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    const id = await semerEtEcrire({ reseau: "instagram" }, "msg-r2-ig");
    const avant = Object.keys(await conversations());
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(await decrire(id)).toEqual({ etat: "ecarte", code: "garde_instagram_pas_encore", traite: true });
    expect(Object.keys(await conversations())).toEqual(avant);
    expect(Object.values(await conversations())[0]).toMatchObject({ etat: "attente_email", mot: "CHATGPT" });
    expect(demandes()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
  });
});

describe("mg5b · GUIDE, réglage « plusieurs mots » ÉTEINT : chemin strictement inchangé", () => {
  it("parcours GUIDE en base (champ mot présent), l'adresse arrive : la demande au site part, aucun appel à la vérification par mot, aucune clôture de garde", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, false);
    await Com.ecrireParametre("parcours.conversations", { [cleConversation(AUTEUR)]: graineConv("attente_email", { mot: "GUIDE", guide: "guide-ia", titreCible: TITRE, versionTexteM1: "mp-m1-v4-1" }) });
    lireTexteDe(ADRESSE);
    const id = await deposerMessage(depots, { idMessage: "msg-guide-eteint", idExpediteur: AUTEUR });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(espion.verifier).toBe(0);
    expect(demandes()).toHaveLength(1);
    expect(banc.port.envoyes).toHaveLength(1);
    const d = await decrire(id);
    expect(d.code ?? "").not.toMatch(/garde_/);
    expect(d.etat).not.toBe("ecarte");
  });
});

describe("R3 · alerte au refus : le message du refus réel (Instagram ≠ « pas de textes validés »)", () => {
  it("commentaire CHATGPT sur Instagram : l'alerte dit Instagram, pas « pas de textes validés » ; événement clos", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    const id = await deposerCommentaire(depots, { idAuteur: AUTEUR, motSeul: "CHATGPT", reseau: "instagram" });
    await passer(T0, { env: ENV_LIEN });
    expect(await decrire(id)).toEqual({ etat: "ecarte", code: "instagram_pas_encore", traite: true });
    const alertes = (await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).map((e: any) => e.message as string);
    expect(alertes.some((m) => /Instagram n'est pas encore pris en charge/.test(m))).toBe(true);
    expect(alertes.some((m) => /pas de textes validés/.test(m))).toBe(false);
  });
});

describe("R4 · l'heure du passage (et non l'heure réelle) sert à lire les cibles, garde comprise", () => {
  it("un commentaire CHATGPT validé et envoyé : toutes les lectures du site reçoivent maintenantMs = l'instant du passage", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    const ap = (await V.apercuTextesMot({ mot: "CHATGPT", env: ENV, maintenantMs: T0 })).find((x) => x.reseau === "facebook")!;
    if (!ap.ok) throw new Error(`aperçu refusé : ${ap.raison}`);
    const r = await V.validerTextesMot({ mot: "CHATGPT", reseau: "facebook", empreinteVue: ap.empreinte, confirmeParOperateur: true, env: ENV, maintenantMs: T0 });
    if (!r.ok) throw new Error(r.raison);
    site.lectures.length = 0;
    await deposerCommentaire(depots, { idAuteur: AUTEUR, motSeul: "CHATGPT", reseau: "facebook" });
    await passer(T0, { env: ENV_LIEN });
    expect(banc.port.prive).toHaveLength(1);
    expect(site.lectures.length).toBeGreaterThan(0);
    expect(site.lectures.every((m) => m === T0)).toBe(true);
  });
});
