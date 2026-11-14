/**
 * Cibles d'essai · S5 à S10 : parcours « plusieurs mots » avec un mot lié à une cible d'essai (test), Facebook, compte listé seulement.
 * Faux Zernio, faux site, faux catalogue : aucun réseau, identifiants et adresse factices.
 * Une cible d'essai ne produit JAMAIS de lien ni de jeton : la personne donne son adresse en message privé. GUIDE reste inchangé.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHEMIN_GUIDE } from "./aides/oppositions";
import { deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import {
  ADRESSE, AUTEUR, banc, C, Com, COMPTE, depots, ENV, lireTexteDe, MS, nettoyer, passer, preparer, T0, TITRE, toutLeStockage, toutesLesConversations,
} from "./filet-guide/_amorce";

const site = vi.hoisted(() => ({
  versions: new Set<string>(["mp-m1-v4-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"]),
  catalogue: null as unknown,
  /** Si défini : catalogue servi dès la lecture n°`apres`+1 (la cible passe en test juste après la création de la conversation). */
  apresPub: null as unknown,
  apres: 1,
  lectures: 0,
}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => (++site.lectures > site.apres && site.apresPub ? site.apresPub : site.catalogue) }));

vi.mock("@/services/notifications", async (orig) => ({ ...(await orig<Record<string, unknown>>()), creerNotification: vi.fn(async () => undefined) }));
const { PARAM_MOTS_MULTIPLES } = await import("@/services/parcours-mots-multiples");
const V = await import("@/services/mots-validation-par-mot");

const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const AUTRE = "compte-fictif-999";
const ENV_LIEN = { ...ENV, PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE, PARCOURS_LIEN_GUIDE: "true", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const ENV_X = { ...ENV_LIEN, PARCOURS_ESSAI_COMPTES: COMPTE };
const ENV_Y = { ...ENV_LIEN, PARCOURS_ESSAI_COMPTES: AUTRE };
const FORMULATIONS = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"];
const MOT = "ESSAICONV";
const CODE = "gde-essai05";
const TITRE_ESSAI = "Guide d'essai conversation";
const H = 3_600_000;

const catalogue = (o: { test?: boolean } = {}) => ({
  catalogue: [
    { code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false },
    { code: CODE, type: "guide" as const, titre: TITRE_ESSAI, actif: true, test: o.test ?? true },
    { code: "gde-inactif01", type: "guide" as const, titre: "Inactif", actif: false, test: false },
    { code: "adr-page000001", type: "adresse" as const, titre: "Page", actif: true, test: false },
  ],
  liaisons: [
    { mot: "GUIDE", reseau: "tous" as const, codeCible: "guide-ia", actif: true },
    { mot: MOT, reseau: "tous" as const, codeCible: CODE, actif: true },
  ],
  luLe: T0, ignores: 0, depuisCopie: false,
});
const registreMots = async (...mots: Array<[string, string]>) => {
  const reg: Record<string, unknown> = {};
  for (const [mot, compte] of mots) reg[`${mot}|${compte}`] = { mot, compte, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};
const validerEssai = async (env: Record<string, string | undefined>) => {
  const a = (await V.apercuTextesMot({ mot: MOT, env, maintenantMs: T0 })).find((x) => x.reseau === "facebook")!;
  if (!a.ok) throw new Error(`aperçu refusé : ${a.raison}`);
  const r = await V.validerTextesMot({ mot: MOT, reseau: "facebook", empreinteVue: a.empreinte, confirmeParOperateur: true, env, maintenantMs: T0 });
  if (!r.ok) throw new Error(r.raison);
};
const demandes = () => banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE);
const decrire = async (id: string) => {
  const e = await evenement(depots, id);
  return `${e.charge.etat}/${e.charge.dernierCode ?? "-"}`;
};
const com = (mot: string, o: Parameters<typeof deposerCommentaire>[1] = {}) => deposerCommentaire(depots, { idAuteur: AUTEUR, motSeul: mot, reseau: "facebook", ...o });
const instantane = () => ({ pub: banc.port.pub.length, prive: banc.port.prive.length, envoyes: banc.port.envoyes.length, site: demandes().length });
const convs = async () => Object.values(await toutesLesConversations()) as any[];

beforeEach(async () => {
  await preparer();
  await validerFormulationsAuParcours(FORMULATIONS);
  site.catalogue = catalogue();
  await Com.ecrireParametre(PARAM_MOTS_MULTIPLES, true);
  await registreMots(["GUIDE", COMPTE], [MOT, COMPTE]);
  await validerEssai(ENV_X);
  site.lectures = 0;
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
  site.apresPub = null;
  site.lectures = 0;
});

describe("S1 · variable absente ou vide : la cible d'essai est refusée comme aujourd'hui", () => {
  it.each([["absente", ENV_LIEN], ["vide", { ...ENV_LIEN, PARCOURS_ESSAI_COMPTES: "" }], ["étoile", { ...ENV_LIEN, PARCOURS_ESSAI_COMPTES: "*" }]])("%s : cible_inconnue, rien ne part", async (_n, env) => {
    const id = await com(MOT);
    await passer(T0, { env });
    expect(await decrire(id)).toBe("ecarte/cible_inconnue");
    expect(instantane()).toEqual({ pub: 0, prive: 0, envoyes: 0, site: 0 });
    expect(await convs()).toEqual([]);
  });
});

describe("S5 · commentaire du mot d'essai", () => {
  it("compte listé : conversation marquée cibleEssai, réponse publique et message privé", async () => {
    await com(MOT);
    await passer(T0, { env: ENV_X });
    expect(instantane()).toMatchObject({ pub: 1, prive: 1 });
    const [conv] = await convs();
    expect(conv).toMatchObject({ mot: MOT, guide: CODE, titreCible: TITRE_ESSAI, cibleEssai: true });
  });
  it("compte non listé (la liste nomme un autre compte) : ecarte/cible_inconnue", async () => {
    const id = await com(MOT);
    await passer(T0, { env: ENV_Y });
    expect(await decrire(id)).toBe("ecarte/cible_inconnue");
    expect(instantane()).toEqual({ pub: 0, prive: 0, envoyes: 0, site: 0 });
  });
  it("Instagram : jamais (même compte listé)", async () => {
    const id = await com(MOT, { reseau: "instagram" });
    await passer(T0, { env: ENV_X });
    expect((await decrire(id)).startsWith("ecarte/")).toBe(true);
    expect(instantane()).toEqual({ pub: 0, prive: 0, envoyes: 0, site: 0 });
  });
  it("une conversation GUIDE ou d'une cible non essai n'a jamais le champ cibleEssai", async () => {
    await com("GUIDE");
    await passer(T0, { env: ENV_X });
    expect((await convs())[0].cibleEssai).toBeUndefined();
  });
});

describe("S6 · guidesDuCatalogue", () => {
  const lire = (compte?: string, env: Record<string, string | undefined> = ENV_X) => C.guidesDuCatalogue(env, T0, compte);
  it("compte listé : le guide d'essai est inclus ; autre compte ou sans compte : exclu", async () => {
    expect(await lire(COMPTE)).toEqual(expect.arrayContaining(["guide-ia", CODE]));
    expect(await lire(AUTRE)).toEqual(["guide-ia"]);
    expect(await lire(undefined)).toEqual(["guide-ia"]);
  });
  it("adresses et cibles inactives toujours exclues", async () => {
    const l = await lire(COMPTE);
    expect(l).not.toContain("gde-inactif01");
    expect(l).not.toContain("adr-page000001");
  });
  it("variable vide : jamais le guide d'essai", async () => {
    expect(await lire(COMPTE, ENV_LIEN)).toEqual(["guide-ia"]);
  });
});

describe("S7 · lien allumé (PARCOURS_LIEN_GUIDE) + cible d'essai : jamais de lien ni de jeton", () => {
  it("M1 sans lien qui demande l'adresse, repli cible_essai, aucune empreinteLien ni référence de lien", async () => {
    await com(MOT);
    await passer(T0, { env: ENV_X });
    expect(banc.port.prive).toHaveLength(1);
    const m1 = banc.port.prive[0].texte as string;
    expect(m1).not.toMatch(/https?:\/\//);
    expect(m1).not.toContain("?j=");
    expect(m1).toMatch(/adresse/i);
    const [conv] = await convs();
    expect(conv.empreintesLien).toBeUndefined();
    expect(conv.refLienConv).toBeUndefined();
    expect(conv.formulations?.["m1-lien"]).toBeUndefined();
    const journal = (await depots().evenements.lister(() => true)).map((e: any) => e.message as string).join("\n");
    expect(journal).toContain("cible_essai");
  });
  it("témoin : GUIDE avec les mêmes réglages reçoit toujours un lien", async () => {
    await com("GUIDE");
    await passer(T0, { env: ENV_X });
    expect(banc.port.prive[0].texte).toMatch(/https:\/\/axion-ia\.com\/guide-reseau\?j=/);
  });
  it("retour du mot après 24 h (rappel) : renvoi_impossible, aucun message privé de plus", async () => {
    await com(MOT, { idCommentaire: "com-s7-1" });
    await passer(T0, { env: ENV_X });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-s7-adresse" });
    await passer(T0 + 1000, { env: ENV_X });
    expect(instantane()).toMatchObject({ prive: 1, envoyes: 1, site: 1 });
    const evt = await com(MOT, { idCommentaire: "com-s7-2", ageMs: 1000 - 25 * H });
    await passer(T0 + 25 * H, { env: ENV_X });
    expect(banc.port.prive).toHaveLength(1);
    expect(await decrire(evt)).toBe("m1_refuse/renvoi_impossible");
  });
});

describe("S8 · bout en bout simulé", () => {
  it("adresse en message privé → demande signée au site → 200 → reçu avec le guide d'essai", async () => {
    await com(MOT);
    await passer(T0, { env: ENV_X });
    lireTexteDe(`Mon adresse : ${ADRESSE}`);
    await deposerMessage(depots, { idMessage: "msg-s8-adresse" });
    await passer(T0 + 1000, { env: ENV_X });
    expect(demandes()).toHaveLength(1);
    expect(JSON.parse(demandes()[0].corps)).toMatchObject({ guide: CODE, mot: MOT, reseau: "facebook" });
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toContain(TITRE_ESSAI);
    expect((await convs())[0]).toMatchObject({ cibleEssai: true });
  });
  it("variable vidée entre le message privé et l'adresse : aucune demande au site, aucun reçu", async () => {
    await com(MOT);
    await passer(T0, { env: ENV_X });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-s8b" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(demandes()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(0);
  });
  it("cible repassée en non essai : le chemin normal est inchangé (lien, aucun champ cibleEssai ajouté après coup)", async () => {
    site.catalogue = catalogue({ test: false });
    await validerEssai({ ...ENV_LIEN });
    await com(MOT);
    await passer(T0, { env: ENV_LIEN });
    expect(banc.port.prive[0].texte).toMatch(/\?j=/);
    expect((await convs())[0].cibleEssai).toBeUndefined();
  });
});

describe("S9 · GUIDE (en production) : chemin inchangé, variable jamais lue", () => {
  const sonde = (valeur: string) => {
    const lectures = { n: 0 };
    const env: Record<string, string | undefined> = { ...ENV_LIEN };
    Object.defineProperty(env, "PARCOURS_ESSAI_COMPTES", { enumerable: false, get: () => (lectures.n++, valeur) });
    return { env, lectures };
  };
  const parcoursGuide = async (env: Record<string, string | undefined>) => {
    await com("GUIDE");
    await passer(T0, { env });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-s9" });
    await passer(T0 + 1000, { env });
    return { etats: (await convs()).map((c) => [c.etat, c.guide, c.mot, c.cibleEssai]), sortie: instantane(), pub: banc.port.pub.map((x: any) => x.texte), prive: banc.port.prive.map((x: any) => String(x.texte).replace(/\?j=[^\s]+/, "?j=J")) };
  };
  it("variable remplie ou vide : décisions identiques, et la variable n'est jamais lue", async () => {
    const vide = await parcoursGuide({ ...ENV_LIEN });
    nettoyer();
    await preparer();
    await validerFormulationsAuParcours(FORMULATIONS);
    site.catalogue = catalogue();
    await Com.ecrireParametre(PARAM_MOTS_MULTIPLES, true);
    await registreMots(["GUIDE", COMPTE], [MOT, COMPTE]);
    const { env, lectures } = sonde(COMPTE);
    const rempli = await parcoursGuide(env);
    expect(rempli).toEqual(vide);
    expect(lectures.n).toBe(0);
    expect(vide.sortie).toMatchObject({ pub: 1, prive: 1, envoyes: 1, site: 1 });
  });
});

describe("S10 · journaux et stockage sans adresse ni jeton", () => {
  it("après le parcours complet : ni adresse, ni jeton, ni lien dans la base ni dans la console", async () => {
    const sorties: string[] = [];
    const espions = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void sorties.push(a.map(String).join(" "))));
    await com(MOT);
    await passer(T0, { env: ENV_X });
    lireTexteDe(`Mon adresse : ${ADRESSE}`);
    await deposerMessage(depots, { idMessage: "msg-s10" });
    await passer(T0 + 1000, { env: ENV_X });
    espions.forEach((e) => e.mockRestore());
    const tout = `${await toutLeStockage()}\n${sorties.join("\n")}`;
    expect(tout).not.toContain(ADRESSE);
    expect(tout).not.toContain("?j=");
    expect(tout).not.toContain(SECRET_LIEN);
  });
});

describe("Corrections après audit", () => {
  it("A · M1 : conversation créée sur cible normale, cible passée en test avant le M1 : aucun lien, aucun jeton, repli cible_essai", async () => {
    site.catalogue = catalogue({ test: false });
    await validerEssai({ ...ENV_LIEN });
    site.apresPub = catalogue({ test: true });
    site.apres = 1; // 1re lecture (création de la conversation) : cible normale ; ensuite : cible d'essai (compte listé, validation d'essai renouvelée ci-dessous)
    site.lectures = 0;
    await com(MOT);
    await passer(T0, { env: ENV_X });
    expect(banc.port.prive).toHaveLength(1);
    const m1 = banc.port.prive[0].texte as string;
    expect(m1).not.toMatch(/https?:\/\//);
    expect(m1).not.toContain("?j=");
    const [conv] = await convs();
    expect(conv.empreintesLien).toBeUndefined();
    expect(conv.refLienConv).toBeUndefined();
  });
  it("A · renvoi : cible normale à la création, passée en test ensuite : renvoi_impossible, aucun message", async () => {
    site.catalogue = catalogue({ test: false });
    await validerEssai({ ...ENV_LIEN });
    await com(MOT, { idCommentaire: "com-a-1" });
    await passer(T0, { env: ENV_X });
    expect(banc.port.prive[0].texte).toMatch(/\?j=/);
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-a-adresse" });
    await passer(T0 + 1000, { env: ENV_X });
    site.apresPub = catalogue({ test: true });
    site.apres = site.lectures + 1; // 1re lecture (création de la conversation) : cible normale ; ensuite : cible d'essai
    const avant = banc.port.prive.length;
    const evt = await com(MOT, { idCommentaire: "com-a-2", ageMs: 1000 - 25 * H });
    await passer(T0 + 25 * H, { env: ENV_X });
    expect(banc.port.prive).toHaveLength(avant);
    expect(await decrire(evt)).toBe("m1_refuse/renvoi_impossible");
  });
});
