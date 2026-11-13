/**
 * INSTA-C · second audit sécurité : V1 (un « Stop » plus ancien non lu gagne), V2 (plafond de 3 messages Instagram par personne : tous les chemins),
 * mineurs m1 à m4. Données 100 % fictives ; faux port, faux site : aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, MS, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";
import { cleConversation, deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";

const etat = vi.hoisted(() => ({ catalogue: null as unknown }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: () => true }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => etat.catalogue }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true }));

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

const H = 3600_000;
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: "secret-fictif-du-lien-0123456789-abcdefghij", LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale`, PARCOURS_REDUCTION_IDS: "1" };
const FORM = ["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", "mp-lien-v3-1", "mp-adresse-refusee-v3-1"];
const iso = (ms: number) => new Date(ms).toISOString();
const racine = () => cleConversation(AUTEUR);
const cleG = (n: string) => n.padEnd(64, "0");
const suivi = { appels: [] as any[], defaut: { statut: "suit" } as any };
const envois: any[] = [];
const prives: any[] = [];
const lecturesParMessage: Record<string, (() => any) | undefined> = {};

async function semer(n: string, etatP: string, extra: Record<string, unknown> = {}, enlever: string[] = []): Promise<string> {
  const cle = cleParcours(racine(), cleG(n));
  const conv = await toutesLesConversations();
  const rang = Number(n.replace(/\D/g, "") || 0);
  const p: Record<string, unknown> = {
    ...graineConv(etatP, {
      reseau: "instagram", cleIdempotenceGuide: cleG(n), idCommentaire: `com-graine-${n}`, mot: "GUIDE", nature: "premier", groupeM1: "m1-lien", titreCible: TITRE, guide: `gde-${n.repeat(6)}`,
      versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 5 * H + rang * 60_000), m1Le: iso(T0 - 5 * H + rang * 60_000 + 1000),
    }),
    ...extra,
  };
  for (const k of enlever) delete p[k];
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...conv, [cle]: p });
  return cle;
}
const parcours = async () => Object.entries(await toutesLesConversations()) as Array<[string, any]>;
const parGuide = async () => Object.fromEntries((await parcours()).map(([, c]) => [c.guide, c.etat]));
const message = (id: string, avance = 5000) => deposerMessage(depots, { idMessage: id, avance });
const evt = async (id: string) => (await evenement(depots, id)).charge;
const pass = (ms: number) => passer(ms, { env: ENV_LIEN });
const T1 = T0 + 10_000;
const REG_MOTS = async (mots: string[], inactifs: string[] = []) => {
  const reg: Record<string, unknown> = {};
  for (const m of mots) reg[`${m}|${COMPTE}`] = { mot: m, compte: COMPTE, etat: inactifs.includes(m) ? "inactif" : "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};

beforeEach(async () => {
  await preparer();
  etat.catalogue = null;
  suivi.appels.length = 0; suivi.defaut = { statut: "suit" };
  envois.length = 0; prives.length = 0;
  for (const k of Object.keys(lecturesParMessage)) delete lecturesParMessage[k];
  const p = banc.port.port as any;
  p.lireSuiviInstagram = async (a: any) => (suivi.appels.push(a), suivi.defaut);
  const priv = p.repondreEnPrive, env = p.envoyerMessage;
  p.repondreEnPrive = async (a: any) => (prives.push(a), priv(a));
  p.envoyerMessage = async (a: any) => (envois.push(a), env(a));
  p.lireMessage = async (a: any) => {
    const f = lecturesParMessage[a.idMessage];
    return f ? f() : { texte: banc.port.reponses.texte(), postback: null };
  };
  banc.port.reponses.texte = () => "OK";
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
  await validerFormulationsAuParcours(FORM);
});
afterEach(nettoyer);

describe("V1 · un « Stop » plus ancien, pas encore lu, gagne sur un OK plus récent", () => {
  it.each([["suit"], ["ne_suit_pas"]])("Stop en panne de lecture puis OK (%s) : rien ne part ; Stop lu ensuite : opposition, jamais de lien ni de « pas encore »", async (s) => {
    await semer("1", "ig_attente_ok");
    suivi.defaut = { statut: s };
    let panne = true;
    lecturesParMessage["msg-stop-1"] = () => (panne ? { texte: null, postback: null, panne: true } : { texte: "Stop", postback: null });
    const eStop = await message("msg-stop-1", 1000);
    const eOk = await message("msg-ok-1", 5000);
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(prives).toHaveLength(0);
    expect((await evt(eStop)).etat).toBe("a_reessayer");
    expect((await evt(eOk)).etat).toBe("a_reessayer"); // l'OK attend : il n'est ni servi ni perdu
    expect(suivi.appels).toHaveLength(0);
    panne = false;
    await pass(T1 + 10 * 60_000);
    await pass(T1 + 20 * 60_000);
    expect(envois).toHaveLength(0);
    expect((await parcours())[0][1].etat).toBe("oppose");
    expect((await evt(eStop)).etat).toBe("oppose");
    expect((await evt(eOk)).etat).toBe("silence");
  });

  it("Stop introuvable puis texte absent, puis OK : même résultat (rien ne part)", async () => {
    await semer("1", "ig_attente_ok");
    lecturesParMessage["msg-stop-1"] = () => ({ texte: null, postback: null, introuvable: true });
    await message("msg-stop-1", 1000);
    await message("msg-ok-1", 5000);
    await pass(T1);
    expect(envois).toHaveLength(0);
    lecturesParMessage["msg-stop-1"] = () => ({ texte: null, postback: null });
    await message("msg-ok-2", 9000);
    await pass(T1 + 6 * 60_000);
    expect(envois).toHaveLength(0);
  });

  it("sans événement plus ancien non traité : le OK part (rien ne change)", async () => {
    await semer("1", "ig_attente_ok");
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
  });
});

describe("V2 · plafond de 3 messages Instagram par personne : tous les chemins", () => {
  const catalogue = () => {
    etat.catalogue = {
      catalogue: ["guide-ia", "gde-a", "gde-b", "gde-c"].map((code) => ({ code, type: "guide", titre: `Titre ${code}`, actif: true, test: false })),
      liaisons: [["DEUX", "gde-b"], ["TROIS", "gde-c"]].map(([mot, codeCible]) => ({ mot, reseau: "tous", codeCible, actif: true })),
      luLe: T0, ignores: 0, depuisCopie: false,
    };
  };
  it("m1_a_verifier puis adresse puis 2 autres mots : au plus 3 messages Instagram en tout", async () => {
    catalogue();
    await REG_MOTS(["GUIDE", "DEUX", "TROIS"]);
    await semer("1", "m1_a_verifier", { versionTexteM1: "mp-m1-v4-1", formulations: {}, guide: "guide-ia", essaiEnvoiLe: iso(T0 - 2 * H) }, ["m1Le"]);
    banc.port.reponses.texte = () => "a@exemple.test";
    await message("msg-adresse-1");
    await pass(T1);
    banc.port.reponses.texte = () => "OK";
    const total = () => envois.length + prives.length;
    const e2 = await deposerCommentaire(depots, { idCommentaire: "com-ig-2", motSeul: "DEUX", reseau: "instagram" });
    await pass(T1 + 60_000);
    const e3 = await deposerCommentaire(depots, { idCommentaire: "com-ig-3", motSeul: "TROIS", reseau: "instagram" });
    await pass(T1 + 120_000);
    // 1 (m1 d'issue inconnue, déjà parti) + reçu (1) + 2e mot (1) = 3 : le 3e mot ne part pas.
    expect(total()).toBeLessThanOrEqual(2);
    expect(envois.length).toBe(1); // le reçu de l'adresse
    expect(prives.length).toBe(1); // « suivre le compte » du 2e mot
    expect((await evt(e2)).etat).not.toBe("a_reessayer");
    expect((await evt(e3)).dernierCode).toBe("plafond_personne");
  });

  const troisRecents = (extra: Record<string, unknown> = {}) => semer("1", "attente_email", { versionTexteM1: "mp-m1-v2", formulations: {}, guide: "guide-ia", m1Le: iso(T0 - 100_000), pasEncoreLe: iso(T0 - 90_000), lienIgLe: iso(T0 - 80_000), ...extra });

  it("M2 (adresse non reconnue) : atteint, rien ne part, événement écarté (plafond_personne)", async () => {
    await troisRecents();
    banc.port.reponses.texte = () => "bonjour";
    const e = await message("msg-1");
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(await evt(e)).toMatchObject({ etat: "ecarte", dernierCode: "plafond_personne" });
    expect((await parcours())[0][1].m2Envoye).toBe(false);
  });

  it("M2 : atteint mais le plus ancien sort de la fenêtre avant sa fermeture : reporté, pas perdu", async () => {
    await troisRecents({ m1Le: iso(T0 - 5 * H), pasEncoreLe: iso(T0 - 4 * H), lienIgLe: iso(T0 - 3 * H) });
    await semer("2", "attente_email", { versionTexteM1: "mp-m1-v2", formulations: {}, m1Le: iso(T0 - 5 * H), derniereActiviteLe: iso(T0) });
    banc.port.reponses.texte = () => "bonjour";
    // 4 dates comptées (3 + m1Le du 2e), les 2 plus anciennes sortent à T0+19 h
    const e = await message("msg-1");
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect((await evt(e)).dernierCode).toBe("plafond_personne");
    expect((await evt(e)).etat).toBe("a_reessayer");
  });

  it("accusé de réception : atteint, rien ne part, parcours terminé (plafond_personne)", async () => {
    await troisRecents();
    banc.port.reponses.texte = () => "a@exemple.test";
    const e = await message("msg-adresse-1");
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(await evt(e)).toMatchObject({ dernierCode: "plafond_personne" });
    expect((await parcours())[0][1].etat).toBe("termine");
  });

  it("accusé de réception : sous le plafond, il part et sa date est écrite (accuseLe), jamais undefined", async () => {
    await semer("1", "attente_email", { versionTexteM1: "mp-m1-v2", formulations: {}, guide: "guide-ia", m1Le: iso(T0 - H) });
    banc.port.reponses.texte = () => "a@exemple.test";
    await message("msg-adresse-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    const c = (await parcours())[0][1];
    expect(typeof c.accuseLe).toBe("string");
    for (const v of Object.values(c)) expect(v).not.toBeUndefined();
  });

  it("adresse refusée par le site (422) : atteint, le message « vérifiez votre adresse » ne part pas", async () => {
    await troisRecents();
    banc.site.reponses = () => ({ statut: 422, corps: {} });
    banc.port.reponses.texte = () => "a@exemple.test";
    await message("msg-adresse-1");
    await pass(T1);
    expect(envois).toHaveLength(0);
  });

  it("adresse refusée par le site (422) : sous le plafond, le message part et sa date est écrite (adresseRefuseeLe)", async () => {
    await semer("1", "attente_email", { versionTexteM1: "mp-m1-v2", formulations: {}, guide: "guide-ia", m1Le: iso(T0 - H) });
    banc.site.reponses = () => ({ statut: 422, corps: {} });
    banc.port.reponses.texte = () => "a@exemple.test";
    await message("msg-adresse-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    expect(typeof (await parcours())[0][1].adresseRefuseeLe).toBe("string");
  });

  it("OK : plafond calculé UNE fois avant la lecture du suivi ; atteint : aucune lecture, rien ne part", async () => {
    await semer("1", "ig_attente_ok", { m1Le: iso(T0 - 100_000) });
    await semer("2", "ig_pas_encore", { m1Le: iso(T0 - 100_000), pasEncoreLe: iso(T0 - 90_000) });
    const e = await message("msg-ok-1");
    await pass(T1);
    expect(suivi.appels).toHaveLength(0);
    expect(envois).toHaveLength(0);
    expect((await evt(e)).dernierCode).toBe("plafond_personne");
  });
});

describe("V2 · une date d'essai réservée avant l'envoi ne compte pas quand rien n'est parti", () => {
  it("lien refusé par un débit : l'essai est remis comme avant ; au nouvel essai (2 autres messages comptés) le lien part", async () => {
    await semer("1", "ig_attente_ok", { m1Le: iso(T0 - H) });
    await semer("2", "attente_email", { versionTexteM1: "mp-m1-v2", formulations: {}, guide: "guide-ia", m1Le: iso(T0 - 30 * H), lienIgLe: iso(T0 - 30 * 60_000) });
    banc.port.reponses.envoyer = () => ({ statut: "a_reessayer", code: "debit", reessayerApresSec: 90 });
    const e = await message("msg-ok-1");
    await pass(T1);
    expect((await evt(e)).etat).toBe("a_reessayer");
    expect((await parcours()).find(([, c]) => c.guide === "gde-111111")![1].essaiEnvoiLe).toBeUndefined();
    banc.port.reponses.envoyer = () => ({ statut: "envoye" });
    await pass(T1 + 90_000);
    expect(envois).toHaveLength(2);
    expect((await parcours()).find(([, c]) => c.guide === "gde-111111")![1].etat).toBe("attente_email");
  });

  it("réponse privée à un commentaire refusée par un débit : l'essai n'est pas gardé ; au nouvel essai la demande de suivre le compte part", async () => {
    await REG_MOTS(["GUIDE", "DEUX"]);
    await semer("2", "attente_email", { versionTexteM1: "mp-m1-v2", formulations: {}, guide: "guide-ia", m1Le: iso(T0 - 30 * H), lienIgLe: iso(T0 - 30 * 60_000), pasEncoreLe: iso(T0 - 20 * 60_000) });
    etat.catalogue = {
      catalogue: ["guide-ia", "gde-b"].map((code) => ({ code, type: "guide", titre: `Titre ${code}`, actif: true, test: false })),
      liaisons: [{ mot: "DEUX", reseau: "tous", codeCible: "gde-b", actif: true }], luLe: T0, ignores: 0, depuisCopie: false,
    };
    await REG_MOTS(["GUIDE", "DEUX"]);
    banc.port.reponses.prive = () => ({ statut: "a_reessayer", code: "debit", reessayerApresSec: 30 });
    const e = await deposerCommentaire(depots, { idCommentaire: "com-ig-2", motSeul: "DEUX", reseau: "instagram" });
    await pass(T0);
    expect((await evt(e)).etat).toBe("a_reessayer");
    expect((await parcours()).filter(([, c]) => c.essaiEnvoiLe !== undefined)).toHaveLength(0);
    banc.port.reponses.prive = () => ({ statut: "envoye" });
    await pass(T0 + 2 * 60_000);
    expect(prives.length).toBeGreaterThanOrEqual(2);
    expect((await evt(e)).etat).toBe("ig_attente_ok");
  });
});

describe("m2 · la garde de chaque parcours décide (pas celle du seul parcours principal)", () => {
  it("parcours principal sur un mot inactif : l'autre parcours reçoit quand même son lien ; le principal est écarté sans envoi", async () => {
    await REG_MOTS(["GUIDE", "MORT"], ["MORT"]);
    await semer("1", "ig_attente_ok", { mot: "GUIDE", m1Le: iso(T0 - 30 * H) });
    await semer("2", "ig_attente_ok", { mot: "MORT", m1Le: iso(T0 - 29 * H), creeLe: iso(T0 - 29 * H) });
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    expect(await parGuide()).toEqual({ "gde-111111": "attente_email", "gde-222222": "ig_attente_ok" });
  });
});

describe("m3 · réglage allumé : un message avec une adresse va au parcours attente_email", () => {
  it("l'adresse n'est pas traitée comme « OK non reconnu » : le parcours Instagram reste en attente, la demande de guide est faite", async () => {
    await REG_MOTS(["GUIDE", "MOT1"]);
    await semer("1", "attente_email", { mot: "GUIDE", guide: "guide-ia", versionTexteM1: "mp-m1-v4-1", formulations: {}, m1Le: iso(T0 - 6 * H) });
    await semer("2", "ig_attente_ok", { mot: "MOT1", m1Le: iso(T0 - H), creeLe: iso(T0 - H) });
    banc.port.reponses.texte = () => "a@exemple.test";
    const e = await message("msg-adresse-1");
    await pass(T1);
    expect((await evt(e)).dernierCode).not.toBe("ok_non_reconnu");
    expect((await parcours()).find(([, c]) => c.mot === "GUIDE")![1].etat).toBe("termine"); // demande de guide faite, accusé envoyé
    expect((await parcours()).find(([, c]) => c.mot === "MOT1")![1].etat).toBe("ig_attente_ok");
    expect(banc.site.vus.length).toBeGreaterThan(0);
  });
});

describe("m4 · idMessageOk effacé à 30 jours aussi pour les parcours oppose", () => {
  it("oppose ancien : idMessageOk disparaît, l'état oppose et l'identifiant du commentaire (preuve) restent ; récent : conservé", async () => {
    await semer("1", "oppose", { idMessageOk: "msg-ok-vieux", okRecus: 1, creeLe: iso(T0 - 40 * 24 * H), m1Le: iso(T0 - 40 * 24 * H) });
    await semer("2", "oppose", { idMessageOk: "msg-ok-recent", okRecus: 1, creeLe: iso(T0 - 5 * 24 * H), m1Le: iso(T0 - 5 * 24 * H) });
    await C.reduireIdentifiants({ env: ENV_LIEN, maintenantMs: T0 });
    const par = Object.fromEntries((await parcours()).map(([, c]) => [c.guide, c]));
    expect(par["gde-111111"].idMessageOk).toBeUndefined();
    expect(par["gde-111111"].etat).toBe("oppose");
    expect(par["gde-111111"].idCommentaire).toBe("com-graine-1");
    expect(par["gde-222222"].idMessageOk).toBe("msg-ok-recent");
  });
});
