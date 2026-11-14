/**
 * MG-5b · garde d'envoi PAR MOT (LIA-D). Un mot autre que GUIDE (ici CHATGPT) part seulement si : réglage « plusieurs mots » allumé,
 * ligne `mot|compte` active, textes validés pour CE mot et CE réseau (empreinte), cible du jour = cible validée (guide actif, non test, même titre),
 * réseau Facebook (Instagram : pas encore), personne non opposée. Faux Zernio, faux site, faux catalogue : aucun réseau, données fictives.
 * GUIDE (en production, lien Facebook) ne change pas : les cas GUIDE ci-dessous le figent.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { CHEMIN_GUIDE } from "./aides/oppositions";
import { cleConversation, deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import {
  ADRESSE, AUTEUR, banc, Com, COMPTE, depots, ENV, envoisSortants, graineConv, lireTexteDe, MS, nettoyer, Opp, passer, preparer, T0, TITRE, toutesLesConversations,
} from "./filet-guide/_amorce";

const site = vi.hoisted(() => ({
  versions: new Set<string>(["mp-m1-v4-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"]),
  catalogue: null as unknown,
}));
const espion = vi.hoisted(() => ({ appels: 0 }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => site.catalogue }));
vi.mock("@/services/mots-validation-par-mot", async (orig) => {
  const m = await orig<Record<string, any>>();
  return { ...m, verifierMotPourEnvoi: async (...a: unknown[]) => (espion.appels++, m.verifierMotPourEnvoi(...a)) };
});

const { PARAM_MOTS_MULTIPLES } = await import("@/services/parcours-mots-multiples");
const V = await import("@/services/mots-validation-par-mot");

const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const ENV_TITRE = { PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE };
const ENV_LIEN = { ...ENV, ...ENV_TITRE, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const FORMULATIONS = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"];
const TITRE_ESSAI = "Titre essai";
const CODE = "gde-essai01";
const A2 = "auteur-fictif-401";
const COMPTE_B = "compte-fictif-101";

const catalogue = (o: { test?: boolean; actif?: boolean; type?: string; titre?: string; copie?: boolean } = {}) => ({
  catalogue: [
    { code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false },
    { code: CODE, type: (o.type ?? "guide") as "guide", titre: o.titre ?? TITRE_ESSAI, actif: o.actif ?? true, test: o.test ?? false },
  ],
  liaisons: [
    { mot: "GUIDE", reseau: "tous" as const, codeCible: "guide-ia", actif: true },
    { mot: "CHATGPT", reseau: "tous" as const, codeCible: CODE, actif: true },
  ],
  luLe: T0, ignores: 0, depuisCopie: o.copie ?? false,
});
const registreMots = async (...mots: Array<[string, string]>) => {
  const reg: Record<string, unknown> = {};
  for (const [mot, compte] of mots) reg[`${mot}|${compte}`] = { mot, compte, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};
const valider = async (mot: string, reseau: "facebook" | "instagram", env: Record<string, string | undefined> = ENV) => {
  const a = (await V.apercuTextesMot({ mot, env, maintenantMs: T0 })).find((x) => x.reseau === reseau)!;
  if (!a.ok) throw new Error(`aperçu refusé : ${a.raison}`);
  const r = await V.validerTextesMot({ mot, reseau, empreinteVue: a.empreinte, confirmeParOperateur: true, env, maintenantMs: T0 });
  if (!r.ok) throw new Error(r.raison);
};
const demandes = () => banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE);
const lien = (t: string) => /https:\/\/axion-ia\.com\/guide-reseau\?j=[A-Za-z0-9_.-]+/.exec(t)?.[0];
const jeton = (t: string): any => JSON.parse(Buffer.from(lien(t)!.split("j=")[1].split(".")[0], "base64url").toString("utf8"));
const decrire = async (id: string) => {
  const e = await evenement(depots, id);
  return `${e.charge.etat}/${e.charge.dernierCode ?? "-"}`;
};
const com = (mot: string, o: Parameters<typeof deposerCommentaire>[1] = {}) => deposerCommentaire(depots, { idAuteur: AUTEUR, motSeul: mot, reseau: "facebook", ...o });
const instantane = () => ({ pub: banc.port.pub.length, prive: banc.port.prive.length, envoyes: banc.port.envoyes.length, site: demandes().length });
const RIEN = { pub: 0, prive: 0, envoyes: 0, site: 0 };

beforeEach(async () => {
  espion.appels = 0;
  await preparer();
  await validerFormulationsAuParcours(FORMULATIONS);
  site.catalogue = catalogue();
  await Com.ecrireParametre(PARAM_MOTS_MULTIPLES, true);
  await registreMots(["GUIDE", COMPTE], ["CHATGPT", COMPTE]);
  await valider("CHATGPT", "facebook");
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
});

describe("1 · CHATGPT sur Facebook, tout validé : part, avec la bonne cible", () => {
  it("une réponse publique, un M1 avec le titre de la cible et le jeton guide/mot ; puis l'adresse → demande au site + accusé", async () => {
    await com("CHATGPT");
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    const m1 = banc.port.prive[0].texte;
    expect(m1).toContain(TITRE_ESSAI);
    expect(jeton(m1)).toMatchObject({ guide: CODE, mot: "CHATGPT" });
    lireTexteDe(`Mon adresse : ${ADRESSE}`);
    await deposerMessage(depots, { idMessage: "msg-1-adresse" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(demandes()).toHaveLength(1);
    expect(JSON.parse(demandes()[0].corps)).toMatchObject({ guide: CODE, mot: "CHATGPT" });
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toContain(TITRE_ESSAI);
  });
});

describe("2 · Instagram : pas encore", () => {
  it("CHATGPT sur Instagram (même validé) : événement clos, aucun envoi", async () => {
    await valider("CHATGPT", "instagram");
    const id = await com("CHATGPT", { reseau: "instagram" });
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toEqual(RIEN);
    expect((await decrire(id)).startsWith("ecarte/")).toBe(true);
  });
});

describe("3 · mot en pause", () => {
  it("CHATGPT en pause sur le compte : rien (mot_inactif)", async () => {
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
      [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" },
      [`CHATGPT|${COMPTE}`]: { mot: "CHATGPT", compte: COMPTE, etat: "pause", idWorkflow: null, raison: null, modifieLe: "x" },
    });
    await com("CHATGPT");
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toEqual(RIEN);
    expect(await toutesLesConversations()).toEqual({});
  });
});

describe("4 · cible test, de type adresse ou inactive : rien", () => {
  it.each([
    ["test", { test: true }],
    ["adresse", { type: "adresse" }],
    ["inactive", { actif: false }],
  ])("cible %s", async (_n, o) => {
    site.catalogue = catalogue(o as any);
    await com("CHATGPT");
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toEqual(RIEN);
  });
});

describe("5 · titre de la cible changé après validation : rien", () => {
  it("la validation est périmée : rien ne part ; la garde durable écarte l'événement", async () => {
    site.catalogue = catalogue({ titre: "Autre titre" });
    const id = await com("CHATGPT");
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toEqual(RIEN);
    expect((await decrire(id)).startsWith("ecarte/")).toBe(true);
  });
});

describe("6 · personne déjà opposée", () => {
  it("stop sur GUIDE : CHATGPT ne reçoit ni réponse publique ni message privé ; un témoin non opposé est servi", async () => {
    await com("STOP");
    await passer(T0, { env: ENV_LIEN });
    expect((await Com.lireParametre<any[]>(Opp.PARAM_OPPOSITIONS_MOTS, [])).length).toBeGreaterThan(0);
    await com("CHATGPT", { ageMs: 500 });
    await com("CHATGPT", { idAuteur: A2, ageMs: 400 });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    const conv = Object.entries(await toutesLesConversations()) as Array<[string, any]>;
    expect(conv.filter(([k]) => k.startsWith(cleConversation(AUTEUR))).every(([, v]) => v.etat === "oppose")).toBe(true);
    expect(conv.filter(([k]) => k.startsWith(cleConversation(A2))).map(([, v]) => v.mot)).toEqual(["CHATGPT"]);
  });
});

describe("6 bis · opposition présente au registre seulement (aucun état de conversation)", () => {
  it("CHATGPT : ni réponse publique ni message privé ; le témoin est servi", async () => {
    await Opp.enregistrerOppositionPersonne([AUTEUR], [], "zernio-conversation", { env: ENV });
    await com("CHATGPT", { ageMs: 500 });
    await com("CHATGPT", { idAuteur: A2, ageMs: 400 });
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    expect(Object.keys(await toutesLesConversations()).every((k) => k.startsWith(cleConversation(A2)))).toBe(true);
  });
});

describe("7 · réglage éteint après le M1 de CHATGPT", () => {
  it("l'adresse ne produit ni demande au site ni accusé", async () => {
    await com("CHATGPT");
    await passer(T0, { env: ENV_LIEN });
    expect(banc.port.prive).toHaveLength(1);
    await Com.ecrireParametre(PARAM_MOTS_MULTIPLES, false);
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-7-adresse" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(demandes()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
  });
});

describe("7 bis · parcours CHATGPT resté en base (cible guide-ia, tout validé), réglage éteint : la garde seule bloque", () => {
  // CHATGPT lié à `guide-ia` : la demande au site serait acceptée par l'ancien parcours ; seul le réglage éteint doit l'arrêter.
  const amorcer = async () => {
    const c = catalogue();
    c.liaisons[1] = { mot: "CHATGPT", reseau: "tous", codeCible: "guide-ia", actif: true };
    site.catalogue = c;
    await valider("CHATGPT", "facebook", { ...ENV, ...ENV_TITRE });
    await Com.ecrireParametre("parcours.conversations", { [cleConversation(AUTEUR)]: graineConv("attente_email", { mot: "CHATGPT", guide: "guide-ia", titreCible: TITRE, versionTexteM1: "mp-m1-v4-1" }) });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-7b", idExpediteur: AUTEUR });
  };
  it("l'adresse ne produit ni demande au site ni accusé", async () => {
    await amorcer();
    await Com.ecrireParametre(PARAM_MOTS_MULTIPLES, false);
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(demandes()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
  });
  it("(témoin) réglage allumé : la demande part", async () => {
    await amorcer();
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(demandes()).toHaveLength(1);
  });
});

describe("8 · site injoignable : reporté, jamais clos", () => {
  it.each([
    ["catalogue indisponible", () => null],
    ["copie du site", () => catalogue({ copie: true })],
  ])("%s : rien ne part, événement en attente ; site revenu : part UNE fois", async (_n, f) => {
    site.catalogue = f();
    const id = await com("CHATGPT");
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toEqual(RIEN);
    const e = await evenement(depots, id);
    expect(e.charge.etat).not.toMatch(/^(ecarte|silence|traite)/);
    site.catalogue = catalogue();
    await passer(T0 + 10 * 60_000, { env: ENV_LIEN });
    await passer(T0 + 20 * 60_000, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
  });
});

describe("9 · rejeu", () => {
  it("deux passages, puis deux événements du même commentaire : 1 public, 1 M1", async () => {
    await com("CHATGPT", { idCommentaire: "com-9" });
    await passer(T0, { env: ENV_LIEN });
    await passer(T0 + 1000, { env: ENV_LIEN });
    await com("CHATGPT", { idCommentaire: "com-9", ageMs: 200 });
    await passer(T0 + 2000, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
  });
});

describe("10 · compte et mots mélangés", () => {
  it("CHATGPT actif sur le compte A, commenté sur le compte B : rien", async () => {
    await com("CHATGPT", { idCompte: COMPTE_B });
    await passer(T0, { env: ENV_LIEN, comptesPermis: [COMPTE, COMPTE_B] });
    expect(instantane()).toEqual(RIEN);
  });
  it("GUIDE et CHATGPT par la même personne dans le même passage : GUIDE part comme avant, CHATGPT part aussi", async () => {
    await com("GUIDE", { idCommentaire: "com-10-g", ageMs: 3000 });
    await com("CHATGPT", { idCommentaire: "com-10-c", ageMs: 2000 });
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 2, prive: 2 });
    const conv = Object.values(await toutesLesConversations()) as any[];
    expect(conv.map((x) => x.mot).sort()).toEqual(["CHATGPT", "GUIDE"]);
    expect(conv.find((x) => x.mot === "GUIDE").guide).toBe("guide-ia");
  });
});

describe("11 · GUIDE en mode dossier", () => {
  it("GUIDE lié à une autre cible que guide-ia : validation_absente figé, rien ne part", async () => {
    const c = catalogue();
    c.liaisons[0] = { mot: "GUIDE", reseau: "tous", codeCible: CODE, actif: true };
    site.catalogue = c;
    const id = await com("GUIDE");
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toEqual(RIEN);
    expect(await decrire(id)).toBe("ecarte/validation_absente");
  });
  it("GUIDE lié à guide-ia : part, et verifierMotPourEnvoi n'est JAMAIS appelée (aucun appel au site pour GUIDE)", async () => {
    await com("GUIDE");
    await passer(T0, { env: ENV_LIEN });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    expect(espion.appels).toBe(0);
  });
});

describe("12 · verrou non réentrant", () => {
  it("garde() n'est jamais appelée sous sousVerrou : tout le parcours CHATGPT passe sans blocage", async () => {
    await com("CHATGPT");
    await passer(T0, { env: ENV_LIEN });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-12" });
    const fin = await Promise.race([passer(T0 + 1000, { env: ENV_LIEN }).then(() => "fini"), new Promise((r) => setTimeout(() => r("bloque"), 5000))]);
    expect(fin).toBe("fini");
    expect(envoisSortants()).toBeGreaterThan(0);
    expect(TEXTES_MP["mp-m1-v4-1"]).toBeDefined();
  });
});
