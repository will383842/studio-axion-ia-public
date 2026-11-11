/**
 * Z2 · le site refuse l'adresse e-mail (422) : UN SEUL message court demande de la vérifier et de la renvoyer.
 * Jamais deux messages, rien si la personne est opposée, plafond respecté, interrupteur éteint = comportement inchangé,
 * aucune adresse dans les journaux. Données 100 % fictives (example.test) ; port et site FAUX.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP, TEXTES_MP_BROUILLONS, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const H = 3600_000;
const HEURE = Math.floor(T0 / H) * H;
const PARAM_COMPTEURS = "parcours.conversations.compteurs";
const A = "auteur-fictif-400";
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0, env: Record<string, string | undefined> = ENV) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];
const refuse = () => ({ statut: 422, corps: { erreur: "invalide" } });
const alertes = async () => (await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).length;

/** Commentaire traité (M1 partie, en attente de l'adresse), puis la personne écrit une adresse. */
async function ecrireAdresse(idMessage: string, ms = T0 + 1000): Promise<string> {
  port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
  const id = await deposerMessage(depots, { idMessage });
  await passer(ms);
  return id;
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
  await deposerCommentaire(depots, {});
  await passer();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("texte brouillon", () => {
  it("nouvelle clé BROUILLON, absente des textes validés, vouvoiement, sans STOP, sans prix, sans « autres informations »", () => {
    const b = TEXTES_MP_BROUILLONS["mp-adresse-refusee-v1"];
    expect(b.version).toBe("mp-adresse-refusee-v1");
    expect(b.statut).toBe("brouillon");
    expect(Object.keys(TEXTES_MP)).not.toContain("mp-adresse-refusee-v1");
    expect(b.texte.startsWith("Message automatique envoyé par Axion IA. ")).toBe(true);
    expect(b.texte).toMatch(/\bvotre\b|\bvous\b/i);
    expect(b.texte).not.toMatch(/\bstop\b|autres? informations|€|\beuros?\b|\bprix\b|\btarifs?\b|\b(tu|ton|ta|tes|toi)\b|\bordre de\b|aucun gain/i);
    expect(b.texte.toLowerCase()).not.toContain(["gren", "oble"].join(""));
    expect(b.texte.split(/[.?!]\s/).length).toBeLessThanOrEqual(4); // une ou deux phrases après la mention
    expect(rendreTexteMp("mp-m2-v1", {})).toBe(TEXTES_MP["mp-m2-v1"].texte); // textes validés inchangés
  });
});

describe("422 du site : un seul message", () => {
  it("un 422 envoie UN message court (le texte brouillon) et l'état passe à site_refuse", async () => {
    site.reponses = refuse;
    const id = await ecrireAdresse("msg-a1");
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(TEXTES_MP_BROUILLONS["mp-adresse-refusee-v1"].texte);
    expect(port.envoyes[0].texte).not.toContain(ADRESSE_FICTIVE);
    expect(await etatDe()).toMatchObject({ etat: "site_refuse", dernierCode: "422" });
    expect((await evenement(depots, id)).traite).toBe(true);
    expect(await alertes()).toBeGreaterThan(0);
  });

  it("deux 422 de suite (la personne renvoie une adresse refusée) : toujours UN seul message", async () => {
    site.reponses = refuse;
    await ecrireAdresse("msg-b1");
    await ecrireAdresse("msg-b2", T0 + 2000);
    await ecrireAdresse("msg-b3", T0 + 3000);
    expect(port.envoyes).toHaveLength(1);
  });

  it("un réessai du même événement (message déjà parti) n'en renvoie pas un second", async () => {
    site.reponses = refuse;
    const id = await ecrireAdresse("msg-c1");
    const ev = await evenement(depots, id);
    await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, etat: "a_faire" } });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, Object.fromEntries(Object.entries(await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {})).map(([k, v]) => [k, { ...v, etat: "attente_email" }])));
    await passer(T0 + 5000);
    expect(port.envoyes).toHaveLength(1);
  });

  it("un autre refus définitif (401) ne déclenche aucun message à la personne", async () => {
    site.reponses = () => ({ statut: 401, corps: { erreur: "signature" } });
    await ecrireAdresse("msg-d1");
    expect(port.envoyes).toHaveLength(0);
    expect((await etatDe()).dernierCode).toBe("401");
  });
});

describe("personne opposée : rien du tout", () => {
  it("opposition arrivée pendant l'appel au site : aucun message", async () => {
    site.reponses = () => {
      // l'opposition est enregistrée entre l'appel au site et l'envoi
      void Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}).then(() => undefined);
      return refuse();
    };
    const transportInitial = site.transport;
    pm.injecterTransportSite(async (r) => {
      const res = await transportInitial(r);
      const conv = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, Object.fromEntries(Object.entries(conv).map(([k, v]) => [k, { ...v, etat: "oppose" }])));
      return res;
    });
    await ecrireAdresse("msg-e1");
    expect(site.vus.length).toBeGreaterThan(0);
    expect(port.envoyes).toHaveLength(0);
  });

  it("personne déjà opposée avant son message : ni appel au site, ni message", async () => {
    site.reponses = refuse;
    const conv = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, Object.fromEntries(Object.entries(conv).map(([k, v]) => [k, { ...v, etat: "oppose" }])));
    await ecrireAdresse("msg-e2");
    expect(site.vus).toHaveLength(0);
    expect(port.envoyes).toHaveLength(0);
  });
});

describe("plafond de messages", () => {
  it("plafond atteint : le message est reporté (aucun envoi), puis part UNE fois à l'heure suivante", async () => {
    site.reponses = refuse;
    await Com.ecrireParametre(PARAM_COMPTEURS, { [COMPTE]: { heure: HEURE, envois: 30 } });
    const id = await ecrireAdresse("msg-f1");
    expect(port.envoyes).toHaveLength(0);
    expect((await evenement(depots, id)).traite).toBe(false);
    expect((await evenement(depots, id)).charge).toMatchObject({ dernierCode: "plafond_heure" });
    await passer(HEURE + H + 1000);
    expect(port.envoyes).toHaveLength(1);
    await passer(HEURE + H + 2000);
    expect(port.envoyes).toHaveLength(1);
    expect((await Com.lireParametre<Record<string, any>>(PARAM_COMPTEURS, {}))[COMPTE]).toEqual({ heure: HEURE + H, envois: 1 });
  });
});

describe("interrupteur du parcours", () => {
  it("éteint : rien n'est lu, aucun appel au site, aucun message, état inchangé", async () => {
    site.reponses = refuse;
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    const avant = JSON.stringify(await etatDe());
    await deposerMessage(depots, { idMessage: "msg-g1" });
    const lusAvant = port.lire;
    const rap = await passer(T0 + 1000, { ...ENV, PARCOURS_CONVERSATION_ENABLED: "0" });
    expect(rap.actif).toBe(false);
    expect(site.vus).toHaveLength(0);
    expect(port.envoyes).toHaveLength(0);
    expect(port.lire).toBe(lusAvant);
    expect(JSON.stringify(await etatDe())).toBe(avant);
  });
});

describe("confidentialité", () => {
  it("aucune adresse dans les journaux, les événements, les alertes ni l'état", async () => {
    site.reponses = refuse;
    await ecrireAdresse("msg-h1");
    const tout = JSON.stringify([
      await depots().evenements.lister(() => true),
      await depots().evenementsFournisseurs.lister(() => true),
      await Com.lireParametre(C.PARAM_CONVERSATIONS, {}),
      (console.log as any).mock.calls, (console.error as any).mock.calls, (console.warn as any).mock.calls, (console.info as any).mock.calls,
    ]);
    expect(tout).not.toContain(ADRESSE_FICTIVE);
    expect(tout).not.toContain("example.test");
  });
});
