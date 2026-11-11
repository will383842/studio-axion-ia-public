/**
 * Z4 · le Studio lit les pages validées (route signée du site), envoie UN merci quand c'est permis, ne l'envoie JAMAIS deux fois
 * pour une même référence ni à une personne opposée, puis accuse réception au site. Éteint par défaut (PARCOURS_MERCI_ENABLED).
 * Données 100 % fictives ; site FAUX qui sert la fixture, port FAUX pour la lecture, VRAI constructeur de corps pour l'envoi.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { creerPortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { ENTETE_HORODATAGE, ENTETE_NONCE, ENTETE_SIGNATURE, signatureValide } from "@/fournisseurs/site/signature";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import { creerFauxClientZernio } from "./aides/faux-zernio";
import fixture from "./aides/confirmations-page-guide.v1.json";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, fauxPort, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Opp = await import("@/services/oppositions-mots");
const Z = await import("@/services/zernio");

const H = 3600_000;
const A = "auteur-fictif-400";
const B = "auteur-fictif-401";
const ID_CONV_ZERNIO = "conv-fictive-700";
const ID_CONV_ZERNIO_B = "conv-fictive-701";
const ENV_MERCI = { ...ENV, PARCOURS_MERCI_ENABLED: "1" };
const SECRET_SITE = ENV.SITE_GUIDES_RESEAU_SECRET;
const PARAM_VALIDATION = "parcours.validation.merci";
const PARAM_JOURNAL = "parcours.merci.journal";
const PARAM_FILE_PAGE = "parcours.oppositions.page";
const ref = (n: number) => createHash("sha256").update(`jeton-fictif-${n}`).digest("hex");
const empreinteMerci = () => createHash("sha256").update(`mp-merci-v1\n${TEXTES_MP["mp-merci-v1"].texte}`).digest("hex");
const texteMerci = () => rendreTexteMp("mp-merci-v1", { titre: TITRE }) as string;

/** Faux site : sert la fixture (lecture-réservation) et note les accusés. */
function fauxSiteMerci() {
  const s = {
    lectures: [] as RequeteSignee[],
    accuses: [] as RequeteSignee[],
    file: [] as Array<{ ref: string; valideLe: string }>,
    statutLecture: 200,
    statutAccuse: 200,
    transport: async (r: RequeteSignee) => {
      if (r.chemin === fixture.lecture.chemin) {
        s.lectures.push(r);
        return { statut: s.statutLecture, corps: s.statutLecture === 200 ? { ok: true, schemaVersion: 1, confirmations: s.file } : { ok: false } };
      }
      if (r.chemin === fixture.accuse.chemin) {
        s.accuses.push(r);
        return { statut: s.statutAccuse, corps: s.statutAccuse === 200 ? { ok: true, schemaVersion: 1, recus: 1 } : { ok: false } };
      }
      return { statut: 404, corps: {} };
    },
    issues: () => s.accuses.flatMap((r) => (JSON.parse(r.corps) as { issues: Array<{ ref: string; issue: string }> }).issues),
  };
  return s;
}

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSiteMerci>;
const passer = (ms = T0, env: Record<string, string | undefined> = ENV_MERCI, p = port.port) => C.traiterMercis({ port: p, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const lireJournal = () => Com.lireParametre<Record<string, any>>(PARAM_JOURNAL, {});
const etatDe = async (auteur = A) => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(auteur)];
const merciEnvoyes = () => port.envoyes.filter((e) => e.texte === texteMerci());
const notifs = async () => (await depots().notifications.lister(() => true)) as Array<{ message: string; envoi?: unknown }>;

/** Une personne passée par M1 v3 : son lien (empreinte du jeton) est au registre, elle a écrit il y a `ageMs`. */
async function poserPersonne(o: { auteur?: string; refs?: string[]; ageMs?: number | null; idConversation?: string; etat?: string; idMessageDernier?: string } = {}): Promise<void> {
  const auteur = o.auteur ?? A;
  const cle = cleConversation(auteur);
  const idMessageDernier = o.idMessageDernier ?? `msg-dernier-${auteur}`;
  const conv = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
  conv[cle] = {
    etat: o.etat ?? "attente_email", reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-fictif-1", idPostPlateforme: "post-plateforme-fictif-200",
    versionTexteM1: "mp-m1-v4-1", guide: "guide-ia", cleIdempotenceGuide: `cle-${auteur}`, creeLe: new Date(T0 - 2 * H).toISOString(), m1Le: new Date(T0 - 2 * H).toISOString(),
    occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [],
    refLienConv: "c1_AbCdEf0123456789_-xyZQ", empreintesLien: o.refs ?? [ref(1)],
    ...(o.ageMs === null ? {} : { derniereActiviteLe: new Date(T0 - (o.ageMs ?? H)).toISOString(), idMessageDernier }),
  };
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, conv);
  if (o.ageMs !== null) {
    const m = new Date(T0 - (o.ageMs ?? H)).toISOString();
    await depots().evenementsFournisseurs.enregistrer({ id: `evf-${idMessageDernier}`, fournisseur: "zernio", idEvenement: `evt-${idMessageDernier}`, type: "zernio.message", recuLe: m, traite: true, creeLe: m, modifieLe: m, charge: { idMessage: idMessageDernier, idConversation: o.idConversation ?? ID_CONV_ZERNIO, idCompte: COMPTE, idExpediteur: auteur, etat: "termine" } });
  }
}
const confirmer = (...refs: string[]) => { site.file = refs.map((r) => ({ ref: r, valideLe: new Date(T0 - 60_000).toISOString() })); };

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSiteMerci();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
  await Com.ecrireParametre(PARAM_VALIDATION, { empreinte: empreinteMerci() });
  await poserPersonne();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

/** Port d'écriture RÉEL (creerPortInboxZernio → client réel → verifierCorpsInbox) ; seule la lecture reste fausse. */
function portReel(reponse = () => ({ statut: 200, corps: { messageId: "msg-sortant-1" } } as { statut: number; corps: unknown })) {
  const { client, faux } = creerFauxClientZernio(reponse);
  const reel = creerPortInboxZernio({ client, comptesPermis: [COMPTE], titresGuidesPermis: [TITRE] });
  return { port: { ...port.port, envoyerMessage: reel.envoyerMessage }, faux };
}
const posts = (p: ReturnType<typeof portReel>) => p.faux.appels.filter((a) => a.methode === "POST");

describe("0 · le texte du merci (proposition à valider par l'opérateur)", () => {
  it("clé mp-merci-v1 : ton personnel, vouvoiement, sans signature, jamais « Message automatique », sans STOP ni prix", () => {
    const b = TEXTES_MP["mp-merci-v1"];
    expect(b.version).toBe("mp-merci-v1");
    expect(b.texte).toContain("[TITRE DU GUIDE]");
    expect(b.texte).not.toMatch(/message automatique|automatique|axion/i);
    expect(b.texte).not.toMatch(/\bstop\b|autres? informations|€|\beuros?\b|\bprix\b|\btarifs?\b|\b(tu|ton|ta|tes|toi)\b|aucun gain/i);
    expect(b.texte).toMatch(/\bvotre\b|\bvous\b/i);
    expect(b.texte.toLowerCase()).not.toContain(["gren", "oble"].join(""));
    expect(b.texte.trimEnd().endsWith("—")).toBe(false);
  });
  it("accepté par le VRAI constructeur côté privé, refusé côté public", async () => {
    const { texteDuDictionnaire } = await import("@/fournisseurs/publication/zernio-inbox-corps");
    expect(texteDuDictionnaire(texteMerci(), false)).toBe(true);
    expect(texteDuDictionnaire(texteMerci(), true)).toBe(false);
  });
  it("la fixture du site est figée (SHA-256 inscrit) et l'écart avec la fiche est écrit dedans", async () => {
    const { readFileSync } = await import("node:fs");
    const brut = readFileSync(new URL("./aides/confirmations-page-guide.v1.json", import.meta.url));
    expect(createHash("sha256").update(brut).digest("hex")).toBe("99c8b853e6a2cea6cc9fc436bc5b07da1ac323a8ecd761972a03ec17201cf333");
    expect(fixture.note).toMatch(/ÉCART/);
    expect(fixture.accuse.issues_acceptees).toEqual(["envoye", "hors_fenetre", "echec"]);
  });
});

describe("1 · chemin nominal (VRAI constructeur d'envoi)", () => {
  it("1 merci, accusé « envoye » signé, registre et état renseignés, rien de personnel dans le corps", async () => {
    confirmer(ref(1));
    const p = portReel();
    await passer(T0, ENV_MERCI, p.port);
    const envois = posts(p);
    expect(envois).toHaveLength(1);
    expect(envois[0].url).toContain(`/conversations/${ID_CONV_ZERNIO}/messages`);
    expect((envois[0].json as { message: string }).message).toBe(texteMerci());
    expect(envois[0].corps).not.toContain(ADRESSE_FICTIVE);
    // lecture-réservation : signée, chemin et corps de la fixture
    expect(site.lectures).toHaveLength(1);
    expect(site.lectures[0].methode).toBe("POST");
    expect(site.lectures[0].chemin).toBe(fixture.lecture.chemin);
    expect(JSON.parse(site.lectures[0].corps)).toEqual({ schemaVersion: 1, limite: 10 });
    // accusé : signé avec le secret fictif, liste fermée
    expect(site.accuses).toHaveLength(1);
    const acc = site.accuses[0];
    expect(signatureValide(SECRET_SITE, { methode: "POST", chemin: fixture.accuse.chemin, corps: acc.corps, horodatage: acc.entetes[ENTETE_HORODATAGE], nonce: acc.entetes[ENTETE_NONCE], signature: acc.entetes[ENTETE_SIGNATURE] })).toBe(true);
    expect(JSON.parse(acc.corps)).toEqual({ schemaVersion: 1, issues: [{ ref: ref(1), issue: "envoye" }] });
    const j = await lireJournal();
    expect(j[ref(1)]).toMatchObject({ etat: "envoye", issue: "envoye", accuse: true });
    expect(await etatDe()).toMatchObject({ merciEtat: "envoye" });
    expect((await etatDe()).merciLe).toBe(new Date(T0).toISOString());
  });
  it("la clé d'idempotence envoyée à Zernio est propre à la conversation (jamais le même merci pour une autre personne)", async () => {
    await poserPersonne({ auteur: B, refs: [ref(2)], idConversation: ID_CONV_ZERNIO_B });
    confirmer(ref(1), ref(2));
    const p = portReel();
    await passer(T0, ENV_MERCI, p.port);
    const cles = posts(p).map((a) => a.entetes["Idempotency-Key"] ?? a.entetes["idempotency-key"]);
    expect(cles).toHaveLength(2);
    expect(new Set(cles).size).toBe(2);
  });
});

describe("2 · jamais deux fois la même référence", () => {
  it("le site re-propose la même ref (réservation expirée) : 0 nouvel envoi", async () => {
    confirmer(ref(1));
    await passer(T0);
    confirmer(ref(1));
    await passer(T0 + 11 * 60_000);
    expect(merciEnvoyes()).toHaveLength(1);
  });
  it("accusé perdu puis ref re-proposée : l'accusé repart, pas le merci", async () => {
    site.statutAccuse = 503;
    confirmer(ref(1));
    await passer(T0);
    site.statutAccuse = 200;
    confirmer(ref(1));
    await passer(T0 + 2 * 60_000);
    expect(merciEnvoyes()).toHaveLength(1);
    expect((await lireJournal())[ref(1)].accuse).toBe(true);
    expect(site.issues().filter((i) => i.issue === "envoye").length).toBeGreaterThanOrEqual(2);
  });
});

describe("3 · deux refs pour la même conversation : un seul merci", () => {
  it("la 2e reçoit deja_remercie, accusée sans envoi", async () => {
    await poserPersonne({ refs: [ref(1), ref(3)] });
    confirmer(ref(1), ref(3));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(1);
    const j = await lireJournal();
    expect(j[ref(1)].issue).toBe("envoye");
    expect(j[ref(3)]).toMatchObject({ etat: "non_envoye", issue: "deja_remercie", accuse: true });
  });
});

describe("4 · l'opposition est relue, et à nouveau juste avant le réseau", () => {
  it("(a) personne déjà « oppose » : 0 envoi, accusé sans envoi, entrée dans la file de la page", async () => {
    const conv = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
    conv[cleConversation(A)].etat = "oppose";
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, conv);
    confirmer(ref(1));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "non_envoye", issue: "oppose", accuse: true });
    expect(site.issues()).toEqual([{ ref: ref(1), issue: "hors_fenetre" }]);
    expect(Object.keys(await Com.lireParametre(PARAM_FILE_PAGE, {}))).toContain(cleConversation(A));
  });
  it("(b) opposition inscrite PENDANT le passage (entre l'écriture « en vol » et l'envoi) : 0 envoi", async () => {
    confirmer(ref(1));
    let armee = false;
    const vrai = Com.ecrireParametre;
    const espion = vi.spyOn(Com, "ecrireParametre").mockImplementation(async (nom: string, v: unknown) => {
      await vrai(nom, v);
      if (!armee && nom === PARAM_JOURNAL && Object.values(v as Record<string, { etat: string }>).some((x) => x.etat === "en_vol")) {
        armee = true;
        await Opp.enregistrerOppositionSousVerrou(A, "zernio-conversation", { env: ENV }); // appelé depuis la section sous verrou : variante sans verrou
      }
    });
    await passer(T0);
    espion.mockRestore();
    expect(armee).toBe(true);
    expect(merciEnvoyes()).toHaveLength(0);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "non_envoye", issue: "oppose" });
    expect(await etatDe()).toMatchObject({ merciEtat: "non_envoye" });
  });
  it("(c) opposition au REGISTRE seulement (état pas encore « oppose ») : 0 envoi", async () => {
    await Opp.enregistrerOpposition(A, "zernio-conversation", { env: ENV });
    expect((await etatDe()).etat).toBe("attente_email");
    confirmer(ref(1));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect((await lireJournal())[ref(1)].issue).toBe("oppose");
  });
});

describe("5 · hors fenêtre de 24 h : rien n'est envoyé, l'accusé le dit", () => {
  it("personne qui n'a jamais écrit : hors_fenetre", async () => {
    await poserPersonne({ ageMs: null });
    confirmer(ref(1));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "non_envoye", issue: "hors_fenetre", accuse: true });
    expect(site.issues()).toEqual([{ ref: ref(1), issue: "hors_fenetre" }]);
  });
  it("dernier message de 23 h 01 : hors_fenetre ; de 22 h 59 : envoyé", async () => {
    await poserPersonne({ ageMs: 23 * H + 60_000 });
    confirmer(ref(1));
    await passer(T0);
    expect((await lireJournal())[ref(1)].issue).toBe("hors_fenetre");
    await poserPersonne({ auteur: B, refs: [ref(2)], ageMs: 22 * H + 59 * 60_000, idConversation: ID_CONV_ZERNIO_B });
    confirmer(ref(2));
    await passer(T0 + 1000);
    expect((await lireJournal())[ref(2)].issue).toBe("envoye");
  });
  it("date du dernier message dans le futur : fenêtre fermée", async () => {
    await poserPersonne({ ageMs: -3 * H });
    confirmer(ref(1));
    await passer(T0);
    expect((await lireJournal())[ref(1)].issue).toBe("hors_fenetre");
  });
});

describe("6 · conversation inconnue / confirmation illisible", () => {
  it("ref qu'aucune conversation ne porte : conversation_inconnue, 0 envoi, accusé", async () => {
    confirmer(ref(99));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect((await lireJournal())[ref(99)]).toMatchObject({ issue: "conversation_inconnue", accuse: true });
  });
  it("ref de forme illisible : journalisée sans la valeur, pas d'accusé, pas d'entrée au registre", async () => {
    site.file = [{ ref: "pas une ref !", valideLe: "x" }];
    await passer(T0);
    expect(site.accuses).toHaveLength(0);
    expect(Object.keys(await lireJournal())).toHaveLength(0);
    expect((await depots().evenements.lister((e: any) => /confirmation_illisible/.test(e.message))).length).toBe(1);
    expect(JSON.stringify(await depots().evenements.lister(() => true))).not.toContain("pas une ref");
  });
});

describe("7 · texte non validé", () => {
  it("0 envoi, accusé sans envoi, alerte cloche 1/h", async () => {
    await Com.ecrireParametre(PARAM_VALIDATION, null);
    confirmer(ref(1));
    await passer(T0);
    await passer(T0 + 60_000);
    expect(merciEnvoyes()).toHaveLength(0);
    expect((await lireJournal())[ref(1)].issue).toBe("texte_non_valide");
    const n = (await notifs()).filter((x) => /merci.*pas validé/i.test(x.message));
    expect(n).toHaveLength(1);
    expect(n[0].envoi).toBeUndefined();
  });
  it("empreinte d'un autre texte : refusé", async () => {
    await Com.ecrireParametre(PARAM_VALIDATION, { empreinte: createHash("sha256").update(TEXTES_MP["mp-merci-v1"].texte).digest("hex") }); // sans la version
    confirmer(ref(1));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(0);
  });
});

describe("8 · garde bloquée (« Tout arrêter »)", () => {
  it("0 envoi, 0 accusé, la ref n'entre pas au registre ; le site re-proposera", async () => {
    await Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, false);
    confirmer(ref(1));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect(site.accuses).toHaveLength(0);
    expect(await lireJournal()).toEqual({});
    await Com.ecrireParametre(Z.PARAM_ARRET_ZERNIO, true);
    await passer(T0 + 11 * 60_000);
    expect(merciEnvoyes()).toHaveLength(1);
  });
});

describe("9 · plafond d'envois atteint", () => {
  it("0 envoi, 0 accusé, ref absente du registre ; à l'heure suivante : envoyé", async () => {
    await Com.ecrireParametre("parcours.conversations.plafonds", { heureCompte: 1 });
    await Com.ecrireParametre("parcours.conversations.compteurs", { [COMPTE]: { heure: Math.floor(T0 / H) * H, envois: 5 } });
    confirmer(ref(1));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect(site.accuses).toHaveLength(0);
    expect(await lireJournal()).toEqual({});
    await passer(T0 + H + 5000);
    expect(merciEnvoyes()).toHaveLength(1);
  });
});

describe("10 · plantage et issue inconnue : jamais de second merci", () => {
  it("entrée « en_vol » non portée par ce processus + redémarrage : a_verifier, 0 envoi, accusé", async () => {
    await Com.ecrireParametre(PARAM_JOURNAL, { [ref(1)]: { cle: cleConversation(A), etat: "en_vol", issue: "en_vol", accuse: false, le: new Date(T0 - 60_000).toISOString(), essaisAccuse: 0, prochainAccuseLe: null } });
    const conv = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
    conv[cleConversation(A)].merciEtat = "en_vol";
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, conv);
    C.reinitialiserParcoursConversation();
    confirmer(ref(1));
    await passer(T0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "a_verifier", accuse: true });
    expect(await etatDe()).toMatchObject({ merciEtat: "a_verifier" });
    expect(site.issues()).toEqual([{ ref: ref(1), issue: "envoye" }]); // ne jamais le repropose
    expect((await notifs()).filter((x) => /issue inconnue/.test(x.message))).toHaveLength(1);
  });
  it("Zernio répond 502 : a_verifier, jamais renvoyé au passage suivant", async () => {
    confirmer(ref(1));
    const p = portReel(() => ({ statut: 502, corps: { error: "bad gateway" } }));
    await passer(T0, ENV_MERCI, p.port);
    expect((await lireJournal())[ref(1)].etat).toBe("a_verifier");
    confirmer(ref(1));
    await passer(T0 + 11 * 60_000, ENV_MERCI, p.port);
    expect(posts(p)).toHaveLength(1);
  });
  it("refus définitif de Zernio (4xx) : non_envoye avec le code, pas de nouvel essai (D4)", async () => {
    confirmer(ref(1));
    const p = portReel(() => ({ statut: 400, corps: { error: "refus" } }));
    await passer(T0, ENV_MERCI, p.port);
    expect((await lireJournal())[ref(1)].etat).toBe("non_envoye");
    await passer(T0 + 11 * 60_000, ENV_MERCI, p.port);
    expect(posts(p)).toHaveLength(1);
  });
});

describe("12 · accusé en panne", () => {
  it("merci envoyé UNE fois, accusé réessayé (1, 5, 15, 60 min puis 6 h) jusqu'au succès, 0 second merci", async () => {
    site.statutAccuse = 503;
    confirmer(ref(1));
    await passer(T0);
    expect((await lireJournal())[ref(1)]).toMatchObject({ etat: "envoye", accuse: false, essaisAccuse: 1 });
    expect((await lireJournal())[ref(1)].prochainAccuseLe).toBe(T0 + 60_000);
    site.file = [];
    await passer(T0 + 30_000); // pas encore l'heure
    expect(site.accuses).toHaveLength(1);
    await passer(T0 + 61_000);
    expect(site.accuses).toHaveLength(2);
    expect((await lireJournal())[ref(1)].prochainAccuseLe).toBe(T0 + 61_000 + 5 * 60_000);
    site.statutAccuse = 200;
    await passer(T0 + 61_000 + 5 * 60_000 + 1);
    expect((await lireJournal())[ref(1)].accuse).toBe(true);
    await passer(T0 + 24 * H);
    expect(site.accuses).toHaveLength(3);
    expect(merciEnvoyes()).toHaveLength(1);
  });
  it("les paliers plafonnent à 6 h, sans fin", async () => {
    await Com.ecrireParametre(PARAM_JOURNAL, { [ref(1)]: { cle: cleConversation(A), etat: "envoye", issue: "envoye", accuse: false, le: new Date(T0).toISOString(), essaisAccuse: 9, prochainAccuseLe: T0 } });
    site.statutAccuse = 503;
    await passer(T0 + 1);
    expect((await lireJournal())[ref(1)].prochainAccuseLe).toBe(T0 + 1 + 6 * H);
  });
  it("le 409 du site vaut succès", async () => {
    site.statutAccuse = 409;
    confirmer(ref(1));
    await passer(T0);
    expect((await lireJournal())[ref(1)].accuse).toBe(true);
  });
});

describe("13 · site de lecture en panne", () => {
  it("0 envoi, alerte cloche 1/h, rien au registre", async () => {
    site.statutLecture = 503;
    confirmer(ref(1));
    await passer(T0);
    await passer(T0 + 60_000);
    expect(merciEnvoyes()).toHaveLength(0);
    expect(await lireJournal()).toEqual({});
    const n = (await notifs()).filter((x) => /site/i.test(x.message) && /merci/i.test(x.message));
    expect(n).toHaveLength(1);
    expect(n[0].envoi).toBeUndefined();
  });
  it("site non relié (secret absent) : aucun appel, alerte", async () => {
    await passer(T0, { ...ENV_MERCI, SITE_GUIDES_RESEAU_SECRET: undefined });
    expect(site.lectures).toHaveLength(0);
    expect((await notifs()).filter((x) => /merci/i.test(x.message))).toHaveLength(1);
  });
});

describe("14 · interrupteur éteint = aucune lecture, aucun envoi ; un accusé en retard part quand même", () => {
  it("absent ou « 0 » : 0 lecture, 0 envoi, rien d'écrit", async () => {
    confirmer(ref(1));
    await passer(T0, ENV);
    await passer(T0, { ...ENV, PARCOURS_MERCI_ENABLED: "0" });
    expect(site.lectures).toHaveLength(0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect(await lireJournal()).toEqual({});
  });
  it("n'agit pas si PARCOURS_CONVERSATION_ENABLED est éteint", async () => {
    confirmer(ref(1));
    await passer(T0, { ...ENV_MERCI, PARCOURS_CONVERSATION_ENABLED: undefined });
    expect(site.lectures).toHaveLength(0);
  });
  it("accusé en retard dû : il part, sans lecture ni envoi", async () => {
    await Com.ecrireParametre(PARAM_JOURNAL, { [ref(1)]: { cle: cleConversation(A), etat: "envoye", issue: "envoye", accuse: false, le: new Date(T0 - H).toISOString(), essaisAccuse: 1, prochainAccuseLe: T0 - 1 } });
    await passer(T0, ENV);
    expect(site.lectures).toHaveLength(0);
    expect(site.issues()).toEqual([{ ref: ref(1), issue: "envoye" }]);
    expect(merciEnvoyes()).toHaveLength(0);
  });
});

describe("15 · rien en clair", () => {
  it("registre, journaux, notifications, console : ni identifiant de conversation Zernio, ni adresse, ni jeton, ni texte", async () => {
    await poserPersonne({ auteur: B, refs: [ref(2)], ageMs: null });
    site.statutAccuse = 503;
    confirmer(ref(1), ref(2));
    await passer(T0);
    await Com.ecrireParametre(PARAM_VALIDATION, null);
    await poserPersonne({ auteur: "auteur-fictif-402", refs: [ref(4)] });
    confirmer(ref(4));
    await passer(T0 + 2 * H);
    const tout = JSON.stringify([await lireJournal(), await depots().evenements.lister(() => true), await notifs(), (console.log as any).mock.calls, (console.error as any).mock.calls, (console.warn as any).mock.calls]);
    for (const interdit of [ID_CONV_ZERNIO, ID_CONV_ZERNIO_B, ADRESSE_FICTIVE, SECRET_SITE, "eyJ", texteMerci(), "msg-dernier"]) expect(tout, interdit).not.toContain(interdit);
    const etat = JSON.stringify(await etatDe());
    expect(etat).not.toContain(ID_CONV_ZERNIO);
  });
});

describe("16 · M1 v3 garde l'empreinte du jeton envoyé (le rapprochement avec la confirmation du site)", () => {
  it("l'empreinte SHA-256 du jeton réellement envoyé est au registre ; jamais le jeton ni le lien", async () => {
    const { deposerCommentaire } = await import("./aides/conversation");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {});
    await validerFormulationsAuParcours(["mp-m1-v4-1"]);
    const envLien = { ...ENV_MERCI, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: "secret-fictif-lien-page-guide-0123456789-abcdef", LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
    await deposerCommentaire(depots, {});
    await C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: envLien, maintenantMs: T0 });
    expect(port.prive).toHaveLength(1);
    const j = (port.prive[0].texte.match(/https:\/\/\S+/)![0].replace(/\.$/, "")).split("?j=")[1];
    const e = await etatDe();
    expect(e.empreintesLien).toEqual([createHash("sha256").update(j).digest("hex")]);
    expect(JSON.stringify(await Com.lireParametre(C.PARAM_CONVERSATIONS, {}))).not.toContain(j);
  });
});
