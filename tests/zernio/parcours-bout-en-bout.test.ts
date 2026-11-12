/**
 * Parcours viral, de bout en bout : commentaire → premier message (M1) → adresse (acceptée ou refusée) → « stop » à chaque étape →
 * rejeu du même événement → reprise après panne. Aucun code de production touché. Port et site FAUX, données 100 % fictives.
 * Ce qui n'est pas encore dans master (fenêtre de 24 h, merci, lien allumé) est écrit en `it.todo`.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Opp = await import("@/services/oppositions-mots");

const H = 3600_000;
const HEURE = Math.floor(T0 / H) * H;
const A = "auteur-fictif-400";
const PARAM_COMPTEURS = "parcours.conversations.compteurs";
const PARAM_VALIDATION = "parcours.validation.adresse_refusee";
const empreinteAdresseRefusee = () => { const b = TEXTES_MP["mp-adresse-refusee-v2"]; return createHash("sha256").update(`${b.version}\n${b.texte}`).digest("hex"); };

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];
const refuse = () => ({ statut: 422, corps: { erreur: "invalide" } });
const ecrit = (texte: string) => { port.reponses.texte = () => texte; };
const oppositions = () => Com.lireParametre<any[]>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const toutEnvoye = () => port.pub.length + port.prive.length + port.envoyes.length;
const rouvrir = async (id: string, etat?: string) => {
  const ev = await evenement(depots, id);
  await depots().evenementsFournisseurs.modifier(ev.id, { traite: false, charge: { ...ev.charge, etat: "a_faire" } });
  if (etat) await Com.ecrireParametre(C.PARAM_CONVERSATIONS, Object.fromEntries(Object.entries(await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {})).map(([k, v]) => [k, { ...v, etat }])));
};

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
  await Com.ecrireParametre(PARAM_VALIDATION, { empreinte: empreinteAdresseRefusee() });
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("1 · conversation complète", () => {
  it("commentaire → réponse publique + premier message → adresse acceptée → guide demandé + accusé → terminé", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.pub).toHaveLength(1);
    expect(port.prive).toHaveLength(1);
    expect((await etatDe()).etat).toBe("attente_email");
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
    const id = await deposerMessage(depots, { idMessage: "msg-ok" });
    await passer(T0 + 1000);
    expect(site.vus).toHaveLength(1);
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(rendreTexteMp("mp-recu-v2", { titre: TITRE }));
    expect((await evenement(depots, id)).charge.etat).toBe("termine");
    expect((await etatDe()).etat).toBe("termine");
  });

  it("adresse refusée par le site (422) : UN seul message, puis plus rien même si la personne réécrit", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    site.reponses = refuse;
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
    await deposerMessage(depots, { idMessage: "msg-r1" });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(TEXTES_MP["mp-adresse-refusee-v2"].texte);
    await deposerMessage(depots, { idMessage: "msg-r2" });
    await passer(T0 + 2000);
    expect(port.envoyes).toHaveLength(1);
    expect((await etatDe()).etat).toBe("site_refuse");
  });

  it("M1 sans lien quand l'interrupteur PARCOURS_LIEN_GUIDE est éteint (comportement d'aujourd'hui)", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    expect((await etatDe()).versionTexteM1).toBe("mp-m1-v2");
    expect(port.prive[0].texte).not.toMatch(/https?:\/\//);
  });
});

describe("2 · « stop » à chaque étape : le stop l'emporte toujours", () => {
  it("étape 0 · stop avant tout message : le GUIDE suivant ne déclenche rien", async () => {
    await deposerCommentaire(depots, { motSeul: "STOP" });
    await passer();
    expect((await oppositions()).length).toBe(1);
    await deposerCommentaire(depots, { idCommentaire: "com-apres-stop" });
    await passer(T0 + 1000);
    expect(toutEnvoye()).toBe(0);
  });

  it("étape 1 · stop après le premier message : pas de M2, pas d'appel au site", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    const avant = toutEnvoye();
    ecrit("stop");
    const id = await deposerMessage(depots, { idMessage: "msg-s1" });
    await passer(T0 + 1000);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect((await etatDe()).etat).toBe("oppose");
    expect(toutEnvoye()).toBe(avant);
    expect(site.vus).toHaveLength(0);
    expect((await oppositions()).length).toBeGreaterThan(0); // une ligne par empreinte connue de la personne (personne + conversation)
  });

  it("étape 2 · stop après M2 : plus rien ne part, même si une adresse arrive ensuite", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    ecrit("bonjour");
    await deposerMessage(depots, { idMessage: "msg-s2a" });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(1); // M2
    ecrit("stop");
    await deposerMessage(depots, { idMessage: "msg-s2b" });
    await passer(T0 + 2000);
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
    await deposerMessage(depots, { idMessage: "msg-s2c" });
    await passer(T0 + 3000);
    expect(port.envoyes).toHaveLength(1);
    expect(site.vus).toHaveLength(0);
    expect((await etatDe()).etat).toBe("oppose");
  });

  it("étape 3 · stop arrivé PENDANT l'appel au site : l'accusé ne part pas", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    const initial = site.transport;
    pm.injecterTransportSite(async (r) => {
      const res = await initial(r);
      await Opp.enregistrerOppositionParEmpreinte(cleConversation(A), { env: ENV });
      return res;
    });
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
    await deposerMessage(depots, { idMessage: "msg-s3" });
    await passer(T0 + 1000);
    expect(site.vus.length).toBeGreaterThan(0);
    expect(port.envoyes).toHaveLength(0);
  });

  it("étape 4 · stop pendant un report par le plafond : à l'heure suivante, rien ne part", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    await Com.ecrireParametre(PARAM_COMPTEURS, { [COMPTE]: { heure: HEURE, envois: 30 } });
    ecrit("bonjour");
    const id = await deposerMessage(depots, { idMessage: "msg-s4" });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(0);
    expect((await evenement(depots, id)).traite).toBe(false);
    await Opp.enregistrerOppositionParEmpreinte(cleConversation(A), { env: ENV });
    await passer(HEURE + H + 1000);
    expect(port.envoyes).toHaveLength(0);
  });

  it("étape 5 · stop après « adresse refusée » : opposition enregistrée, aucun autre message", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    site.reponses = refuse;
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
    await deposerMessage(depots, { idMessage: "msg-s5a" });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(1);
    ecrit("stop");
    await deposerMessage(depots, { idMessage: "msg-s5b" });
    await passer(T0 + 2000);
    expect(port.envoyes).toHaveLength(1);
    expect((await etatDe()).etat).toBe("oppose");
  });

  it("étape 6 · stop après le guide demandé (terminé) : opposition enregistrée, rien ne part", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
    await deposerMessage(depots, { idMessage: "msg-s6a" });
    await passer(T0 + 1000);
    const avant = toutEnvoye();
    ecrit("stop");
    await deposerMessage(depots, { idMessage: "msg-s6b" });
    await passer(T0 + 2000);
    expect(toutEnvoye()).toBe(avant);
    expect((await etatDe()).etat).toBe("oppose");
    expect((await oppositions()).length).toBeGreaterThan(0);
  });
});

describe("3 · rejeu du même événement : aucun double envoi", () => {
  it("même commentaire redéposé et plusieurs passages : 1 réponse publique, 1 premier message", async () => {
    await deposerCommentaire(depots, { idCommentaire: "com-rejeu" });
    await passer();
    await passer(T0 + 60_000);
    await deposerCommentaire(depots, { idCommentaire: "com-rejeu" });
    await passer(T0 + 120_000);
    expect(port.pub).toHaveLength(1);
    expect(port.prive).toHaveLength(1);
  });

  it("message d'adresse rejoué (événement rouvert) : le site n'est appelé qu'une fois, un seul accusé", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
    const id = await deposerMessage(depots, { idMessage: "msg-rejeu" });
    await passer(T0 + 1000);
    await rouvrir(id);
    await passer(T0 + 5000);
    expect(port.envoyes).toHaveLength(1);
    expect(site.vus.length).toBeLessThanOrEqual(1);
  });

  it("« adresse refusée » : événement rejoué, état remis en attente d'adresse : toujours un seul message", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    site.reponses = refuse;
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
    const id = await deposerMessage(depots, { idMessage: "msg-rejeu-r" });
    await passer(T0 + 1000);
    await rouvrir(id, "attente_email");
    await passer(T0 + 5000);
    expect(port.envoyes).toHaveLength(1);
  });

  it("« stop » rejoué : une seule ligne d'opposition, aucune suppression", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    ecrit("stop");
    const id = await deposerMessage(depots, { idMessage: "msg-rejeu-stop" });
    await passer(T0 + 1000);
    const l1 = await oppositions();
    await rouvrir(id);
    await passer(T0 + 2000);
    const l2 = await oppositions();
    expect(l2.length).toBe(l1.length);
    expect(l2.map((l) => l.id)).toEqual(l1.map((l) => l.id));
  });
});

describe("4 · reprise après panne", () => {
  beforeEach(async () => {
    await deposerCommentaire(depots, {});
    await passer();
    ecrit(`Mon adresse ${ADRESSE_FICTIVE}`);
  });

  it("site en panne (503) puis rétabli : même clé d'idempotence, un seul accusé, état terminé", async () => {
    site.reponses = () => ({ statut: 503 });
    const id = await deposerMessage(depots, { idMessage: "msg-panne" });
    await passer(T0 + 1000);
    expect((await evenement(depots, id)).traite).toBe(false);
    expect(port.envoyes).toHaveLength(0);
    site.reponses = () => ({ statut: 200, corps: {} });
    await passer(T0 + 8 * H);
    expect(new Set(site.vus.map((v) => JSON.parse(v.corps).cleIdempotence)).size).toBe(1);
    expect(port.envoyes).toHaveLength(1);
    expect((await etatDe()).etat).toBe("termine");
    await passer(T0 + 9 * H);
    expect(port.envoyes).toHaveLength(1);
  });

  it("panne de lecture du message chez Zernio : rien ne part, l'événement est gardé, puis repris", async () => {
    port.reponses.lecture = () => ({ texte: null, postback: null, panne: true });
    const id = await deposerMessage(depots, { idMessage: "msg-lecture" });
    await passer(T0 + 1000);
    expect(port.envoyes).toHaveLength(0);
    expect((await evenement(depots, id)).traite).toBe(false);
    port.reponses.lecture = undefined;
    for (let i = 1; i <= 3; i++) await passer(T0 + 1000 + i * 7 * H);
    expect(port.envoyes).toHaveLength(1);
    expect((await evenement(depots, id)).traite).toBe(true);
  });

  it("« stop » écrit pendant la panne du site : au rétablissement, aucun accusé", async () => {
    site.reponses = () => ({ statut: 503 });
    await deposerMessage(depots, { idMessage: "msg-panne-stop" });
    await passer(T0 + 1000);
    await Opp.enregistrerOppositionParEmpreinte(cleConversation(A), { env: ENV });
    site.reponses = () => ({ statut: 200, corps: {} });
    await passer(T0 + 8 * H);
    expect(port.envoyes).toHaveLength(0);
  });
});

describe("5 · pas encore dans master (à écrire quand les PR 309 et 310 seront fusionnées)", () => {
  it.todo("fenêtre de 24 h : un message de conversation n'est pas envoyé plus de 23 h après le dernier message de la personne (code hors_fenetre, rien consommé au plafond)");
  it.todo("fenêtre de 24 h : le « stop » est toujours lu et enregistré même passé 23 h (le stop l'emporte sur hors_fenetre)");
  it.todo("fenêtre de 24 h : le reçu hors fenêtre n'empêche pas la demande de guide au site (état terminé)");
  it.todo("merci : une confirmation de la page lue par le Studio déclenche un seul message de remerciement, jamais deux en rejouant");
  it.todo("merci : personne opposée ou hors fenêtre = aucun merci");
  it.todo("lien dans le message : avec PARCOURS_LIEN_GUIDE allumé, le premier message (mp-m1-v3) contient le lien signé, un seul, sans adresse ni identifiant brut");
  it.todo("lien dans le message : « stop » écrit après le lien reçu est gardé pour le site (voie page) sans rien perdre");
});
