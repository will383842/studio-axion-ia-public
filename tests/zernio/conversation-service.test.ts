/** Lot 3a · service de conversation : parcours, reprises, oppositions, adresses, site. Port et site FAUX, données fictives. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");
const MS = await import("@/services/mots-service");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0, over: Partial<Parameters<typeof C.traiterConversations>[0]> = {}) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms, ...over });
const etatDe = async (id: string) => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(id)];
const A = "auteur-fictif-400";

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
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("2 · garde proprio côté machine", () => {
  it("proprio=true (auteur différent du compte) : écarté, le port ne reçoit aucun appel", async () => {
    const id = await deposerCommentaire(depots, { proprio: true, idAuteur: "autre-id-que-le-compte" });
    await passer();
    expect(port.total()).toBe(0);
    expect((await evenement(depots, id)).charge.etat).toBe("ecarte");
    expect(await etatDe("autre-id-que-le-compte")).toBeUndefined();
  });
  it("auteur = compte, mot non-GUIDE, réponse : écartés sans effet", async () => {
    await deposerCommentaire(depots, { idAuteur: COMPTE });
    await deposerCommentaire(depots, { motSeul: "BONJOUR" });
    await deposerCommentaire(depots, { motSeul: null });
    await deposerCommentaire(depots, { estReponse: true });
    await passer();
    expect(port.total()).toBe(0);
  });
});

describe("5 · M1 une seule fois en rejouant", () => {
  it("3 passages + même commentaire redéposé : 1 réponse publique, 1 M1, état attente_email", async () => {
    await deposerCommentaire(depots, { idCommentaire: "com-A" });
    await passer();
    await passer(T0 + 60_000);
    await deposerCommentaire(depots, { idCommentaire: "com-A" });
    await passer(T0 + 120_000);
    expect(port.pub).toHaveLength(1);
    expect(port.pub[0]).toMatchObject({ cle: "com-A", idPost: "post-plateforme-fictif-200", texte: rendreTexteMp("mp-pub-igfb-v1", {}) });
    expect(port.prive).toHaveLength(1);
    expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
    const e = await etatDe(A);
    expect(e).toMatchObject({ etat: "attente_email", versionTexteM1: "mp-m1-v2", guide: "guide-ia", m1Le: new Date(T0).toISOString() });
    expect(e.cleIdempotenceGuide).toMatch(/^[0-9a-f]{64}$/);
  });
  it("réponse publique à réessayer : 3 essais au plus, puis on continue vers le privé", async () => {
    port.reponses.pub = () => ({ statut: "a_reessayer", code: "debit", reessayerApresSec: 1 });
    await deposerCommentaire(depots, {});
    for (let i = 0; i < 6; i++) await passer(T0 + i * 10_000);
    expect(port.pub).toHaveLength(3);
    expect(port.prive).toHaveLength(1);
  });
  it("réponse publique à vérifier : code noté, aucun réessai, M1 part quand même", async () => {
    port.reponses.pub = () => ({ statut: "a_verifier", code: "a-verifier", etat: "a_verifier" });
    await deposerCommentaire(depots, {});
    await passer();
    await passer(T0 + 60_000);
    expect(port.pub).toHaveLength(1);
    expect(port.prive).toHaveLength(1);
  });
});

describe("6 · 400 privateReplyConsumed", () => {
  it("m1_consommee terminal, jamais rejoué même après redémarrage", async () => {
    port.reponses.prive = () => ({ statut: "definitif", code: "reponse-privee-consommee", etat: "consommee", consomme: true });
    await deposerCommentaire(depots, { idCommentaire: "com-C" });
    await passer();
    expect((await etatDe(A)).etat).toBe("m1_consommee");
    C.reinitialiserParcoursConversation();
    await deposerCommentaire(depots, { idCommentaire: "com-C2" });
    await passer(T0 + 30 * 3600_000);
    await passer(T0 + 31 * 3600_000);
    expect(port.prive).toHaveLength(1);
    expect((await etatDe(A)).etat).toBe("m1_consommee");
  });
});

describe("7 et 8 · issue inconnue et plantage", () => {
  it("7 · 502 unknown : m1_a_verifier, 0 réessai sur 10 passages, un message.received reprend", async () => {
    port.reponses.prive = () => ({ statut: "a_verifier", code: "reponse-privee-inconnue", etat: "a_verifier", issueInconnue: true });
    await deposerCommentaire(depots, {});
    for (let i = 0; i < 10; i++) await passer(T0 + i * 60_000);
    expect(port.prive).toHaveLength(1);
    expect((await etatDe(A)).etat).toBe("m1_a_verifier");
    port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, {});
    await passer(T0 + 11 * 60_000);
    expect(site.vus).toHaveLength(1);
    expect((await etatDe(A)).etat).toBe("termine");
  });
  it("8 · plantage après m1_en_vol : au redémarrage, m1_a_verifier et aucun 2e envoi", async () => {
    await deposerCommentaire(depots, { idCommentaire: "com-P" });
    port.reponses.prive = () => {
      throw new Error("plantage simulé");
    };
    await passer();
    expect(port.prive).toHaveLength(1);
    expect((await etatDe(A)).etat).toBe("m1_a_verifier");
  });
  it("8 ter · m1_en_vol est écrit AVANT l'envoi (visible pendant l'appel)", async () => {
    let pendant: string | undefined;
    const reel = port.port.repondreEnPrive;
    port.port.repondreEnPrive = async (p) => {
      pendant = (await etatDe(A))?.etat;
      return reel(p);
    };
    await deposerCommentaire(depots, {});
    await passer();
    expect(pendant).toBe("m1_en_vol");
  });
  it("8 bis · état m1_en_vol resté en base : traité comme à vérifier, jamais renvoyé", async () => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: { etat: "m1_en_vol", reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-X", idPostPlateforme: "p", versionTexteM1: "mp-m1-v2", guide: "guide-ia", cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0).toISOString(), m1Le: null, occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [] } });
    await deposerCommentaire(depots, { idCommentaire: "com-X" });
    await passer();
    await passer(T0 + 60_000);
    expect(port.prive).toHaveLength(0);
    expect((await etatDe(A)).etat).toBe("m1_a_verifier");
  });
});

describe("9 et 10 · message avant l'état, alias", () => {
  it("9 · message avant l'état : orphelin (30 s) puis traité", async () => {
    port.reponses.texte = () => "bonjour";
    const idM = await deposerMessage(depots, {});
    await passer();
    expect((await evenement(depots, idM)).charge).toMatchObject({ etat: "a_reessayer", dernierCode: "orphelin", orphelins: 1 });
    await deposerCommentaire(depots, {});
    await passer(T0 + 31_000);
    await passer(T0 + 62_000);
    expect((await evenement(depots, idM)).traite).toBe(true);
    expect(port.envoyes).toHaveLength(1); // M2 : pas d'adresse
    expect(port.envoyes[0].texte).toBe(rendreTexteMp("mp-m2-v1", {}));
  });
  it("9 bis · jamais retrouvé : 2 réessais puis ignoré, aucune réponse", async () => {
    const idM = await deposerMessage(depots, { idExpediteur: "inconnu-fictif" });
    // 2 réessais d'orphelin, puis le texte est lu quand même (pour ne pas perdre un « stop ») : sans texte, 3 réessais puis ignoré.
    for (const t of [0, 31_000, 31_000 + 121_000, 200_000, 400_000, 1_100_000, 1_800_000]) await passer(T0 + t);
    const ev = await evenement(depots, idM);
    expect(ev).toMatchObject({ traite: true });
    expect(ev.charge.etat).toBe("ignore");
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
  });
  it("10 · sender.id VRAIMENT différent d'author.id : retrouvé par l'alias posé à l'envoi de M1 ; un stop privé bloque un GUIDE suivant", async () => {
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m1-fictif", idConversation: "conv-alias-1" });
    await deposerCommentaire(depots, {});
    await passer();
    expect((await etatDe(A)).alias).toHaveLength(1); // alias de conversation posé dès M1 (empreinte, jamais brut)
    port.reponses.texte = () => "bonjour";
    await deposerMessage(depots, { idExpediteur: "premier-sender-fictif-5", idConversation: "conv-alias-1" }); // sender.id ≠ author.id
    await passer(T0 + 1000);
    expect((await etatDe(A)).alias).toHaveLength(2);
    port.reponses.texte = () => "Arrêtez !";
    const idStop = await deposerMessage(depots, { idExpediteur: "autre-sender-fictif-9", idConversation: "conv-alias-1" });
    await passer(T0 + 2000);
    expect((await evenement(depots, idStop)).charge.etat).toBe("oppose");
    expect((await etatDe(A)).etat).toBe("oppose");
    const avant = port.total();
    await deposerCommentaire(depots, { idCommentaire: "com-apres-stop" });
    await passer(T0 + 3000);
    expect(port.total()).toBe(avant);
  });
});

describe("11 et 12 · oppositions", () => {
  const lignes = () => Com.lireParametre<Array<{ id: string }>>(Opp.PARAM_OPPOSITIONS_MOTS, []);
  it("11 · stop en commentaire et « Arrêtez ! » en privé : silence, lignes ajoutées, aucune suppression", async () => {
    const idStop = await deposerCommentaire(depots, { idAuteur: "personne-stop-1", motSeul: "STOP" });
    await passer();
    const l1 = await lignes();
    expect(l1).toHaveLength(1);
    expect((await evenement(depots, idStop)).charge.etat).toBe("oppose");
    expect(port.total()).toBe(0);
    await deposerCommentaire(depots, { idCommentaire: "com-p2" });
    port.reponses.texte = () => "Arrêtez !";
    await passer(T0 + 1000);
    await deposerMessage(depots, {});
    await passer(T0 + 2000);
    const l2 = await lignes();
    expect(l2).toHaveLength(3); // + l'expéditeur et l'alias de conversation (même personne ici : deux formes)
    expect(l2.map((x) => x.id)).toEqual(expect.arrayContaining(l1.map((x) => x.id)));
    expect(port.envoyes).toHaveLength(0);
    expect((await etatDe(A)).etat).toBe("oppose");
  });
  it("12 · déjà opposée : aucun appel", async () => {
    await Opp.enregistrerOpposition(A, "zernio-conversation", { env: ENV });
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.total()).toBe(0);
    expect(await etatDe(A)).toBeUndefined();
  });
});

describe("13 · registre illisible, clés absentes", () => {
  it("registre illisible : réessai, jamais d'envoi ni « non opposée »", async () => {
    const id = await deposerCommentaire(depots, {});
    const spy = vi.spyOn(depots().parametres, "obtenir").mockImplementation(async (pid: string) => {
      if (pid === Opp.PARAM_OPPOSITIONS_MOTS) throw new Error("panne");
      return Object.getPrototypeOf(depots().parametres).obtenir.call(depots().parametres, pid);
    });
    await passer();
    spy.mockRestore();
    expect(port.total()).toBe(0);
    expect((await evenement(depots, id)).charge).toMatchObject({ etat: "a_reessayer", dernierCode: "registre_illisible" });
    expect((await evenement(depots, id)).traite).toBe(false);
    await passer(T0 + 61_000);
    expect(port.prive).toHaveLength(1);
  });
  it("clés d'empreinte absentes : rien ne part, événement conservé", async () => {
    const id = await deposerCommentaire(depots, {});
    const rap = await passer(T0, { env: { ...ENV, STUDIO_EMPREINTE_SECRET: "" } });
    expect(rap.gardeBloquante).toBe("cles_absentes");
    expect(port.total()).toBe(0);
    expect((await evenement(depots, id)).traite).toBe(false);
  });
});

describe("14 · adresses", () => {
  beforeEach(async () => {
    await deposerCommentaire(depots, {});
    await passer();
  });
  it("écho de M2 (exemple), plusieurs adresses ou aucune : M2 une seule fois, site jamais appelé", async () => {
    for (const [i, t] of [rendreTexteMp("mp-m2-v1", {})!, "a@example.test et b@example.test", "pas d'adresse"].entries()) {
      port.reponses.texte = () => t;
      await deposerMessage(depots, {});
      await passer(T0 + (i + 1) * 1000);
    }
    expect(port.envoyes.filter((e) => e.texte === rendreTexteMp("mp-m2-v1", {}))).toHaveLength(1);
    expect(site.vus).toHaveLength(0);
    expect((await etatDe(A)).m2Envoye).toBe(true);
  });
  it("une adresse après M2 : demande de guide puis accusé, terminé", async () => {
    port.reponses.texte = () => "rien";
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    port.reponses.texte = () => `Voici : ${ADRESSE_FICTIVE}`;
    const idM = await deposerMessage(depots, { idMessage: "msg-adresse" });
    await passer(T0 + 2000);
    expect(site.vus).toHaveLength(1);
    expect(JSON.parse(site.vus[0].corps)).toMatchObject({ email: ADRESSE_FICTIVE, mot: "GUIDE", reseau: "instagram", guide: "guide-ia", versionTexteM1: "mp-m1-v2" });
    expect(site.vus[0].chemin).toBe(pm.CHEMIN_DEMANDES_GUIDE);
    expect(port.envoyes.at(-1)).toMatchObject({ texte: rendreTexteMp("mp-recu-v2", { titre: TITRE }), cle: "msg-adresse" });
    expect((await evenement(depots, idM)).charge.etat).toBe("termine");
    expect((await etatDe(A)).etat).toBe("termine");
  });
});

describe("16 · panne du site", () => {
  beforeEach(async () => {
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
  });
  it("mêmes octets et même clé à chaque essai ; le message est relu à chaque essai ; rien n'est stocké", async () => {
    site.reponses = () => ({ statut: 503 });
    const idM = await deposerMessage(depots, {});
    const lus: number[] = [];
    for (let i = 0; i < 3; i++) {
      await passer(T0 + 1000 + i * 7 * 3600_000);
      lus.push(port.lire);
    }
    expect(site.vus.length).toBeGreaterThanOrEqual(3);
    expect(new Set(site.vus.map((v) => v.corps)).size).toBe(1);
    expect(JSON.parse(site.vus[0].corps).cleIdempotence).toBe((await etatDe(A)).cleIdempotenceGuide);
    expect(lus).toEqual([1, 2, 3]);
    expect((await evenement(depots, idM)).traite).toBe(false);
    expect(JSON.stringify(await evenement(depots, idM))).not.toContain("@");
  });
  it("409 cle_reutilisee : définitif, site_refuse, alerte, aucun accusé", async () => {
    site.reponses = () => ({ statut: 409, corps: { erreur: "cle_reutilisee" } });
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    expect((await etatDe(A)).etat).toBe("site_refuse");
    expect(port.envoyes).toHaveLength(0);
    expect((await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).length).toBeGreaterThan(0);
  });
  it("401 : définitif avec alerte", async () => {
    site.reponses = () => ({ statut: 401, corps: { erreur: "signature" } });
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    expect((await etatDe(A)).dernierCode).toBe("401");
    expect((await depots().evenements.lister((e: any) => /ALERTE/.test(e.message))).length).toBeGreaterThan(0);
  });
  it("disjoncteur du site après 5 pannes : plus aucun appel", async () => {
    site.reponses = () => ({ statut: 503 });
    for (let i = 0; i < 7; i++) {
      await deposerMessage(depots, { idMessage: `msg-p${i}` });
    }
    await passer(T0 + 1000);
    expect(site.vus).toHaveLength(5);
  });
});

describe("17 · blocages Zernio ouvrent le disjoncteur", () => {
  it.each(["INBOX_REQUIRED", "message_allowance_exceeded"])("%s sur M1", async (code) => {
    port.reponses.prive = () => ({ statut: "refuse", code });
    await deposerCommentaire(depots, {});
    await passer();
    expect((await MS.lireGardes()).disjoncteur.ouvert).toBe(true);
    expect((await etatDe(A)).etat).toBe("m1_refuse");
    const avant = port.total();
    await deposerCommentaire(depots, { idAuteur: "autre-personne-fictive" });
    await passer(T0 + 1000);
    expect(port.total()).toBe(avant);
    const alertes = await depots().notifications.lister(() => true);
    expect(alertes.length).toBeGreaterThan(0);
  });
});

describe("19 · événement périmé", () => {
  it("commentaire reçu il y a plus de 24 h : perimé, aucun effet", async () => {
    const id = await deposerCommentaire(depots, { ageMs: 25 * 3600_000 });
    await passer();
    expect((await evenement(depots, id)).charge.etat).toBe("perime");
    expect(port.total()).toBe(0);
    expect(await etatDe(A)).toBeUndefined();
  });
});

describe("expiration", () => {
  it("attente_email expire 7 jours après M1, sans message", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    await passer(T0 + 6 * 86_400_000);
    expect((await etatDe(A)).etat).toBe("attente_email");
    const avant = port.total();
    await passer(T0 + 7 * 86_400_000);
    expect((await etatDe(A)).etat).toBe("expire");
    expect(port.total()).toBe(avant);
  });
});

describe("15 et 20 · aucune adresse stockée, textes du dictionnaire", () => {
  it("15 · après un parcours complet et des pannes : aucun « @ » en base, outbox, journal, notifications", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    site.reponses = () => ({ statut: 503 });
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    site.reponses = () => ({ statut: 200, corps: {} });
    await passer(T0 + 8 * 3600_000);
    const d = depots();
    const tout = JSON.stringify([await d.parametres.lister(() => true), await d.evenementsFournisseurs.lister(() => true), await d.evenements.lister(() => true), await d.notifications.lister(() => true)]);
    expect(site.vus.length).toBeGreaterThan(0);
    expect(tout).not.toContain("@");
    expect(tout).not.toContain("example.test");
  });
  it("20 · tous les textes envoyés sont du dictionnaire v2, sans STOP ni « autres informations »", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => "bonjour";
    await deposerMessage(depots, {});
    await passer(T0 + 1000);
    port.reponses.texte = () => ADRESSE_FICTIVE;
    await deposerMessage(depots, {});
    await passer(T0 + 2000);
    const envoyes = [...port.pub, ...port.prive, ...port.envoyes].map((x) => x.texte);
    expect(envoyes).toHaveLength(4);
    const permis = new Set([rendreTexteMp("mp-pub-igfb-v1", {}), rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }), rendreTexteMp("mp-m2-v1", {}), rendreTexteMp("mp-recu-v2", { titre: TITRE })]);
    for (const t of envoyes) {
      expect(permis.has(t)).toBe(true);
      expect(t).not.toMatch(/\bstop\b/i);
      expect(t).not.toMatch(/autres informations/i);
      expect(t).not.toMatch(/\[[A-Z ]+\]/);
    }
    expect(Object.keys(TEXTES_MP)).toContain("mp-m1-v2");
  });
  it("20 bis · texte à trous (titre du guide absent) : M1 ne part pas", async () => {
    await deposerCommentaire(depots, {});
    await passer(T0, { titreGuide: undefined });
    expect(port.prive).toHaveLength(0);
    // Titre absent : la garde de validation (qui recalcule l'empreinte) bloque AVANT M1 ; l'événement attend, rien ne part.
    expect(await etatDe(A)).toBeFalsy();
    expect(port.pub).toHaveLength(0);
  });
});
