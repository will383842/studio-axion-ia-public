/**
 * INSTA-C · branchement Instagram « suivre le compte puis OK » (réglage ALLUMÉ + mode « plusieurs mots » + réseau Instagram).
 * Données 100 % fictives ; faux port (dont la lecture du suivi est programmable), faux site : aucun réseau, aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, MS, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";
import { cleConversation, deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";

const etat = vi.hoisted(() => ({ versionsSite: new Set<string>(), catalogue: null as unknown }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => etat.versionsSite.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => etat.catalogue }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true }));

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

const H = 3600_000;
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const FORM = ["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", "mp-lien-v3-1"];
const iso = (ms: number) => new Date(ms).toISOString();
const racine = () => cleConversation(AUTEUR);
const cleG = (n: string) => n.padEnd(64, "0");

const suivi = { appels: [] as any[], file: [] as any[], defaut: { statut: "suit" } as any };
const envois: any[] = [];
const prives: any[] = [];
const publics: any[] = [];
const lecture = (...r: any[]) => (suivi.file = [...r]);

function poserLecture(): void {
  (banc.port.port as any).lireSuiviInstagram = async (a: any) => {
    suivi.appels.push(a);
    const r = suivi.file.length > 0 ? suivi.file.shift() : suivi.defaut;
    if (r instanceof Error) throw r;
    return r;
  };
}
function brancher(): void {
  const p = banc.port.port as any;
  poserLecture();
  const priv = p.repondreEnPrive, env = p.envoyerMessage, pub = p.repondreCommentaire;
  p.repondreEnPrive = async (a: any) => (prives.push(a), priv(a));
  p.repondreCommentaire = async (a: any) => (publics.push(a), pub(a));
  p.envoyerMessage = async (a: any) => (envois.push({ ...a, enVol: await etatsEnVol() }), env(a));
  banc.port.reponses.texte = () => "OK";
}
const etatsEnVol = async () => Object.values(await toutesLesConversations()).map((x: any) => `${x.etat}|${x.idMessageOk ?? "-"}`);
const alerteIg = async (re: RegExp) => (await depots().notifications.lister((n: any) => re.test(n.message))).length;

async function semer(n: string, etatP: string, extra: Record<string, unknown> = {}, r: string = racine()): Promise<string> {
  const cle = cleParcours(r, cleG(n));
  const conv = await toutesLesConversations();
  const rang = Number(n.replace(/\D/g, "") || 0);
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    ...conv,
    [cle]: {
      ...graineConv(etatP, {
        reseau: "instagram", cleIdempotenceGuide: cleG(n), idCommentaire: `com-graine-${n}`, mot: "GUIDE", nature: "premier", groupeM1: "m1-lien", titreCible: TITRE,
        versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 5 * H + rang * 60_000), m1Le: iso(T0 - 5 * H + rang * 60_000 + 1000),
      }),
      ...extra,
    },
  });
  return cle;
}
const parcours = async () => Object.entries(await toutesLesConversations()) as Array<[string, any]>;
const un = async () => (await parcours())[0][1];
const message = (id: string, avance = 5000) => deposerMessage(depots, { idMessage: id, avance });
const evt = async (id: string) => (await evenement(depots, id)).charge;
const pass = (ms: number) => passer(ms, { env: ENV_LIEN });
const T1 = T0 + 10_000;

beforeEach(async () => {
  await preparer();
  etat.versionsSite = new Set(["mp-lien-v3-1", "mp-m1-v4-1"]);
  etat.catalogue = null;
  suivi.appels.length = 0; suivi.file.length = 0; suivi.defaut = { statut: "suit" };
  envois.length = 0; prives.length = 0; publics.length = 0;
  brancher();
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
  await validerFormulationsAuParcours(FORM);
});
afterEach(nettoyer);

describe("INSTA-C · commentaire", () => {
  it("1 · réponse publique + UNE réponse privée « suivre le compte » : formulation validée, titre de la cible, texte seul, aucun bouton, aucun lien", async () => {
    const e = await deposerCommentaire(depots, { idCommentaire: "com-ig-1", reseau: "instagram" });
    await pass(T0);
    expect(publics).toHaveLength(1);
    expect(prives).toHaveLength(1);
    expect(prives[0].texte).toBe(rendreTexteMp("mp-ig-suivre-v1-1", { mot: "GUIDE", titre: TITRE }));
    expect(prives[0].texte).toContain(TITRE);
    expect(prives[0].texte).not.toMatch(/https?:|\[LIEN\]/);
    expect(prives[0].boutons).toBeUndefined();
    expect(Object.keys(prives[0]).sort()).toEqual(["idCommentaire", "idCompte", "idPost", "nonOpposee", "texte"]);
    const c = await un();
    expect(c).toMatchObject({ etat: "ig_attente_ok", versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, reseau: "instagram" });
    expect(typeof c.m1Le).toBe("string");
    expect((await evt(e)).etat).toBe("ig_attente_ok");
    expect(envois).toHaveLength(0);
    expect(suivi.appels).toHaveLength(0);
  });

  it("12 · ig-suivre allumé mais aucune formulation validée : rien ne part (ni public, ni privé, jamais de repli vers le lien), commentaire clos, alerte unique", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", "mp-lien-v3-1", "mp-ig-pas-encore-v1-1"]);
    const e1 = await deposerCommentaire(depots, { idCommentaire: "com-ig-a", idAuteur: "auteur-fictif-401", reseau: "instagram" });
    const e2 = await deposerCommentaire(depots, { idCommentaire: "com-ig-b", idAuteur: "auteur-fictif-402", reseau: "instagram" });
    await pass(T0);
    expect(publics).toHaveLength(0);
    expect(prives).toHaveLength(0);
    expect(envois).toHaveLength(0);
    for (const e of [e1, e2]) expect(await evt(e)).toMatchObject({ etat: "ecarte", dernierCode: "validation_ig_absente" });
    expect(await alerteIg(/Instagram : aucune formulation « suivre le compte » validée dans Mots : aucun message ne part\./)).toBe(1);
  });

  it("17 · 4e mot dans les 24 h : ig-suivre ne part pas (plafond de 3 par personne)", async () => {
    etat.catalogue = {
      catalogue: ["guide-ia", "gde-a", "gde-b", "gde-c", "gde-d"].map((code) => ({ code, type: "guide", titre: `Titre ${code}`, actif: true, test: false })),
      liaisons: [["QUATRE", "gde-d"]].map(([mot, codeCible]) => ({ mot, reseau: "tous", codeCible, actif: true })),
      luLe: T0, ignores: 0, depuisCopie: false,
    };
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
      [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" },
      [`QUATRE|${COMPTE}`]: { mot: "QUATRE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" },
    });
    for (const [n, g] of [["1", "gde-a"], ["2", "gde-b"], ["3", "gde-c"]]) await semer(n, "ig_attente_ok", { guide: g, mot: `M${n}`, m1Le: iso(T0 - H) });
    const e = await deposerCommentaire(depots, { idCommentaire: "com-ig-4", motSeul: "QUATRE", reseau: "instagram" });
    await pass(T0);
    expect(prives).toHaveLength(0);
    expect((await evt(e)).dernierCode).toBe("plafond_personne");
  });
});

describe("INSTA-C · le OK de la personne", () => {
  it("2 · OK + suit déjà : lien (texte du groupe lien-rappel, lien signé neuf), issue deja_suivi, un seul appel de lecture, jeton passé au port", async () => {
    await semer("1", "ig_attente_ok");
    const e = await message("msg-ok-1");
    await pass(T1);
    expect(suivi.appels).toEqual([{ idCompte: COMPTE, idUtilisateur: AUTEUR }]);
    expect(envois).toHaveLength(1);
    expect(envois[0].texte).toMatch(/https?:\/\//);
    expect(envois[0].cle).toBe(`msg-ok-1|ig|lien-rappel|${cleParcours(racine(), cleG("1"))}`);
    expect(envois[0].nonOpposee).toBeTruthy();
    expect(envois[0].enVol).toEqual(["ig_envoi_en_vol|msg-ok-1"]);
    const c = await un();
    expect(c).toMatchObject({ etat: "attente_email", suiviIg: "deja_suivi", idMessageOk: "msg-ok-1", okRecus: 1, versionTexteM1: "mp-lien-v3-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1", "lien-rappel": "mp-lien-v3-1" } });
    expect(typeof c.lienIgLe).toBe("string");
    expect(typeof c.refLienConv).toBe("string");
    expect(c.empreintesLien).toHaveLength(1);
    expect((await evt(e)).traite).toBeUndefined();
    for (const [, v] of Object.entries(c)) expect(v).not.toBeUndefined();
  });

  it("3 · OK + ne suit pas : « pas encore » ; 2e OK + suit : lien, issue gagne", async () => {
    await semer("1", "ig_attente_ok");
    lecture({ statut: "ne_suit_pas" }, { statut: "suit" });
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    expect(envois[0].texte).toBe(rendreTexteMp("mp-ig-pas-encore-v1-1", { mot: "GUIDE", titre: TITRE }));
    expect(envois[0].cle).toContain("|ig|ig-pas-encore|");
    expect(await un()).toMatchObject({ etat: "ig_pas_encore", idMessageOk: "msg-ok-1", formulations: { "ig-pas-encore": "mp-ig-pas-encore-v1-1" } });
    expect(typeof (await un()).pasEncoreLe).toBe("string");
    await message("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    expect(envois).toHaveLength(2);
    expect(envois[1].texte).toMatch(/https?:\/\//);
    expect(await un()).toMatchObject({ etat: "attente_email", suiviIg: "gagne", idMessageOk: "msg-ok-2", okRecus: 2 });
  });

  it("4 · 2e OK, ne suit toujours pas : lien quand même (jamais un 2e « pas encore »), issue sans_suivre", async () => {
    await semer("1", "ig_attente_ok");
    lecture({ statut: "ne_suit_pas" }, { statut: "ne_suit_pas" });
    await message("msg-ok-1");
    await pass(T1);
    await message("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    expect(envois).toHaveLength(2);
    expect(envois[1].texte).toMatch(/https?:\/\//);
    expect(await un()).toMatchObject({ etat: "attente_email", suiviIg: "sans_suivre" });
  });

  it("5 · lecture inconnue (null) : lien, issue inconnu — jamais traité comme « ne suit pas »", async () => {
    await semer("1", "ig_attente_ok");
    lecture({ statut: "inconnu" });
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    expect(envois[0].texte).toMatch(/https?:\/\//);
    expect(await un()).toMatchObject({ etat: "attente_email", suiviIg: "inconnu" });
  });

  it("5 · deux pannes passagères : rien n'est envoyé, l'événement est reporté (60 s puis 5 min), puis lien, issue inconnu", async () => {
    await semer("1", "ig_attente_ok");
    const panne = { statut: "panne", definitive: false, code: "5xx" };
    lecture(panne, panne, panne);
    const e = await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(await evt(e)).toMatchObject({ etat: "a_reessayer", prochainEssaiLe: T1 + 60_000 });
    expect((await un()).essaisSuivi).toBe(1);
    await pass(T1 + 60_000);
    expect(envois).toHaveLength(0);
    expect(await evt(e)).toMatchObject({ prochainEssaiLe: T1 + 60_000 + 300_000 });
    expect((await un()).essaisSuivi).toBe(2);
    await pass(T1 + 60_000 + 300_000);
    expect(envois).toHaveLength(1);
    expect(await un()).toMatchObject({ etat: "attente_email", suiviIg: "inconnu" });
    expect(suivi.appels).toHaveLength(3);
  });

  it("5 · panne passagère puis suit : lien, issue deja_suivi", async () => {
    await semer("1", "ig_attente_ok");
    lecture({ statut: "panne", definitive: false }, { statut: "suit" });
    await message("msg-ok-1");
    await pass(T1);
    await pass(T1 + 60_000);
    expect(envois).toHaveLength(1);
    expect(await un()).toMatchObject({ etat: "attente_email", suiviIg: "deja_suivi" });
  });

  it("5 · méthode de lecture absente du port, ou exception : panne définitive, lien, issue inconnu", async () => {
    await semer("1", "ig_attente_ok");
    delete (banc.port.port as any).lireSuiviInstagram;
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    expect(await un()).toMatchObject({ etat: "attente_email", suiviIg: "inconnu" });
    await semer("2", "ig_attente_ok", { creeLe: iso(T0) });
    poserLecture();
    lecture(new Error("panne fictive"));
    await message("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    expect(envois).toHaveLength(2);
  });

  it("9 · OK traité plus de 23 h après : rien ne part, la lecture du suivi n'est pas nécessaire à la décision, état inchangé", async () => {
    await semer("1", "ig_attente_ok");
    const e = await message("msg-ok-1", 0);
    await pass(T0 + 24 * H);
    expect(envois).toHaveLength(0);
    expect(await evt(e)).toMatchObject({ etat: "silence", dernierCode: "hors_fenetre" });
    expect((await un()).etat).toBe("ig_attente_ok");
  });

  it("10 · événement rejoué (même message, autre événement) : un seul envoi, une seule lecture", async () => {
    await semer("1", "ig_attente_ok");
    lecture({ statut: "ne_suit_pas" });
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    const e2 = await message("msg-ok-1", 6000);
    await pass(T1 + 5000);
    expect(envois).toHaveLength(1);
    expect(suivi.appels).toHaveLength(1);
    expect((await evt(e2)).dernierCode).toBe("deja_traite");
    expect(await un()).toMatchObject({ etat: "ig_pas_encore", okRecus: 1 });
  });

  it("11 · 4 mots en attente + 1 OK : 3 liens (les plus anciens), une seule lecture ; le 4e au message suivant", async () => {
    const reg: Record<string, unknown> = {};
    for (const m of ["GUIDE", "MOT1", "MOT2", "MOT3", "MOT4"]) reg[`${m}|${COMPTE}`] = { mot: m, compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
    for (const n of ["1", "2", "3", "4"]) await semer(n, "ig_attente_ok", { guide: `gde-${n.repeat(6)}`, mot: `MOT${n}` });
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(3);
    expect(suivi.appels).toHaveLength(1);
    const etats = Object.fromEntries((await parcours()).map(([, c]) => [c.guide, c.etat]));
    expect(etats).toEqual({ "gde-111111": "attente_email", "gde-222222": "attente_email", "gde-333333": "attente_email", "gde-444444": "ig_attente_ok" });
    await message("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    expect(envois).toHaveLength(4);
    expect((await parcours()).every(([, c]) => c.etat === "attente_email")).toBe(true);
  });

  it("13 · lien-rappel non validé : aucun envoi, alerte, parcours inchangé, événement clos lien_indisponible", async () => {
    await validerFormulationsAuParcours(["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1"]);
    await semer("1", "ig_attente_ok");
    const e = await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(await evt(e)).toMatchObject({ etat: "ignore", dernierCode: "lien_indisponible" });
    expect(await alerteIg(/Instagram : le lien ne peut pas partir \(texte non validé ou version inconnue du site\)/)).toBe(1);
    expect(await un()).toMatchObject({ etat: "ig_attente_ok" });
    expect((await un()).idMessageOk).toBeUndefined();
  });

  it("13 · version inconnue du site : aucun envoi, alerte", async () => {
    etat.versionsSite = new Set();
    await semer("1", "ig_attente_ok");
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(await alerteIg(/le lien ne peut pas partir/)).toBe(1);
    expect((await un()).etat).toBe("ig_attente_ok");
  });

  it("« pas encore » non validé : rien ne part, alerte, parcours inchangé", async () => {
    await validerFormulationsAuParcours(["mp-ig-suivre-v1-1", "mp-lien-v3-1"]);
    await semer("1", "ig_attente_ok");
    lecture({ statut: "ne_suit_pas" });
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(0);
    expect(await alerteIg(/Instagram : /)).toBeGreaterThanOrEqual(1);
    expect((await un()).etat).toBe("ig_attente_ok");
  });

  it("issues du port : débit = état précédent restauré et événement reporté ; refus = état restauré + code ; à vérifier = ig_a_verifier, jamais renvoyé", async () => {
    await semer("1", "ig_attente_ok");
    banc.port.reponses.envoyer = () => ({ statut: "a_reessayer", code: "debit", reessayerApresSec: 90 });
    const e = await message("msg-ok-1");
    await pass(T1);
    expect(await un()).toMatchObject({ etat: "ig_attente_ok" });
    expect((await un()).idMessageOk).toBeUndefined();
    expect(await evt(e)).toMatchObject({ etat: "a_reessayer", prochainEssaiLe: T1 + 90_000 });
    banc.port.reponses.envoyer = () => ({ statut: "envoye" });
    await pass(T1 + 90_000);
    expect(envois).toHaveLength(2);
    expect((await un()).etat).toBe("attente_email");

    await semer("2", "ig_attente_ok", { creeLe: iso(T0) });
    banc.port.reponses.envoyer = () => ({ statut: "refuse", code: "refus_fictif" });
    await message("msg-ok-2", 200_000);
    await pass(T1 + 300_000);
    const c2 = (await parcours()).find(([, c]) => c.idCommentaire === "com-graine-2")![1];
    expect(c2).toMatchObject({ etat: "ig_attente_ok", dernierCode: "refus_fictif" });

    await semer("3", "ig_attente_ok", { creeLe: iso(T0 + 1000) });
    banc.port.reponses.envoyer = () => ({ statut: "a_verifier", code: "inconnu_fictif", etat: "a_verifier" });
    const avant = envois.length;
    await message("msg-ok-3", 400_000);
    await pass(T1 + 500_000);
    const c3 = (await parcours()).find(([, c]) => c.idCommentaire === "com-graine-3")![1];
    expect(c3.etat).toBe("ig_a_verifier");
    expect(await alerteIg(/issue inconnue/)).toBe(1);
    await pass(T1 + 600_000);
    expect(envois.length).toBe(avant + 2); // les parcours 2 et 3 attendaient tous deux ce OK
    expect((await parcours()).filter(([, c]) => c.etat === "ig_a_verifier")).toHaveLength(2);
    await pass(T1 + 700_000);
    expect(envois.length).toBe(avant + 2);
  });

  it("blocage (INBOX_REQUIRED) : état restauré, disjoncteur ouvert comme aujourd'hui", async () => {
    await semer("1", "ig_attente_ok");
    banc.port.reponses.envoyer = () => ({ statut: "refuse", code: "INBOX_REQUIRED" });
    await message("msg-ok-1");
    await pass(T1);
    expect((await un()).etat).toBe("ig_attente_ok");
    expect(await alerteIg(/Zernio refuse les envois/)).toBe(1);
    await message("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    expect(envois).toHaveLength(1); // disjoncteur fermé : plus rien ne part
  });

  it("après le lien, un nouveau message sans adresse : silence (rien ne part)", async () => {
    await semer("1", "ig_attente_ok");
    await message("msg-ok-1");
    await pass(T1);
    expect(envois).toHaveLength(1);
    await message("msg-2", 20_000);
    banc.port.reponses.texte = () => "merci beaucoup";
    await pass(T1 + 30_000);
    expect(envois).toHaveLength(1);
    expect(suivi.appels).toHaveLength(1);
  });
});

describe("INSTA-C · redémarrage et confidentialité", () => {
  it("14 · ig_envoi_en_vol au redémarrage : ig_a_verifier, aucun renvoi, alerte", async () => {
    await semer("1", "ig_envoi_en_vol", { idMessageOk: "msg-ok-1", okRecus: 1 });
    C.reinitialiserParcoursConversation();
    await message("msg-ok-1");
    await pass(T1);
    expect((await un()).etat).toBe("ig_a_verifier");
    expect(envois).toHaveLength(0);
    expect(suivi.appels).toHaveLength(0);
    expect(await alerteIg(/lors d'un arrêt/)).toBe(1);
  });

  it("expiration : ig_attente_ok et ig_pas_encore expirent 7 jours après m1Le / pasEncoreLe", async () => {
    await semer("1", "ig_attente_ok", { m1Le: iso(T0 - 8 * 24 * H) });
    await semer("2", "ig_pas_encore", { m1Le: iso(T0 - 9 * 24 * H), pasEncoreLe: iso(T0 - 2 * 24 * H) });
    await semer("3", "ig_pas_encore", { pasEncoreLe: iso(T0 - 8 * 24 * H) });
    expect(await C.expirerConversations({ env: ENV_LIEN, maintenantMs: T0 })).toBe(2);
    const e = Object.fromEntries((await parcours()).map(([, c]) => [c.idCommentaire, c.etat]));
    expect(e).toEqual({ "com-graine-1": "expire", "com-graine-2": "ig_pas_encore", "com-graine-3": "expire" });
  });

  it("16 · la sérialisation de parcours.conversations ne contient ni l'identifiant brut de l'expéditeur, ni « username », ni « name »", async () => {
    await deposerCommentaire(depots, { idCommentaire: "com-ig-1", reseau: "instagram" });
    await pass(T0);
    lecture({ statut: "ne_suit_pas" }, { statut: "suit" });
    await message("msg-ok-1");
    await pass(T1);
    await message("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    const s = JSON.stringify(await Com.lireParametre(C.PARAM_CONVERSATIONS, {}));
    expect(s.length).toBeGreaterThan(100);
    expect(s).not.toContain(AUTEUR);
    expect(s).not.toContain("conv-fictive-700");
    expect(s).not.toMatch(/"username"|"name"/i);
    expect((await un()).etat).toBe("attente_email");
  });
});
