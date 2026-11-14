/**
 * INSTA-C · troisième audit sécurité : B1 (tout message non traité de la personne bloque le OK, quelle que soit sa date), B2 (message clos « ignore » sans
 * avoir été lu : doute sur le dossier Instagram en attente), mineurs (a) alerte d'attente, (b) m2Le avant l'envoi. Données 100 % fictives ; aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";
import { cleConversation, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";

const etat = vi.hoisted(() => ({ catalogue: null as unknown }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: () => true }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => etat.catalogue }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true, validationPourEnvoi: async () => null }));

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
const message = (id: string, avance = 5000) => deposerMessage(depots, { idMessage: id, avance });
const evt = async (id: string) => (await evenement(depots, id)).charge;
const pass = (ms: number) => passer(ms, { env: ENV_LIEN });
const T1 = T0 + 10_000;

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

const alerte = async (re: RegExp) => (await depots().notifications.lister((n: any) => re.test(n.message))).length;
const lectureStop = (etatLecture: { v: "panne" | "stop" }) => () => (etatLecture.v === "panne" ? { texte: null, postback: null, panne: true } : { texte: "Stop", postback: null });

describe("B1 · tout message non traité de la personne bloque le OK, quelle que soit sa date", () => {
  it("OK reporté (suivi en panne), puis « Stop » plus récent non lisible : au repassage du OK rien ne part ; Stop lu : opposition, jamais de lien", async () => {
    await semer("1", "ig_attente_ok");
    suivi.defaut = { statut: "panne" };
    const l = { v: "panne" as "panne" | "stop" };
    lecturesParMessage["msg-stop-1"] = lectureStop(l);
    const eOk = await message("msg-ok-1", 1000);
    const eStop = await message("msg-stop-1", 31_000);
    suivi.defaut = { statut: "suit" };
    await pass(T0 + 40_000);
    await pass(T0 + 100_000);
    expect(envois).toHaveLength(0);
    expect(prives).toHaveLength(0);
    expect((await evt(eOk)).etat).toBe("a_reessayer");
    l.v = "stop";
    await pass(T0 + 12 * 60_000);
    await pass(T0 + 24 * 60_000);
    expect(envois).toHaveLength(0);
    expect((await parcours())[0][1].etat).toBe("oppose");
    expect((await evt(eStop)).etat).toBe("oppose");
  });

  it("webhooks dans l'ordre inverse (Stop déposé en premier, OK ensuite) : rien ne part", async () => {
    await semer("1", "ig_attente_ok");
    lecturesParMessage["msg-stop-1"] = () => ({ texte: null, postback: null, panne: true });
    await message("msg-stop-1", 31_000);
    await message("msg-ok-1", 1000);
    await pass(T0 + 40_000);
    await pass(T0 + 100_000);
    expect(envois).toHaveLength(0);
    expect(prives).toHaveLength(0);
  });

  it("alerte cloche (une par heure) quand le OK attend depuis plus de 10 minutes à cause d'un autre message", async () => {
    await semer("1", "ig_attente_ok");
    lecturesParMessage["msg-stop-1"] = () => ({ texte: null, postback: null, panne: true });
    await message("msg-stop-1", 31_000);
    await message("msg-ok-1", 1000);
    await pass(T0 + 60_000);
    expect(await alerte(/OK attend depuis plus de 10 minutes/)).toBe(0);
    await pass(T0 + 15 * 60_000);
    await pass(T0 + 16 * 60_000);
    expect(await alerte(/OK attend depuis plus de 10 minutes/)).toBe(1);
  });
});

describe("B2 · message clos « ignore » sans avoir été lu : le dossier Instagram en attente passe en doute", () => {
  const fin = [60_000, 10 * 60_000, 40 * 60_000, 3 * H, 10 * H, 20 * H];
  it("message introuvable après les derniers essais, puis OK : rien ne part, doute posé, alerte", async () => {
    const cle = await semer("1", "ig_attente_ok");
    lecturesParMessage["msg-x-1"] = () => ({ texte: null, postback: null, introuvable: true });
    const eX = await message("msg-x-1", 1000);
    for (const ms of fin) await pass(T0 + ms);
    expect((await evt(eX)).etat).toBe("ignore");
    expect((await parcours()).find(([k]) => k === cle)![1].douteOpposition).toBe(true);
    expect(await alerte(/n'a pas pu être lu, la personne est mise en attente/)).toBe(1);
    await message("msg-ok-1", 21 * H);
    await pass(T0 + 22 * H);
    expect(envois).toHaveLength(0);
    expect(prives).toHaveLength(0);
    expect((await parcours()).find(([k]) => k === cle)![1]).toBeDefined(); // aucune donnée supprimée
  });

  it("réglage éteint : aucun doute posé (inchangé)", async () => {
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, false);
    const cle = await semer("1", "ig_attente_ok");
    lecturesParMessage["msg-x-1"] = () => ({ texte: null, postback: null, introuvable: true });
    await message("msg-x-1", 1000);
    for (const ms of fin) await pass(T0 + ms);
    expect((await parcours()).find(([k]) => k === cle)![1].douteOpposition).not.toBe(true);
    expect(await alerte(/n'a pas pu être lu, la personne est mise en attente/)).toBe(0);
  });

  it("Facebook (aucun parcours Instagram en attente) : aucun doute posé (inchangé)", async () => {
    const cle = await semer("1", "attente_email", { reseau: "facebook", versionTexteM1: "mp-m1-v2", formulations: {}, guide: "guide-ia" });
    lecturesParMessage["msg-x-1"] = () => ({ texte: null, postback: null, introuvable: true });
    await message("msg-x-1", 1000);
    for (const ms of fin) await pass(T0 + ms);
    expect((await parcours()).find(([k]) => k === cle)![1].douteOpposition).not.toBe(true);
    expect(await alerte(/n'a pas pu être lu, la personne est mise en attente/)).toBe(0);
  });
});

describe("C1 · message sans idConversation clos « ignore » : doute posé avant la clôture", () => {
  it("« Stop » sans idConversation (lu nulle part), puis OK : rien ne part, doute posé", async () => {
    const cle = await semer("1", "ig_attente_ok");
    const eStop = await deposerMessage(depots, { idMessage: "msg-stop-1", avance: 1000, idConversation: null });
    await pass(T0 + 60_000);
    expect((await evt(eStop)).etat).toBe("ignore");
    expect((await parcours()).find(([k]) => k === cle)![1].douteOpposition).toBe(true);
    await message("msg-ok-1", 2 * 60_000);
    await pass(T0 + 5 * 60_000);
    expect(envois).toHaveLength(0);
    expect(prives).toHaveLength(0);
  });
});

describe("C2 · B2 : liste incomplète et texte absent posent aussi le doute", () => {
  const fin = [60_000, 10 * 60_000, 40 * 60_000, 3 * H, 10 * H, 20 * H];
  for (const [nom, lecture] of [
    ["liste incomplète", () => ({ texte: null, postback: null, panne: true, codePanne: "liste-incomplete" })],
    ["texte absent", () => ({ texte: null, postback: null })],
  ] as const) {
    it(`${nom} après les derniers essais, puis OK : rien ne part, doute posé, alerte`, async () => {
      const cle = await semer("1", "ig_attente_ok");
      lecturesParMessage["msg-x-1"] = lecture as any;
      const eX = await message("msg-x-1", 1000);
      for (const ms of fin) await pass(T0 + ms);
      expect((await evt(eX)).etat).toBe("ignore");
      expect((await parcours()).find(([k]) => k === cle)![1].douteOpposition).toBe(true);
      expect(await alerte(/n'a pas pu être lu, la personne est mise en attente/)).toBe(1);
      await message("msg-ok-1", 21 * H);
      await pass(T0 + 22 * H);
      expect(envois).toHaveLength(0);
      expect(prives).toHaveLength(0);
    });
  }
});

describe("C3 · Stop arrivé pendant la lecture du suivi : rien ne part", () => {
  it("le message non traité apparaît pendant lireSuiviInstagram : OK reporté, rien ne part, réservation relâchée", async () => {
    const cle = await semer("1", "ig_attente_ok");
    lecturesParMessage["msg-stop-1"] = () => ({ texte: null, postback: null, panne: true });
    const eOk = await message("msg-ok-1", 1000);
    const p = banc.port.port as any;
    p.lireSuiviInstagram = async (a: any) => {
      suivi.appels.push(a);
      await message("msg-stop-1", 31_000); // le « Stop » arrive pendant la lecture du suivi
      return suivi.defaut;
    };
    await pass(T0 + 40_000);
    expect(envois).toHaveLength(0);
    expect(prives).toHaveLength(0);
    expect((await evt(eOk)).etat).toBe("a_reessayer");
    expect((await parcours()).find(([k]) => k === cle)![1].etat).toBe("ig_attente_ok");
  });
});

describe("m2 · m2Le écrit avant l'envoi, retiré si rien n'est parti", () => {
  it("M2 refusé net : m2Le absent après coup ; envoyé : m2Le présent", async () => {
    await semer("1", "attente_email", { versionTexteM1: "mp-m1-v2", formulations: {}, guide: "guide-ia", m1Le: iso(T0 - 100_000) });
    banc.port.reponses.texte = () => "bonjour";
    const p = banc.port.port as any;
    const orig = p.envoyerMessage;
    let vu: unknown = "non-appele";
    p.envoyerMessage = async () => { vu = (await parcours())[0][1].m2Le; return { statut: "refuse", code: "refus_fictif" }; };
    await message("msg-1");
    await pass(T1);
    expect(typeof vu).toBe("string"); // écrit AVANT l'envoi
    expect((await parcours())[0][1].m2Le).toBeUndefined(); // rien n'est parti : retiré
    p.envoyerMessage = orig;
  });
});
