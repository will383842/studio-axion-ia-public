/**
 * Écran /mots : doublon de mot (blocage), cible partagée (alerte non bloquante), changement de cible d'un mot actif (blocage).
 * Faux site signé, registre en mémoire, valeurs 100 % FICTIVES, aucun réseau, aucun appel Zernio.
 * Première partie : MESURE de ce qui existait avant. Seconde partie : le nouveau comportement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot } from "@/services/mots-service";
import { ENV_SITE_FICTIF, siteCiblesFactice } from "./aides/site-cibles-factice";

let session = true;
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session) throw new Error("NON_CONNECTE");
    return {};
  }),
}));

const reseau = vi.fn(async () => new Response("{}"));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const { lireParametre, ecrireParametre } = await import("@/services/_commun");
const pm = await import("@/services/parcours-mot");
const CS = await import("@/services/cibles-site");
const S = await import("@/services/mots-service");
const G = await import("@/services/mots-gestes");
const A = await import("@/app/(studio)/mots/actions");
const { reinitialiserCacheStatsMots } = await import("@/services/stats-mots");

const FB = "compte-fb-fictif";
const IG = "compte-ig-fictif";
let site: ReturnType<typeof siteCiblesFactice>;
const ecritures = () => site.appels.filter((a) => a.methode === "POST");
const registre = () => lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {});
const ligne = (mot: string, compte: string, etat: LigneMot["etat"]): [string, LigneMot] => [`${mot}|${compte}`, { mot, compte, etat, idWorkflow: null, raison: "local", modifieLe: "x" }];
const poserRegistre = (...l: Array<[string, LigneMot]>) => ecrireParametre(S.PARAM_REGISTRE_MOTS, Object.fromEntries(l));
const phraseExiste = (etat: string) => `Ce mot existe déjà (état : ${etat}). Ouvrez sa fiche pour le modifier.`;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", reseau);
  vi.stubEnv("SITE_GUIDES_RESEAU_SECRET", ENV_SITE_FICTIF.SITE_GUIDES_RESEAU_SECRET);
  vi.stubEnv("SITE_VIDEOS_URL", ENV_SITE_FICTIF.SITE_VIDEOS_URL);
  vi.stubEnv("MOTS_ENABLED", "1");
  vi.stubEnv("PARCOURS_CONVERSATION_COMPTES", `${FB}, ${IG}`);
  reinitialiserDepots();
  CS.reinitialiserEtatCiblesSite();
  reinitialiserCacheStatsMots();
  session = true;
  S.injecterExecuteurMots(async () => {
    throw new Error("appel Zernio interdit");
  });
  site = siteCiblesFactice();
  site.cibles.push({ code: "gde-essai03", type: "guide", titre: "Guide fictif D", actif: true, test: false });
  pm.injecterTransportSite(site.transport);
});
afterEach(() => {
  vi.unstubAllEnvs();
  pm.injecterTransportSite(null);
});

describe("MESURE de l'existant (déjà vrai avant ce changement)", () => {
  it("« essaiconv7 » puis « ESSAICONV7 » : la seconde création est refusée (mot_existe), une seule liaison écrite", async () => {
    expect(await G.gesteCreerMot("essaiconv7", "gde-essai01")).toMatchObject({ ok: true });
    expect(await G.gesteCreerMot("ESSAICONV7", "gde-essai03")).toMatchObject({ ok: false, raison: "mot_existe" });
    expect(ecritures()).toHaveLength(1);
  });
  it("changer la cible d'un mot dont la ligne est en pause reste permis", async () => {
    await poserRegistre(ligne("TOUS1", FB, "pause"));
    expect(await G.gesteChangerCible("TOUS1", "gde-essai03")).toMatchObject({ ok: true, raison: "cible_changee" });
  });
});

describe("doublon : blocage insensible à la casse et aux accents, avec l'état", () => {
  it("mot déjà au tableau, sans ligne de registre : état brouillon, message exact", async () => {
    expect(await A.creerMotAction("tous1", "gde-essai01")).toEqual({ ok: false, phrase: phraseExiste("brouillon") });
    expect(ecritures()).toHaveLength(0);
  });
  it("casse et accents : « Tóus1 » est le même mot que TOUS1", async () => {
    expect(await A.creerMotAction("Tóus1", "gde-essai03")).toEqual({ ok: false, phrase: phraseExiste("brouillon") });
    expect(await A.creerMotAction("  tOuS1 ", "gde-essai03")).toEqual({ ok: false, phrase: phraseExiste("brouillon") });
    expect(ecritures()).toHaveLength(0);
  });
  it("mot actif au registre : état actif", async () => {
    await poserRegistre(ligne("TOUS1", FB, "actif"));
    expect(await A.creerMotAction("tous1", "gde-essai01")).toEqual({ ok: false, phrase: phraseExiste("actif") });
  });
  it("mot en pause (y compris pause automatique) au registre : état pause", async () => {
    await poserRegistre(ligne("TOUS1", FB, "pause_auto"));
    expect(await A.creerMotAction("tous1", "gde-essai01")).toEqual({ ok: false, phrase: phraseExiste("pause") });
  });
  it("mot présent seulement au registre (aucune liaison au site) : refusé aussi, casse et accents ignorés", async () => {
    await poserRegistre(ligne("ORPHELIN", FB, "actif"));
    expect(await A.creerMotAction("Orphelín", "gde-essai01")).toEqual({ ok: false, phrase: phraseExiste("actif") });
    expect(ecritures()).toHaveLength(0);
  });
  it("l'état « actif » l'emporte sur « pause » quand les comptes diffèrent", async () => {
    await poserRegistre(ligne("TOUS1", FB, "pause"), ligne("TOUS1", IG, "actif"));
    expect(await A.creerMotAction("tous1", "gde-essai01")).toMatchObject({ ok: false, phrase: phraseExiste("actif") });
  });
});

describe("cible partagée : alerte visible, non bloquante", () => {
  it("relier un nouveau mot à la cible d'un mot actif : le mot est créé ET la phrase liste les mots actifs", async () => {
    await poserRegistre(ligne("TOUS1", FB, "actif"));
    const r = await A.creerMotAction("conversation", "gde-essai01");
    expect(r.ok).toBe(true);
    expect(r.phrase).toContain("Mot créé en brouillon.");
    expect(r.phrase).toContain("Attention");
    expect(r.phrase).toContain("TOUS1");
    expect(ecritures()).toHaveLength(1);
  });
  it("aucune alerte si l'autre mot n'est pas actif (brouillon ou pause)", async () => {
    await poserRegistre(ligne("TOUS1", FB, "pause"));
    expect(await A.creerMotAction("conversation", "gde-essai01")).toEqual({ ok: true, phrase: "Mot créé en brouillon." });
  });
  it("aucune alerte sur une cible libre", async () => {
    await poserRegistre(ligne("TOUS1", FB, "actif"));
    expect(await A.creerMotAction("conversation", "gde-essai03")).toEqual({ ok: true, phrase: "Mot créé en brouillon." });
  });
  it("changer la cible d'un mot en pause vers la cible d'un autre mot actif : changé, avec alerte", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai03", actif: true });
    await poserRegistre(ligne("TOUS1", FB, "actif"), ligne("CONVERSATION", FB, "pause"));
    const r = await A.changerCibleAction("CONVERSATION", "gde-essai01");
    expect(r.ok).toBe(true);
    expect(r.phrase).toContain("Attention");
    expect(r.phrase).toContain("TOUS1");
    expect(ecritures()).toHaveLength(1);
  });
});

describe("changer la cible d'un mot ACTIF : pause d'abord (blocage)", () => {
  it("mot actif : refusé, aucune écriture, registre intact", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01", actif: true });
    await poserRegistre(ligne("CONVERSATION", FB, "actif"));
    const avant = await registre();
    const r = await A.changerCibleAction("conversation", "gde-essai03");
    expect(r).toEqual({ ok: false, phrase: "Ce mot est actif : mettez-le en pause avant de changer sa cible." });
    expect(ecritures()).toHaveLength(0);
    expect(await registre()).toEqual(avant);
  });
  it("une ligne active posée chez Zernio bloque aussi", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01", actif: true });
    await poserRegistre(["CONVERSATION|" + FB, { ...ligne("CONVERSATION", FB, "actif")[1], idWorkflow: "wf-x", raison: "zernio" }]);
    expect(await G.gesteChangerCible("CONVERSATION", "gde-essai03")).toMatchObject({ ok: false, raison: "mot_actif_pause_d_abord" });
    expect(ecritures()).toHaveLength(0);
  });
  it("après la pause, le changement passe", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01", actif: true });
    await poserRegistre(ligne("CONVERSATION", FB, "actif"));
    expect(await G.gesteChangerCible("CONVERSATION", "gde-essai03")).toMatchObject({ ok: false });
    await S.mettreEnPauseLocal({ mot: "CONVERSATION", compte: FB, confirmeParOperateur: true });
    expect(await G.gesteChangerCible("CONVERSATION", "gde-essai03")).toMatchObject({ ok: true, raison: "cible_changee" });
  });
});
