/**
 * INSTA-C · réglage ÉTEINT (absent, faux, mode « plusieurs mots » éteint, ou réseau Facebook) : aucune différence avec la PR 424 ;
 * le réglage est lu UNE fois par passage ; états et machine (parties pures).
 * Données 100 % fictives ; faux port : aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { ETATS_EN_COURS } from "@/domaine/guide-reseau/etats-parcours";
import { ETATS_MESSAGE_ACCEPTES, doitExpirer, transition, type Conversation } from "@/domaine/guide-reseau/machine-conversation";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";
import { cleConversation, deposerCommentaire, deposerMessage, validerFormulationsAuParcours } from "./aides/conversation";

const etat = vi.hoisted(() => ({ multi: true, ig: true as boolean | "reel", lecturesIg: 0, lecturesMulti: 0 }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: () => true }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => null }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true }));
vi.mock("@/services/parcours-mots-multiples", async (orig) => ({ ...(await orig<Record<string, unknown>>()), motsMultiplesActifs: async () => (etat.lecturesMulti++, etat.multi) }));
vi.mock("@/services/parcours-instagram", async (orig) => ({ ...(await orig<Record<string, unknown>>()), instagramSuivreActif: async (o?: unknown) => (etat.lecturesIg++, etat.ig === "reel" ? (await orig<any>()).instagramSuivreActif(o) : etat.ig) }));

const H = 3600_000;
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: "secret-fictif-du-lien-0123456789-abcdefghij", LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const iso = (ms: number) => new Date(ms).toISOString();
const pass = (ms: number) => passer(ms, { env: ENV_LIEN });
const suivi = { appels: 0 };
const prives: any[] = [];
const envois: any[] = [];

beforeEach(async () => {
  await preparer();
  etat.multi = true; etat.ig = true; etat.lecturesIg = 0; etat.lecturesMulti = 0;
  suivi.appels = 0; prives.length = 0; envois.length = 0;
  const p = banc.port.port as any;
  p.lireSuiviInstagram = async () => (suivi.appels++, { statut: "suit" });
  const priv = p.repondreEnPrive, env = p.envoyerMessage;
  p.repondreEnPrive = async (a: any) => (prives.push(a), priv(a));
  p.envoyerMessage = async (a: any) => (envois.push(a), env(a));
  banc.port.reponses.texte = () => "OK";
  await validerFormulationsAuParcours(["mp-m1-v4-1", "mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", "mp-lien-v3-1"]);
});
afterEach(nettoyer);

const comment = (reseau: string) => deposerCommentaire(depots, { idCommentaire: `com-${reseau}`, reseau });

describe("INSTA-C · éteint : Instagram identique à la PR 424, Facebook inchangé", () => {
  it("15 · réglage faux : Instagram part comme avant (M1 avec lien), jamais « suivre le compte », lecture du suivi jamais appelée", async () => {
    etat.ig = false;
    await comment("instagram");
    await pass(T0);
    expect(prives).toHaveLength(1);
    expect(prives[0].texte).toMatch(/https?:\/\//);
    expect(prives[0].texte).not.toBe(rendreTexteMp("mp-ig-suivre-v1-1", { mot: "GUIDE", titre: TITRE }));
    const [c] = Object.values(await toutesLesConversations()) as any[];
    expect(c.etat).toBe("attente_email");
    for (const k of ["suiviIg", "okRecus", "pasEncoreLe", "lienIgLe", "idMessageOk", "essaisSuivi"]) expect(c).not.toHaveProperty(k);
    await deposerMessage(depots, { idMessage: "msg-1", avance: 5000 });
    await pass(T0 + 10_000);
    expect(suivi.appels).toBe(0);
  });

  it("15 · réglage ABSENT (rien d'enregistré, vraie lecture) : Instagram identique à la PR 424", async () => {
    etat.ig = "reel";
    await comment("instagram");
    await pass(T0);
    expect(prives).toHaveLength(1);
    expect(prives[0].texte).toMatch(/https?:\/\//);
    expect(((Object.values(await toutesLesConversations()) as any[])[0]).etat).toBe("attente_email");
  });

  it("15 · réglage vrai mais « plusieurs mots » éteint : chemin historique, le réglage n'est même pas lu", async () => {
    etat.multi = false;
    await comment("instagram");
    await pass(T0);
    expect(prives).toHaveLength(1);
    expect(prives[0].texte).not.toBe(rendreTexteMp("mp-ig-suivre-v1-1", { mot: "GUIDE", titre: TITRE }));
    expect(etat.lecturesIg).toBe(0);
    expect(suivi.appels).toBe(0);
  });

  it("15 · Facebook, tout allumé : M1 comme avant, aucune lecture du suivi", async () => {
    await comment("facebook");
    await pass(T0);
    expect(prives).toHaveLength(1);
    expect(prives[0].texte).not.toBe(rendreTexteMp("mp-ig-suivre-v1-1", { mot: "GUIDE", titre: TITRE }));
    const [c] = Object.values(await toutesLesConversations()) as any[];
    expect(c).toMatchObject({ etat: "attente_email", reseau: "facebook" });
    expect(suivi.appels).toBe(0);
  });

  it("le réglage est lu UNE seule fois par passage (comme « plusieurs mots »)", async () => {
    await pass(T0);
    expect([etat.lecturesMulti, etat.lecturesIg]).toEqual([1, 1]);
    await pass(T0 + 1000);
    expect([etat.lecturesMulti, etat.lecturesIg]).toEqual([2, 2]);
    await comment("instagram");
    await deposerMessage(depots, { idMessage: "m", avance: 1000 });
    await pass(T0 + 2000);
    expect(etat.lecturesIg).toBe(3);
  });

  it("réglage éteint et un parcours d'attente Instagram resté en base (retour arrière) : un OK n'envoie rien", async () => {
    etat.ig = false;
    const cle = cleParcours(cleConversation(AUTEUR), "a".padEnd(64, "0"));
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: graineConv("ig_attente_ok", { reseau: "instagram", cleIdempotenceGuide: "a".padEnd(64, "0"), mot: "GUIDE", nature: "premier", groupeM1: "m1-lien", versionTexteM1: "mp-ig-suivre-v1-1" }),
    });
    await deposerMessage(depots, { idMessage: "msg-ok-1", avance: 5000 });
    await pass(T0 + 10_000);
    expect(envois).toHaveLength(0);
    expect(suivi.appels).toBe(0);
    expect(((await toutesLesConversations()) as any)[cle].etat).toBe("ig_attente_ok");
  });
});

describe("INSTA-C · états et machine (pures)", () => {
  const base = (e: Partial<Conversation>): Conversation => graineConv("ig_attente_ok", e) as unknown as Conversation;
  it("ETATS_EN_COURS contient les trois états d'attente Instagram, pas ig_a_verifier", () => {
    for (const e of ["ig_attente_ok", "ig_pas_encore", "ig_envoi_en_vol"]) expect(ETATS_EN_COURS).toContain(e);
    expect(ETATS_EN_COURS).not.toContain("ig_a_verifier");
  });
  it("ETATS_MESSAGE_ACCEPTES : ig_attente_ok et ig_pas_encore, pas les deux autres", () => {
    expect(ETATS_MESSAGE_ACCEPTES).toContain("ig_attente_ok");
    expect(ETATS_MESSAGE_ACCEPTES).toContain("ig_pas_encore");
    expect(ETATS_MESSAGE_ACCEPTES).not.toContain("ig_envoi_en_vol");
    expect(ETATS_MESSAGE_ACCEPTES).not.toContain("ig_a_verifier");
  });
  it("transition « texte » : état ig, ni opposition ni doute → ig_ok ; opposition et doute gardent leur chemin ; ailleurs inchangé", () => {
    for (const e of ["ig_attente_ok", "ig_pas_encore"] as const) {
      const c = base({ etat: e });
      expect(transition(c, { t: "texte", estOpposition: false, adresse: null, okIg: true }).action).toBe("ig_ok");
      expect(transition(c, { t: "texte", estOpposition: true, adresse: null }).action).toBe("opposer");
      expect(transition(c, { t: "texte", estOpposition: false, doute: true, adresse: null }).action).toBe("doute");
    }
    const sans = graineConv("attente_email", { versionTexteM1: "mp-m1-v2" }) as unknown as Conversation;
    expect(transition(sans, { t: "texte", estOpposition: false, adresse: null }).action).toBe("m2");
  });
  it("doitExpirer : 7 jours après m1Le (ig_attente_ok) ou pasEncoreLe (ig_pas_encore) ; ig_envoi_en_vol et ig_a_verifier jamais", () => {
    const j = 24 * H;
    expect(doitExpirer(base({ etat: "ig_attente_ok", m1Le: iso(T0 - 8 * j) }), T0)).toBe(true);
    expect(doitExpirer(base({ etat: "ig_attente_ok", m1Le: iso(T0 - 6 * j) }), T0)).toBe(false);
    expect(doitExpirer(base({ etat: "ig_pas_encore", m1Le: iso(T0 - 20 * j), pasEncoreLe: iso(T0 - 6 * j) }), T0)).toBe(false);
    expect(doitExpirer(base({ etat: "ig_pas_encore", pasEncoreLe: iso(T0 - 8 * j) }), T0)).toBe(true);
    expect(doitExpirer(base({ etat: "ig_envoi_en_vol", m1Le: iso(T0 - 30 * j) }), T0)).toBe(false);
    expect(doitExpirer(base({ etat: "ig_a_verifier", m1Le: iso(T0 - 30 * j) }), T0)).toBe(false);
  });
});
