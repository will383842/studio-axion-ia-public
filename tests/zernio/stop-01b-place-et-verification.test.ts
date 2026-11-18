/**
 * STOP-01b · la vérification d'opposition LÈVE après la réservation d'une place d'envoi (réponse au OK Instagram ; merci après la page).
 * Avant le correctif : la place du plafond horaire restait consommée et l'état restait « en vol » (faux « à vérifier », faux accusé « envoyé »).
 * Après : place rendue, état d'avant remis (retour arrière technique, sous verrou, seulement si l'entrée est encore intacte), erreur d'origine relancée,
 * RIEN ne part. Une opposition détectée reste bloquante. Données 100 % fictives ; faux port, faux site : aucun réseau.
 * Déclencheur commun : un `vi.mock` du registre d'opposition qui lève (comme un registre illisible) UNIQUEMENT quand la marque « en vol » est déjà écrite,
 * c'est-à-dire après la réservation de la place.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import fixture from "./aides/confirmations-page-guide.v1.json";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, nettoyer, Opp, passer, pm, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";
import { cleConversation, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";

const etat = vi.hoisted(() => ({ versionsSite: new Set<string>(), avant: null as null | (() => Promise<void>) }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => etat.versionsSite.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => null }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, unknown>>()), textesValidesPourLeMot: () => true, validationPourEnvoi: async () => null }));
// Le vrai registre, sauf qu'un crochet de test peut s'exécuter juste avant la vérification « partout » (et lever, ou inscrire un « stop »).
vi.mock("@/services/oppositions-mots", async (orig) => {
  const r = await orig<typeof import("@/services/oppositions-mots")>();
  return {
    ...r,
    personneOpposeePartout: async (...a: Parameters<typeof r.personneOpposeePartout>) => {
      await etat.avant?.();
      return r.personneOpposeePartout(...a);
    },
  };
});

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

interface Conv {
  etat: string;
  idMessageOk?: string;
  okRecus?: number;
  essaiEnvoiLe?: string;
  dernierCode?: string | null;
  merciEtat?: string;
  merciEssaiLe?: string;
}
interface EntreeJournal {
  cle: string | null;
  etat: string;
  issue: string;
  accuse: boolean;
  le: string;
}

const H = 3600_000;
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const ENV_MERCI = { ...ENV, PARCOURS_MERCI_ENABLED: "1" };
const FORM = ["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", "mp-lien-v3-1"];
const T1 = T0 + 10_000;
const iso = (ms: number) => new Date(ms).toISOString();
const cleG = (n: string) => n.padEnd(64, "0");
const racine = () => cleConversation(AUTEUR);
const PARAM_JOURNAL = "parcours.merci.journal";
const PARAM_VALIDATION_MERCI = "parcours.validation.merci";

const conv = async () => (await toutesLesConversations()) as Record<string, Conv>;
const envoisCompte = async (): Promise<number> => (await Com.lireParametre<Record<string, { envois?: number }>>(C.PARAM_COMPTEURS_CONVERSATION, {}))[COMPTE]?.envois ?? 0;
const alerteNotif = async (re: RegExp): Promise<number> => (await depots().notifications.lister((n: { message: string }) => re.test(n.message))).length;
const journalTexte = async (): Promise<string> => JSON.stringify([await depots().evenements.lister(() => true), await depots().notifications.lister(() => true)]);
const panne = () => new Opp.ErreurOppositionIllisible("registre");

beforeEach(async () => {
  await preparer();
  etat.versionsSite = new Set(["mp-lien-v3-1", "mp-m1-v4-1"]);
  etat.avant = null;
});
afterEach(nettoyer);

/* ============================== Réponse au OK Instagram ============================== */

async function semer(n: string, etatP: string): Promise<string> {
  const cle = cleParcours(racine(), cleG(n));
  const tout = await toutesLesConversations();
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    ...tout,
    [cle]: {
      ...graineConv(etatP, {
        reseau: "instagram", cleIdempotenceGuide: cleG(n), idCommentaire: `com-graine-${n}`, mot: "GUIDE", nature: "premier", groupeM1: "m1-lien", titreCible: TITRE,
        versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 5 * H), m1Le: iso(T0 - 5 * H + 1000),
      }),
    },
  });
  return cle;
}
const messageOk = (id = "msg-ok-1") => deposerMessage(depots, { idMessage: id, avance: 5000 });
const evt = async (id: string) => (await evenement(depots, id)).charge as Record<string, unknown>;
const passerIg = (ms: number) => passer(ms, { env: ENV_LIEN });
/** Crochet : la vérification lève dès que la marque « en vol » du OK est écrite (donc APRÈS la réservation de la place). */
const levePourIgEnVol = (suite?: (tout: Record<string, Conv>) => Promise<void>): void => {
  etat.avant = async () => {
    const tout = await conv();
    if (!Object.values(tout).some((x) => x.etat === "ig_envoi_en_vol")) return;
    await suite?.(tout);
    throw panne();
  };
};

describe("STOP-01b · OK Instagram", () => {
  let cle = "";
  beforeEach(async () => {
    // Harnais : la personne « suit » le compte (lecture du suivi du faux port) et son message vaut « OK ».
    (banc.port.port as unknown as { lireSuiviInstagram: () => Promise<{ statut: string }> }).lireSuiviInstagram = async () => ({ statut: "suit" });
    banc.port.reponses.texte = () => "OK";
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
    await validerFormulationsAuParcours(FORM);
    cle = await semer("1", "ig_attente_ok");
  });

  it("1 · OK Instagram : la vérification lève après la réservation, la place du plafond est rendue", async () => {
    levePourIgEnVol();
    const avant = await envoisCompte();
    const e = await messageOk();
    await passerIg(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await envoisCompte()).toBe(avant);
    expect(await evt(e)).toMatchObject({ etat: "a_reessayer", dernierCode: "registre_illisible" });
  });

  it("2 · OK Instagram : la vérification lève, l'état d'avant est remis, jamais ig_a_verifier ni fausse alerte", async () => {
    levePourIgEnVol();
    await messageOk();
    await passerIg(T1);
    const c = (await conv())[cle];
    expect(c.etat).toBe("ig_attente_ok");
    expect(c.idMessageOk).toBeUndefined();
    expect(c.okRecus).toBeUndefined();
    expect(c.essaiEnvoiLe).toBeUndefined();
    await passerIg(T1 + 1000); // l'événement n'est pas encore dû : seule la reprise « en vol » tourne
    expect((await conv())[cle].etat).toBe("ig_attente_ok");
    expect(await alerteNotif(/en cours d'envoi/)).toBe(0);
  });

  it("3 · OK Instagram : rejeu après la panne, exactement un envoi, puis plus aucun", async () => {
    let dejaLeve = false;
    etat.avant = async () => {
      if (dejaLeve || !Object.values(await conv()).some((x) => x.etat === "ig_envoi_en_vol")) return;
      dejaLeve = true;
      throw panne();
    };
    const avant = await envoisCompte();
    await messageOk();
    await passerIg(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    await passerIg(T1 + 60_000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].cle).toBe(`msg-ok-1|ig|lien-rappel|${cle}`);
    await passerIg(T1 + 120_000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(await envoisCompte()).toBe(avant + 1);
    expect((await conv())[cle]).toMatchObject({ etat: "attente_email", idMessageOk: "msg-ok-1", okRecus: 1 });
  });

  it("4 · OK Instagram : la lecture des autres messages lève après la réservation, même nettoyage", async () => {
    const ev = depots().evenementsFournisseurs;
    const lister = ev.lister.bind(ev);
    vi.spyOn(ev, "lister").mockImplementation(async (f) => {
      const enVol = Object.values(await conv()).some((x) => x.etat === "ig_envoi_en_vol");
      if (enVol && (await envoisCompte()) >= 1) throw new Error("panne de base fictive");
      return lister(f);
    });
    const avant = await envoisCompte();
    await messageOk();
    await passerIg(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await envoisCompte()).toBe(avant);
    expect((await conv())[cle].etat).toBe("ig_attente_ok");
  });

  it("5 · OK Instagram : nettoyage de l'état en échec, l'erreur d'origine remonte (événement reporté), aucun envoi, la place est rendue", async () => {
    const p = depots().parametres;
    const enregistrer = p.enregistrer.bind(p);
    let casse = false;
    vi.spyOn(p, "enregistrer").mockImplementation(async (x) => {
      if (casse && x.id === C.PARAM_CONVERSATIONS) throw new Error("panne de base fictive");
      return enregistrer(x);
    });
    levePourIgEnVol(async () => {
      casse = true;
    });
    const avant = await envoisCompte();
    const e = await messageOk();
    await passerIg(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await envoisCompte()).toBe(avant);
    expect(await evt(e)).toMatchObject({ etat: "a_reessayer", dernierCode: "registre_illisible" });
    casse = false;
    expect((await conv())[cle].etat).toBe("ig_envoi_en_vol"); // repli = comportement d'avant le correctif : jamais d'envoi, jamais de masquage de l'erreur
  });

  it("6 · OK Instagram : un autre processus a déjà repris l'état, le nettoyage n'écrase rien", async () => {
    levePourIgEnVol(async (tout) => {
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...tout, [cle]: { ...tout[cle], etat: "ig_a_verifier", dernierCode: "redemarrage" } });
    });
    const avant = await envoisCompte();
    await messageOk();
    await passerIg(T1);
    expect((await conv())[cle]).toMatchObject({ etat: "ig_a_verifier", dernierCode: "redemarrage" });
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await envoisCompte()).toBe(avant);
  });

  it("5b · OK Instagram : nettoyage en échec, UNE ligne technique « nettoyage_impossible » sans donnée de personne, l'erreur d'origine reste relancée", async () => {
    const p = depots().parametres;
    const enregistrer = p.enregistrer.bind(p);
    let casse = false;
    vi.spyOn(p, "enregistrer").mockImplementation(async (x) => {
      if (casse && x.id === C.PARAM_CONVERSATIONS) throw new Error("panne de base fictive");
      return enregistrer(x);
    });
    levePourIgEnVol(async () => {
      casse = true;
    });
    const e = await messageOk();
    await passerIg(T1);
    casse = false;
    expect(await evt(e)).toMatchObject({ etat: "a_reessayer", dernierCode: "registre_illisible" });
    const lignes = await depots().evenements.lister((x: { message: string }) => /nettoyage_impossible/.test(x.message));
    expect(lignes).toHaveLength(1);
    expect((lignes[0] as { message: string }).message).toBe("nettoyage_impossible");
    const texte = await journalTexte();
    for (const interdit of [AUTEUR, racine(), cle, cleG("1"), "msg-ok-1"]) expect(texte).not.toContain(interdit);
  });

  it("10 · interrupteur éteint, sans panne : comportement identique (un envoi, une place, mêmes états)", async () => {
    expect(ENV_LIEN).not.toHaveProperty("OPPOSITIONS_SITE_IMPORT_ENABLED");
    const avant = await envoisCompte();
    const e = await messageOk();
    await passerIg(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].cle).toBe(`msg-ok-1|ig|lien-rappel|${cle}`);
    expect(await envoisCompte()).toBe(avant + 1);
    expect((await conv())[cle]).toMatchObject({ etat: "attente_email", idMessageOk: "msg-ok-1", okRecus: 1 });
    expect(await evt(e)).toMatchObject({ etat: "envoye" });
  });

  it("11 · témoin : opposition détectée avant l'envoi, inchangé (place rendue, rien ne part, clos « silence / opposee »)", async () => {
    let inscrit = false;
    etat.avant = async () => {
      if (inscrit || !Object.values(await conv()).some((x) => x.etat === "ig_envoi_en_vol")) return;
      inscrit = true;
      await Opp.enregistrerOpposition(AUTEUR, "zernio-conversation", { env: ENV_LIEN });
    };
    const avant = await envoisCompte();
    const e = await messageOk();
    await passerIg(T1);
    expect(inscrit).toBe(true);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await envoisCompte()).toBe(avant);
    expect(await evt(e)).toMatchObject({ etat: "silence", dernierCode: "opposee" });
    expect((await conv())[cle].etat).toBe("oppose");
  });

  it("12 · journaux : aucune donnée de personne dans les journaux ni les alertes", async () => {
    levePourIgEnVol();
    await messageOk();
    await passerIg(T1);
    await passerIg(T1 + 1000);
    const texte = await journalTexte();
    for (const interdit of [AUTEUR, racine(), cle, cleG("1")]) expect(texte).not.toContain(interdit);
  });
});

/* ============================== Merci après la page ============================== */

const A = "auteur-fictif-400";
const ID_CONV_ZERNIO = "conv-fictive-700";
const ref = (n: number) => createHash("sha256").update(`jeton-fictif-${n}`).digest("hex");
const empreinteMerci = () => createHash("sha256").update(`mp-merci-v1\n${TEXTES_MP["mp-merci-v1"].texte}`).digest("hex");
const texteMerci = () => rendreTexteMp("mp-merci-v1", { titre: TITRE }) as string;

function fauxSiteMerci() {
  const s = {
    file: [] as Array<{ ref: string; valideLe: string }>,
    accuses: [] as string[],
    transport: async (r: { chemin: string; corps: string }) => {
      if (r.chemin === fixture.lecture.chemin) return { statut: 200, corps: { ok: true, schemaVersion: 1, confirmations: s.file } };
      if (r.chemin === fixture.accuse.chemin) {
        s.accuses.push(r.corps);
        return { statut: 200, corps: { ok: true, schemaVersion: 1, recus: 1 } };
      }
      return { statut: 404, corps: {} };
    },
    issues: () => s.accuses.flatMap((c) => (JSON.parse(c) as { issues: Array<{ ref: string; issue: string }> }).issues),
  };
  return s;
}
let site: ReturnType<typeof fauxSiteMerci>;
const passerMerci = (ms = T0) => C.traiterMercis({ port: banc.port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV_MERCI, maintenantMs: ms });
const lireJournal = () => Com.lireParametre<Record<string, EntreeJournal>>(PARAM_JOURNAL, {});
const etatDe = async () => (await conv())[cleConversation(A)];
const merciEnvoyes = () => banc.port.envoyes.filter((e) => e.texte === texteMerci());
const confirmer = (...refs: string[]) => {
  site.file = refs.map((r) => ({ ref: r, valideLe: iso(T0 - 60_000) }));
};
async function poserPersonne(extra: Record<string, unknown> = {}): Promise<void> {
  const cle = cleConversation(A);
  const tout = await toutesLesConversations();
  tout[cle] = {
    etat: "attente_email", reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-fictif-1", idPostPlateforme: "post-plateforme-fictif-200",
    versionTexteM1: "mp-m1-v4-1", guide: "guide-ia", cleIdempotenceGuide: `cle-${A}`, creeLe: iso(T0 - 2 * H), m1Le: iso(T0 - 2 * H),
    occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [],
    refLienConv: "c1_AbCdEf0123456789_-xyZQ", empreintesLien: [ref(1)], derniereActiviteLe: iso(T0 - H), idMessageDernier: `msg-dernier-${A}`, ...extra,
  };
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
  if ((await depots().evenementsFournisseurs.lister((x: { id: string }) => x.id === `evf-msg-dernier-${A}`)).length > 0) return;
  await depots().evenementsFournisseurs.enregistrer({
    id: `evf-msg-dernier-${A}`, fournisseur: "zernio", idEvenement: `evt-msg-dernier-${A}`, type: "zernio.message", recuLe: iso(T0 - H), traite: true, creeLe: iso(T0 - H), modifieLe: iso(T0 - H),
    charge: { idMessage: `msg-dernier-${A}`, idConversation: ID_CONV_ZERNIO, idCompte: COMPTE, idExpediteur: A, etat: "termine" },
  });
}
/** Crochet : la vérification finale lève dès que le journal des merci porte une marque « en vol » (donc APRÈS la réservation de la place). */
const leveSiMerciEnVol = (suite?: (j: Record<string, EntreeJournal>) => Promise<void>): void => {
  etat.avant = async () => {
    const j = await lireJournal();
    if (!Object.values(j).some((x) => x.etat === "en_vol")) return;
    await suite?.(j);
    throw panne();
  };
};

describe("STOP-01b · merci après la page", () => {
  beforeEach(async () => {
    site = fauxSiteMerci();
    pm.injecterTransportSite(site.transport);
    await Com.ecrireParametre("parcours.instagram_public", true);
    await Com.ecrireParametre(PARAM_VALIDATION_MERCI, { empreinte: empreinteMerci() });
    await poserPersonne();
  });

  it("7 · merci : la vérification finale lève, place rendue, journal et conversation remis, aucun accusé", async () => {
    leveSiMerciEnVol();
    confirmer(ref(1));
    const avant = await envoisCompte();
    await passerMerci(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect(await envoisCompte()).toBe(avant);
    expect((await lireJournal())[ref(1)]).toBeUndefined();
    expect((await etatDe()).merciEtat).toBeUndefined();
    expect(site.accuses).toHaveLength(0);
    expect((await depots().evenements.lister((e: { message: string }) => /verification_impossible/.test(e.message))).length).toBe(1);
  });

  it("7b · merci Instagram : la date d'essai du plafond par personne est remise comme avant", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
    const ancienne = iso(T0 - 25 * H);
    await poserPersonne({ merciEssaiLe: ancienne });
    leveSiMerciEnVol();
    confirmer(ref(1));
    await passerMerci(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect((await lireJournal())[ref(1)]).toBeUndefined();
    expect(await etatDe()).toMatchObject({ merciEssaiLe: ancienne });
    expect((await etatDe()).merciEtat).toBeUndefined();
  });

  it("8 · merci : passage suivant, aucune alerte « à vérifier », aucun accusé « envoye », puis un seul merci quand le site re-propose", async () => {
    leveSiMerciEnVol();
    confirmer(ref(1));
    await passerMerci(T0);
    etat.avant = null;
    await passerMerci(T0 + 2 * 60_000); // le site re-propose la même référence : un seul merci part
    expect(await alerteNotif(/issue inconnue/)).toBe(0);
    expect(merciEnvoyes()).toHaveLength(1);
    expect(site.issues()).toEqual([{ ref: ref(1), issue: "envoye" }]);
    await passerMerci(T0 + 4 * 60_000);
    expect(merciEnvoyes()).toHaveLength(1);
  });

  it("9 · merci : entrée du journal déjà reprise par un autre processus (état différent), non retirée", async () => {
    leveSiMerciEnVol(async (j) => {
      await Com.ecrireParametre(PARAM_JOURNAL, { ...j, [ref(1)]: { ...j[ref(1)], etat: "a_verifier", issue: "a_verifier" } });
    });
    confirmer(ref(1));
    const avant = await envoisCompte();
    await passerMerci(T0);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "a_verifier" });
    expect(merciEnvoyes()).toHaveLength(0);
    expect(await envoisCompte()).toBe(avant);
  });

  it("9e · merci : reprise concurrente déjà passée au journal en « à vérifier » avant l'écriture de la conversation, la conversation garde sa marque", async () => {
    leveSiMerciEnVol(async (j) => {
      await Com.ecrireParametre(PARAM_JOURNAL, { ...j, [ref(1)]: { ...j[ref(1)], etat: "a_verifier", issue: "a_verifier" } });
    });
    confirmer(ref(1));
    await passerMerci(T0);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "a_verifier" });
    expect((await etatDe()).merciEtat).toBe("en_vol"); // le journal et la conversation restent cohérents : la reprise concurrente termine son ouvrage
  });

  it("9b · merci : entrée du journal d'une autre date (autre appel), non retirée", async () => {
    const autreDate = iso(T0 + 5000);
    leveSiMerciEnVol(async (j) => {
      await Com.ecrireParametre(PARAM_JOURNAL, { ...j, [ref(1)]: { ...j[ref(1)], le: autreDate } });
    });
    confirmer(ref(1));
    await passerMerci(T0);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "en_vol", le: autreDate });
  });

  it("9c · merci : la seconde écriture (journal) échoue, la conversation est déjà remise et l'entrée « en vol » restante est reprise (à vérifier, jamais renvoyé)", async () => {
    const p = depots().parametres;
    const enregistrer = p.enregistrer.bind(p);
    let casse = false;
    vi.spyOn(p, "enregistrer").mockImplementation(async (x) => {
      if (casse && x.id === PARAM_JOURNAL) throw new Error("panne de base fictive");
      return enregistrer(x);
    });
    leveSiMerciEnVol(async () => {
      casse = true;
    });
    confirmer(ref(1));
    const avant = await envoisCompte();
    await passerMerci(T0);
    casse = false;
    // Conversation écrite d'abord : plus de « en_vol » orphelin ; le journal garde l'entrée « en vol » que la reprise sait lire.
    expect((await etatDe()).merciEtat).toBeUndefined();
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "en_vol" });
    expect(await envoisCompte()).toBe(avant);
    etat.avant = null;
    await passerMerci(T0 + 2 * 60_000);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "a_verifier", issue: "a_verifier" });
    expect(await alerteNotif(/issue inconnue/)).toBe(1);
    expect(merciEnvoyes()).toHaveLength(0);
  });

  it("9d · merci : nettoyage en échec, UNE ligne technique « nettoyage_impossible » sans donnée de personne, l'erreur d'origine reste relancée", async () => {
    const p = depots().parametres;
    const enregistrer = p.enregistrer.bind(p);
    let casse = false;
    vi.spyOn(p, "enregistrer").mockImplementation(async (x) => {
      if (casse && x.id === C.PARAM_CONVERSATIONS) throw new Error("panne de base fictive");
      return enregistrer(x);
    });
    leveSiMerciEnVol(async () => {
      casse = true;
    });
    confirmer(ref(1));
    await passerMerci(T0);
    casse = false;
    expect((await depots().evenements.lister((e: { message: string }) => /verification_impossible/.test(e.message))).length).toBe(1); // l'erreur d'origine est bien celle traitée
    const lignes = await depots().evenements.lister((x: { message: string }) => /nettoyage_impossible/.test(x.message));
    expect(lignes).toHaveLength(1);
    expect((lignes[0] as { message: string }).message).toBe("nettoyage_impossible");
    const texte = await journalTexte();
    for (const interdit of [A, cleConversation(A), ref(1)]) expect(texte).not.toContain(interdit);
  });

  it("10 · interrupteur éteint, sans panne : comportement identique (un merci, une place, accusé « envoye »)", async () => {
    confirmer(ref(1));
    const avant = await envoisCompte();
    await passerMerci(T0);
    expect(merciEnvoyes()).toHaveLength(1);
    expect(await envoisCompte()).toBe(avant + 1);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "envoye", issue: "envoye", accuse: true });
    expect(await etatDe()).toMatchObject({ merciEtat: "envoye" });
    expect(site.issues()).toEqual([{ ref: ref(1), issue: "envoye" }]);
  });

  it("11 · témoin : opposition détectée avant l'envoi, inchangé (place rendue, rien ne part, « non_envoye / oppose »)", async () => {
    let inscrit = false;
    etat.avant = async () => {
      if (inscrit || !Object.values(await lireJournal()).some((x) => x.etat === "en_vol")) return;
      inscrit = true;
      await Opp.enregistrerOpposition(A, "zernio-conversation", { env: ENV_MERCI });
    };
    confirmer(ref(1));
    const avant = await envoisCompte();
    await passerMerci(T0);
    expect(inscrit).toBe(true);
    expect(merciEnvoyes()).toHaveLength(0);
    expect(await envoisCompte()).toBe(avant);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "non_envoye", issue: "oppose" });
  });

  it("12 · journaux : aucune donnée de personne (auteur, clé, référence) dans les journaux ni les alertes", async () => {
    leveSiMerciEnVol();
    confirmer(ref(1));
    await passerMerci(T0);
    await passerMerci(T0 + 2 * 60_000);
    const texte = await journalTexte();
    for (const interdit of [A, cleConversation(A), ref(1)]) expect(texte).not.toContain(interdit);
  });
});

/* ============================== Lecture du source ============================== */

const source = readFileSync(join(process.cwd(), "src/services/parcours-conversation.ts"), "utf8");
/** Corps d'une fonction de premier niveau : de sa ligne de tête jusqu'à la tête de la fonction suivante. */
function corps(nom: string): string {
  const debut = new RegExp(`^(export )?(async )?function ${nom}\\b`, "m").exec(source);
  if (!debut) throw new Error(`fonction introuvable : ${nom}`);
  const suite = source.slice(debut.index + debut[0].length);
  const fin = /^(export )?(async )?function \w+/m.exec(suite);
  return fin ? suite.slice(0, fin.index) : suite;
}

describe("13 · lecture du source : sur les chemins sains, la vérification précède la réservation", () => {
  it.each(["repondrePubliqueSeule", "etapesCommentaire", "traiterMessage", "prevenirAdresseRefusee", "envoyerRecu"])("%s : avant chaque réservation de place, une vérification d'opposition", (nom) => {
    const c = corps(nom);
    let depart = 0;
    let n = 0;
    for (let i = c.indexOf("reserverOuReporter("); i !== -1; i = c.indexOf("reserverOuReporter(", i + 1)) {
      const segment = c.slice(depart, i);
      expect(segment).toMatch(/verifierPartout\(|verifierRacine\(/);
      depart = i;
      n++;
    }
    expect(n).toBeGreaterThan(0);
  });
});
