/**
 * Fiche « formulations multiples » (lot A) : plusieurs formulations validées une à une par l'opérateur pour le 1er message avec lien
 * et pour « adresse refusée » ; une conversation garde TOUJOURS la même ; lien en dernier mot ; aucune mention d'automatisme en
 * ouverture, aucune signature ; une formulation non validée ou retirée ne part jamais ; un « stop » l'emporte toujours.
 * Données 100 % fictives ; port et site FAUX ; le VRAI constructeur de corps d'envoi sert à chaque texte envoyé.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GROUPES_MP, TEXTES_MP, rendreTexteMp, textesActifs } from "@/domaine/guide-reseau/textes-mp";
import { choisirFormulation, rangFormulation } from "@/domaine/guide-reseau/formulations";
import { construireLienGuide, creerJetonLien, refConversationLien } from "@/domaine/guide-reseau/lien-guide";
import { creerPortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { creerFauxClientZernio } from "./aides/faux-zernio";
import { ADRESSE_FICTIVE, COMPTE, ENV, SECRET_EMPREINTE, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => {
  const r = await orig<Record<string, unknown>>();
  const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
  return { ...r, siteAccepteVersionM1: (v: string) => VERSIONS_SITE_TEST.has(v) };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Opp = await import("@/services/oppositions-mots");

const J = (...p: string[]) => p.join("");
const SECRET_LIEN = "secret-fictif-lien-page-guide-0123456789-abcdef";
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const A = "auteur-fictif-400";

/** Copies LITTÉRALES des phrases validées (jamais relues du dictionnaire) : 4 « message avec lien », 3 « adresse refusée ». */
const M1_VALIDES = [
  "Bonjour ! Merci pour votre commentaire, ça fait plaisir. Comme promis, voici votre guide « [TITRE DU GUIDE] ». Le lien reste ouvert 48 heures : [LIEN]",
  "Bonjour, et merci d'avoir commenté « [MOT] » ! Votre guide « [TITRE DU GUIDE] » est prêt. Vous avez 48 heures pour le récupérer ici : [LIEN]",
  "Merci pour votre message ! Je vous envoie le guide « [TITRE DU GUIDE] » comme convenu. Il vous attend pendant 48 heures à cette adresse : [LIEN]",
  "Bonjour ! Vous avez demandé le guide « [TITRE DU GUIDE] » : le voici. Bonne lecture, et merci pour votre intérêt. Lien valable 48 heures : [LIEN]",
] as const;
const AR_VALIDES = [
  "Désolé, je n'ai pas réussi à enregistrer cette adresse e-mail. Je ne peux donc pas vous envoyer le guide par ce moyen.",
  "Mince, cette adresse e-mail n'a pas pu être enregistrée de notre côté. Le guide ne peut pas vous être envoyé de cette façon, toutes mes excuses.",
  "Je suis navré, cette adresse e-mail n'a pas été acceptée par notre système. Il ne m'est pas possible de vous faire parvenir le guide par ce moyen.",
] as const;
const V_M1 = ["mp-m1-v4-1", "mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4"] as const;
const V_AR = ["mp-adresse-refusee-v3-1", "mp-adresse-refusee-v3-2", "mp-adresse-refusee-v3-3"] as const;
const TOUTES = [...V_M1, ...V_AR] as const;
const brut = (id: string) => (TEXTES_MP as Record<string, { version: string; texte: string }>)[id];
const empreinte = (id: string) => createHash("sha256").update(`${brut(id).version}\n${brut(id).texte}`).digest("hex");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0, env: Record<string, string | undefined> = ENV_LIEN, p = port.port) => C.traiterConversations({ port: p, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const etatDe = async (auteur = A) => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(auteur)];
const refuse = () => ({ statut: 422, corps: { erreur: "invalide" } });
const cloches = async (re: RegExp) => (await depots().notifications.lister((n: any) => re.test(n.message))).length;
const lienSigne = (version: string) =>
  construireLienGuide(creerJetonLien({ conv: refConversationLien(SECRET_EMPREINTE, "cle-fictive-0123456789"), mot: "GUIDE", reseau: "instagram", guide: "guide-ia", compte: "page_principale", version_m1: version }, SECRET_LIEN, T0))!;
const rendreM1 = (version: string, lien: string) => rendreTexteMp(version as never, { mot: "GUIDE", titre: TITRE, lien })!;

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

describe("1 · dictionnaire", () => {
  it("les 7 textes sont égaux, à l'octet, aux phrases validées", () => {
    V_M1.forEach((v, n) => expect(brut(v).texte).toBe(M1_VALIDES[n]));
    V_AR.forEach((v, n) => expect(brut(v).texte).toBe(AR_VALIDES[n]));
    for (const v of TOUTES) expect(brut(v).version).toBe(v);
  });
  it("aucun texte actif privé NOUVEAU ne commence par « Message automatique », aucune signature, aucun stop / accord / tutoiement / ville / gain", () => {
    for (const v of TOUTES) {
      const t = brut(v).texte;
      expect(t, v).not.toMatch(/^Message automatique/i);
      expect(t, v).not.toMatch(/Axion IA\s*[.!]?\s*$/);
      expect(t, v).not.toMatch(/\bstop\b|voulez-vous|souhaitez-vous|autres informations|\b(tu|ton|ta|tes|toi)\b/i);
      expect(t.toLowerCase(), v).not.toContain(J("aucun gain ", "garanti").toLowerCase());
      expect(t.toLowerCase(), v).not.toContain(J("gren", "oble"));
    }
  });
  it("groupes : versions existantes et actives, ordre fixe ; la mention d'ouverture n'existe plus", () => {
    expect(GROUPES_MP["m1-lien"]).toEqual([...V_M1]);
    expect(GROUPES_MP["adresse-refusee"]).toEqual([...V_AR]);
    for (const g of Object.values(GROUPES_MP)) for (const v of g) expect(brut(v) && (brut(v) as { statut?: string }).statut, v).toBe("actif");
    const d = JSON.parse(readFileSync(new URL("../../contrats/dictionnaire-textes-mp.v2.json", import.meta.url), "utf8"));
    expect(d.version).toBe(4); // série 5 : 13 formulations ajoutées (version 3 → 4)
    expect(d).not.toHaveProperty("mention_ouverture");
  });
  it("aucune entrée supprimée : les anciens textes restent, marqués « retire »", () => {
    for (const v of ["mp-m1-v3", "mp-adresse-refusee-v2", "mp-m1-v2-a", "mp-m1-v2-e"]) expect((brut(v) as { statut?: string }).statut, v).toBe("retire");
    for (const v of ["mp-m1-v2", "mp-m2-v1", "mp-recu-v2", "mp-merci-v1", "mp-pub-igfb-v1"]) expect((brut(v) as { statut?: string }).statut, v).toBe("actif");
    expect(Object.keys(textesActifs())).not.toContain("mp-m1-v3");
    expect(Object.keys(textesActifs())).toContain("mp-m1-v4-1");
  });
});

describe("1 ter · messages encore en service qui commencent par la mention (remplacés dans un autre lot)", () => {
  it("ils restent actifs et partent tels quels : le dictionnaire les accepte, ils ne passent pas par le contrôle de sortie des mots", async () => {
    const { texteDuDictionnaire } = await import("@/fournisseurs/publication/zernio-inbox-corps");
    for (const v of ["mp-m1-v2", "mp-recu-v2", "mp-m2-v1", "mp-lien-v2"]) {
      const t = brut(v).texte;
      expect(t, v).toMatch(/^Message automatique/);
      expect((brut(v) as { statut?: string }).statut, v).toBe("actif");
      const rendu = t.replace("[MOT]", "GUIDE").replace("[TITRE DU GUIDE]", TITRE).replace("[LIEN]", "https://exemple.test/g");
      expect(texteDuDictionnaire(rendu, false), v).toBe(true);
    }
  });
});

describe("1 bis · liste des versions acceptées par le site (un seul fichier côté Studio, comparé à une copie des versions du jeton connues du site)", () => {
  it("chaque formulation du groupe « m1-lien » est classée dans le fichier : acceptée OU en attente du site, jamais les deux, jamais oubliée", async () => {
    const F = await import("@/domaine/guide-reseau/versions-acceptees-site");
    const acceptees = F.VERSIONS_M1_ACCEPTEES_PAR_LE_SITE;
    const attente = F.VERSIONS_M1_EN_ATTENTE_DU_SITE;
    for (const v of GROUPES_MP["m1-lien"]) expect(acceptees.includes(v) !== attente.includes(v), `${v} : dans une seule des deux listes`).toBe(true);
    for (const v of [...acceptees, ...attente]) expect(v).toMatch(/^[A-Za-z0-9._-]{1,32}$/); // forme exigée pour `version_m1` du jeton
  });
  it("NON CIRCULAIRE : toute version acceptée par le Studio est dans la copie des `version_m1` du jeton connus du site (aides/versions-m1-jeton-site.ts) ; « adresse refusée » n'y est jamais", async () => {
    const F = await import("@/domaine/guide-reseau/versions-acceptees-site");
    const { VERSIONS_M1_JETON_SITE: VERSIONS_TEXTE_CONNUES_SITE } = await import("./aides/versions-m1-jeton-site");
    for (const v of F.VERSIONS_M1_ACCEPTEES_PAR_LE_SITE) expect(VERSIONS_TEXTE_CONNUES_SITE as readonly string[], v).toContain(v);
    for (const v of V_AR) expect(F.VERSIONS_M1_ACCEPTEES_PAR_LE_SITE).not.toContain(v);
    // aujourd'hui les 4 nouvelles ne sont PAS connues du site : elles sont en attente (ce test rougit si on les passe en « acceptées » sans le site)
    // QUAND LE SITE CONNAÎTRA LES v4 : les ajouter à aides/versions-m1-jeton-site.ts ET retirer la ligne ci-dessous (ou la faire porter sur VERSIONS_M1_EN_ATTENTE_DU_SITE), sinon ce test reste rouge.
    for (const v of V_M1) expect(VERSIONS_TEXTE_CONNUES_SITE as readonly string[]).not.toContain(v);
  });
  it("faux site sans aucune version connue : aucune v4 n'est acceptée, le message part SANS lien avec une alerte cloche, et l'état garde la formulation choisie", async () => {
    const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
    const avant = [...VERSIONS_SITE_TEST];
    VERSIONS_SITE_TEST.clear();
    try {
      await validerFormulationsAuParcours();
      await deposerCommentaire(depots, {});
      await passer();
      expect(port.prive).toHaveLength(1);
      expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
      expect(port.prive[0].texte).not.toContain("https://");
      expect(await cloches(/sans lien \(le site ne connaît pas encore cette formulation\)/)).toBe(1);
      const e = await etatDe();
      expect(e.versionTexteM1).toBe("mp-m1-v2");
      expect(e.formulations["m1-lien"]).toBe("mp-m1-v4-1");
    } finally {
      for (const v of avant) VERSIONS_SITE_TEST.add(v);
    }
  });
});

describe("2 · lien en dernier mot", () => {
  it("chaque formulation avec [LIEN] finit par [LIEN], une seule fois ; rendue avec un lien signé elle finit par le jeton", () => {
    const jeton = creerJetonLien({ conv: refConversationLien(SECRET_EMPREINTE, "cle-fictive-0123456789"), mot: "GUIDE", reseau: "instagram", guide: "guide-ia", compte: "page_principale", version_m1: "mp-m1-v4-1" }, SECRET_LIEN, T0);
    const lien = `https://axion-ia.com/guide-reseau?j=${jeton}`;
    for (const v of V_M1) {
      const t = brut(v).texte;
      expect(t.endsWith("[LIEN]"), v).toBe(true);
      expect(t.split("[LIEN]").length - 1, v).toBe(1);
      expect(rendreM1(v, lien).endsWith(jeton), v).toBe(true);
    }
  });
});

describe("3 · 1 000 caractères", () => {
  it("pire cas de chaque formulation (mot 30, titre 200, lien 512) ≤ 1 000", () => {
    for (const v of V_M1) expect(rendreTexteMp(v, { mot: "a".repeat(30), titre: "b".repeat(200), lien: `https://${"c".repeat(512)}` })!.length, v).toBeLessThanOrEqual(1000);
    for (const v of V_AR) expect(brut(v).texte.length, v).toBeLessThanOrEqual(1000);
  });
  it("la borne d'un texte privé est 1 000 (une réponse publique garde 2 000) : preuve avec un dictionnaire d'essai", async () => {
    vi.resetModules();
    vi.doMock("@/domaine/guide-reseau/textes-mp", () => ({
      textesActifs: () => ({
        "mp-essai-prive": { version: "mp-essai-prive", statut: "actif", texte: `${"a".repeat(850)}[TITRE DU GUIDE]` },
        "mp-pub-essai": { version: "mp-pub-essai", statut: "actif", texte: `${"b".repeat(1700)}[TITRE DU GUIDE]` },
      }),
    }));
    const corps = await import("@/fournisseurs/publication/zernio-inbox-corps");
    expect(corps.texteDuDictionnaire(`${"a".repeat(850)}${"t".repeat(150)}`, false)).toBe(true); // 1 000 pile
    expect(corps.texteDuDictionnaire(`${"a".repeat(850)}${"t".repeat(151)}`, false)).toBe(false); // 1 001
    expect(corps.texteDuDictionnaire(`${"b".repeat(1700)}${"t".repeat(200)}`, true)).toBe(true); // 1 900 en public
    vi.doUnmock("@/domaine/guide-reseau/textes-mp");
    vi.resetModules();
  });
  it("le constructeur d'envoi (POST réel) refuse un texte privé hors dictionnaire sans appel réseau", async () => {
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: {} }));
    const reel = creerPortInboxZernio({ client, comptesPermis: [COMPTE], titresGuidesPermis: [TITRE] });
    expect((await reel.envoyerMessage({ idCompte: COMPTE, idConversation: "c1", texte: "x".repeat(1001), cle: "k" })).statut).toBe("refuse");
    expect(faux.appels).toHaveLength(0);
  });
});

describe("4 · déterminisme", () => {
  const validees = new Set<string>(V_M1);
  const choix = (cle: string, figee?: string) => choisirFormulation({ groupe: "m1-lien", cleConversation: cle, figee, validees, rendre: (v) => rendreTexteMp(v as never, { mot: "GUIDE", titre: TITRE, lien: "https://exemple.test/x" }) });
  it("même clé, 100 appels : même version ; réimport du module : même version", async () => {
    const un = choix("cle-conversation-fictive-1")!.version;
    for (let i = 0; i < 100; i++) expect(choix("cle-conversation-fictive-1")!.version).toBe(un);
    vi.resetModules();
    const F2 = await import("@/domaine/guide-reseau/formulations");
    expect(F2.rangFormulation("m1-lien", "cle-conversation-fictive-1", 4)).toBe(rangFormulation("m1-lien", "cle-conversation-fictive-1", 4));
  });
  it("400 clés fictives : chacune des 4 formulations reçoit entre 15 % et 35 %", () => {
    const n: Record<string, number> = {};
    for (let i = 0; i < 400; i++) { const v = choix(`cle-fictive-${i}`)!.version; n[v] = (n[v] ?? 0) + 1; }
    expect(Object.keys(n).sort()).toEqual([...V_M1]);
    for (const v of V_M1) { expect(n[v] / 400, v).toBeGreaterThanOrEqual(0.15); expect(n[v] / 400, v).toBeLessThanOrEqual(0.35); }
  });
  it("figée et valide : elle gagne ; figée hors groupe, retirée ou non validée : une autre ; aucune validée : null", () => {
    expect(choix("cle-fictive-9", "mp-m1-v4-3")!.version).toBe("mp-m1-v4-3");
    expect(choix("cle-fictive-9", "mp-m1-v3")!.version).toBe("mp-m1-v4-1"); // texte identique à l'octet : la conversation garde son texte
    expect(choisirFormulation({ groupe: "m1-lien", cleConversation: "k", figee: "mp-m1-v4-3", validees: new Set(["mp-m1-v4-1"]), rendre: () => "x" })!.version).toBe("mp-m1-v4-1");
    expect(choisirFormulation({ groupe: "m1-lien", cleConversation: "k", validees: new Set(), rendre: () => "x" })).toBeNull();
    expect(choisirFormulation({ groupe: "m1-lien", cleConversation: "k", validees: new Set(V_M1), rendre: () => null })).toBeNull();
  });
});

describe("5 · formulation figée dans l'état, M1 avec lien", () => {
  it("M1 envoyé : versionTexteM1 = la version choisie, = version_m1 du jeton, = texte envoyé ; formulation seule validée (repli dans le groupe)", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-3"]);
    await deposerCommentaire(depots, {});
    await passer();
    const e = await etatDe();
    expect(e.versionTexteM1).toBe("mp-m1-v4-3");
    expect(port.prive).toHaveLength(1);
    const lien = port.prive[0].texte.slice(port.prive[0].texte.indexOf("https://"));
    const charge = JSON.parse(Buffer.from(lien.split("?j=")[1].split(".")[0], "base64url").toString("utf8"));
    expect(charge.version_m1).toBe("mp-m1-v4-3");
    expect(port.prive[0].texte).toBe(rendreM1("mp-m1-v4-3", lien));
    expect(JSON.stringify(e)).not.toContain("guide-reseau?j=");
  });
  it("le vrai constructeur d'envoi accepte chaque M1 v4 validé (POST réel) et refuse les textes retirés", async () => {
    for (const v of V_M1) {
      const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: { messageId: "m" } }));
      const reel = creerPortInboxZernio({ client, comptesPermis: [COMPTE], titresGuidesPermis: [TITRE] });
      const lien = lienSigne(v);
      const res = await reel.envoyerMessage({ idCompte: COMPTE, idConversation: "conv-1", texte: rendreM1(v, lien), cle: `k-${v}` });
      expect(res.statut, v).toBe("envoye");
      expect(faux.appels.filter((a) => a.methode === "POST"), v).toHaveLength(1);
    }
    for (const v of ["mp-adresse-refusee-v2", "mp-m1-v2-a"]) {
      const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: {} }));
      const reel = creerPortInboxZernio({ client, comptesPermis: [COMPTE], titresGuidesPermis: [TITRE] });
      const res = await reel.envoyerMessage({ idCompte: COMPTE, idConversation: "conv-1", texte: rendreTexteMp(v as never, { mot: "GUIDE", titre: TITRE, lien: lienSigne("mp-m1-v4-1") })!, cle: "k" });
      expect(res.statut, v).toBe("refuse");
      expect(faux.appels, v).toHaveLength(0);
    }
  });
});

describe("6 · adresse refusée : figée AVANT le POST, rejeu identique, un seul message", () => {
  async function ecrireAdresse(idMessage: string, ms = T0 + 1000) {
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage });
    await passer(ms);
  }
  beforeEach(async () => {
    await deposerCommentaire(depots, {});
    await passer();
  });
  it("le texte envoyé est une formulation validée, écrite dans l'état avant l'envoi", async () => {
    await validerFormulationsAuParcours(["mp-adresse-refusee-v3-2"]);
    site.reponses = refuse;
    let vuAvant: unknown;
    const envoyer = port.port.envoyerMessage;
    port.port.envoyerMessage = async (p) => ((vuAvant = (await etatDe())?.formulations), envoyer(p));
    await ecrireAdresse("msg-1");
    expect(vuAvant).toEqual({ "adresse-refusee": "mp-adresse-refusee-v3-2" });
    expect(port.envoyes).toHaveLength(1);
    expect(port.envoyes[0].texte).toBe(AR_VALIDES[1]);
    expect(await etatDe()).toMatchObject({ adresseRefuseeEnvoyee: true, formulations: { "adresse-refusee": "mp-adresse-refusee-v3-2" } });
  });
  it("un 2e événement après « adresse refusée » : aucun 2e envoi ; le même 422 deux fois : un seul message", async () => {
    await validerFormulationsAuParcours(["mp-adresse-refusee-v3-1", "mp-adresse-refusee-v3-3"]);
    site.reponses = refuse;
    await ecrireAdresse("msg-a");
    await ecrireAdresse("msg-b", T0 + 2000);
    expect(port.envoyes).toHaveLength(1);
  });
  it("aucune formulation validée : 0 envoi, 1 cloche (dédupliquée), adresseRefuseeEnvoyee reste faux ; valider plus tard ne fait rien repartir", async () => {
    await validerFormulationsAuParcours([]);
    site.reponses = refuse;
    await ecrireAdresse("msg-c");
    expect(port.envoyes).toHaveLength(0);
    expect(await cloches(/Aucune formulation « adresse refusée » n.est validée dans Mots/)).toBe(1);
    expect((await etatDe()).adresseRefuseeEnvoyee).not.toBe(true);
    await validerFormulationsAuParcours(["mp-adresse-refusee-v3-1"]);
    await passer(T0 + 5000);
    expect(port.envoyes).toHaveLength(0);
  });
  it("le vrai constructeur d'envoi accepte chaque formulation validée", async () => {
    for (const v of V_AR) {
      const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: { messageId: "m" } }));
      const reel = creerPortInboxZernio({ client, comptesPermis: [COMPTE] });
      expect((await reel.envoyerMessage({ idCompte: COMPTE, idConversation: "conv-1", texte: brut(v).texte, cle: v })).statut, v).toBe("envoye");
      expect(faux.appels.filter((a) => a.methode === "POST"), v).toHaveLength(1);
    }
  });
});

describe("7 · formulation non validée = jamais envoyée (M1)", () => {
  it("(b) la version figée perd sa validation avant un nouvel essai : une AUTRE validée part, jamais la non validée ; journal en code seul", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", "mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4"]);
    await deposerCommentaire(depots, {});
    port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" }) as never;
    await passer();
    const figee = (await etatDe()).versionTexteM1;
    expect(V_M1).toContain(figee);
    const sans = V_M1.filter((v) => v !== figee);
    await validerFormulationsAuParcours(sans);
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" }) as never;
    await passer(T0 + 3_600_000);
    const derniers = port.prive.map((p) => p.texte);
    const dernier = derniers[derniers.length - 1];
    expect(dernier).not.toContain(brut(figee).texte.slice(0, 40)); // ce n'est pas le texte de la formulation devenue non validée
    expect(dernier).toBe(rendreM1((await etatDe()).versionTexteM1, dernier.slice(dernier.indexOf("https://")))); // c'est exactement le texte de la formulation notée dans l'état
    expect(sans).toContain((await etatDe()).versionTexteM1);
    expect((await depots().evenements.lister((x: any) => /formulation_figee_non_validee/.test(x.message))).length).toBeGreaterThan(0);
  });
  it("(g) renvoi sans changement de validation : le MÊME texte, à l'octet (hors jeton du lien), même formulation", async () => {
    await validerFormulationsAuParcours([...V_M1]);
    await deposerCommentaire(depots, {});
    port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" }) as never;
    await passer();
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" }) as never;
    await passer(T0 + 3_600_000);
    expect(port.prive).toHaveLength(2);
    const [t1, t2] = port.prive.map((p) => p.texte);
    const sansLien = (t: string) => t.slice(0, t.indexOf("https://"));
    expect(Buffer.from(sansLien(t2), "utf8").equals(Buffer.from(sansLien(t1), "utf8"))).toBe(true);
    const v = (await etatDe()).versionTexteM1;
    expect(t1).toBe(rendreM1(v, t1.slice(t1.indexOf("https://"))));
    expect(t2).toBe(rendreM1(v, t2.slice(t2.indexOf("https://"))));
  });
  it("(h) conversation figée sur mp-m1-v3 (retiré) : elle garde ce texte (= mp-m1-v4-1, identique à l'octet) ; v4-1 non validée : sans lien avec un journal, JAMAIS une autre v4", async () => {
    for (const validees of [[...V_M1], ["mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4"]]) {
      reinitialiserDepots();
      C.reinitialiserParcoursConversation();
      port = fauxPort();
      await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
      await validerGuideAuParcours();
      await validerFormulationsAuParcours(validees);
      await deposerCommentaire(depots, {});
      port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" }) as never;
      await passer();
      const tout = await Com.lireParametre<Record<string, Record<string, unknown>>>(C.PARAM_CONVERSATIONS, {});
      const cle = cleConversation(A);
      tout[cle] = { ...tout[cle], versionTexteM1: "mp-m1-v3", formulations: undefined };
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
      port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" }) as never;
      const avant = port.prive.length;
      await passer(T0 + 3_600_000);
      const t = port.prive[port.prive.length - 1].texte;
      expect(port.prive.length).toBe(avant + 1);
      if (validees.includes("mp-m1-v4-1")) {
        expect(t).toBe(rendreM1("mp-m1-v4-1", t.slice(t.indexOf("https://"))));
      } else {
        expect(t).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
        for (const v of ["mp-m1-v4-2", "mp-m1-v4-3", "mp-m1-v4-4"]) expect(t).not.toContain(brut(v).texte.slice(0, 30));
        expect((await depots().evenements.lister((x: { message: string }) => /formulation_figee_retiree_refusee/.test(x.message))).length).toBeGreaterThan(0);
      }
    }
  });
  it("(h bis) figée sur mp-m1-v3 : le site connaît mp-m1-v3 (pas v4-1) → le message part AVEC lien, jeton version_m1 = mp-m1-v3, texte de v4-1", async () => {
    const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
    const avant = [...VERSIONS_SITE_TEST];
    VERSIONS_SITE_TEST.clear();
    VERSIONS_SITE_TEST.add("mp-m1-v3");
    try {
      await validerFormulationsAuParcours([...V_M1]);
      await deposerCommentaire(depots, {});
      port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" }) as never;
      await passer();
      const tout = await Com.lireParametre<Record<string, Record<string, unknown>>>(C.PARAM_CONVERSATIONS, {});
      const cle = cleConversation(A);
      tout[cle] = { ...tout[cle], versionTexteM1: "mp-m1-v3", formulations: undefined };
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
      // 2e passage : « a_reessayer » ; l'état écrit AVANT l'envoi garde l'identifiant du jeton (mp-m1-v3), pas mp-m1-v4-1.
      await passer(T0 + 3_600_000);
      const milieu = await etatDe();
      expect(milieu.versionTexteM1).toBe("mp-m1-v3");
      expect(milieu.formulations["m1-lien"]).toBe("mp-m1-v3");
      // 3e passage : « envoye » ; le nouvel essai repart AVEC lien, même identifiant de version, même texte.
      port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" }) as never;
      await passer(T0 + 7_200_000);
    } finally {
      VERSIONS_SITE_TEST.clear();
      for (const v of avant) VERSIONS_SITE_TEST.add(v);
    }
    const t = port.prive[port.prive.length - 1].texte;
    expect(port.prive.length).toBe(3);
    const lien = t.slice(t.indexOf("https://"));
    expect(lien).toContain("https://");
    expect(t).toBe(rendreM1("mp-m1-v4-1", lien));
    const charge = JSON.parse(Buffer.from(lien.split("?j=")[1].split(".")[0], "base64url").toString("utf8"));
    expect(charge.version_m1).toBe("mp-m1-v3");
    expect((await etatDe()).versionTexteM1).toBe("mp-m1-v3");
  });
  it("(h ter) figée sur mp-m1-v3 et le site ne la connaît plus : le repli sans lien GARDE l'identité mp-m1-v3 (jamais mp-m1-v4-1) ; 2 passages de suite", async () => {
    const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
    const avant = [...VERSIONS_SITE_TEST];
    VERSIONS_SITE_TEST.clear(); // le site ne connaît aucune version : repli « version_inconnue_du_site »
    try {
      await validerFormulationsAuParcours([...V_M1]);
      await deposerCommentaire(depots, {});
      port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" }) as never;
      await passer();
      const tout = await Com.lireParametre<Record<string, Record<string, unknown>>>(C.PARAM_CONVERSATIONS, {});
      const cle = cleConversation(A);
      tout[cle] = { ...tout[cle], versionTexteM1: "mp-m1-v3", formulations: undefined };
      await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
      await passer(T0 + 3_600_000);
      expect((await etatDe()).formulations["m1-lien"], "1er passage").toBe("mp-m1-v3");
      await passer(T0 + 7_200_000);
      expect((await etatDe()).formulations["m1-lien"], "2e passage").toBe("mp-m1-v3");
      expect((await etatDe()).versionTexteM1).toBe("mp-m1-v2");
    } finally {
      for (const v of avant) VERSIONS_SITE_TEST.add(v);
    }
  });
  it("(i) repli sans lien puis nouvel essai : la formulation avec lien choisie au 1er essai est gardée (formulations[\"m1-lien\"])", async () => {
    await deposerCommentaire(depots, {});
    await validerFormulationsAuParcours([...V_M1]);
    const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
    const avant = [...VERSIONS_SITE_TEST];
    VERSIONS_SITE_TEST.clear(); // le site ne connaît rien : repli sans lien, nouvel essai
    port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" }) as never;
    try {
      await passer();
    } finally {
      for (const v of avant) VERSIONS_SITE_TEST.add(v);
    }
    const e1 = await etatDe();
    expect(e1.versionTexteM1).toBe("mp-m1-v2");
    const choisie = e1.formulations["m1-lien"] as string;
    expect(V_M1).toContain(choisie);
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" }) as never;
    await passer(T0 + 3_600_000);
    const t = port.prive[port.prive.length - 1].texte;
    expect(t).toBe(rendreM1(choisie, t.slice(t.indexOf("https://"))));
    expect((await etatDe()).formulations["m1-lien"]).toBe(choisie);
  });
  it("(c) aucune M1 v4 validée, lien allumé : M1 sans lien mp-m1-v2 exact, code texte_lien_non_valide, cloche sans push", async () => {
    await validerFormulationsAuParcours([]);
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
    expect((await etatDe()).versionTexteM1).toBe("mp-m1-v2");
    const n = await depots().notifications.lister((x: any) => /sans lien/.test(x.message));
    expect(n).toHaveLength(1);
    expect(n[0].envoi).toBeUndefined();
  });
  it("(f) panne de lecture du paramètre : ensemble vide, M1 sans lien ; validerFormulation refuse inconnue, retirée ou sans confirmation", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base indisponible"));
    expect((await MS.formulationsValidees()).size).toBe(0);
    vi.restoreAllMocks();
    silencerConsole();
    expect(await MS.validerFormulation({ version: "mp-m1-v4-1", confirmeParOperateur: false })).toMatchObject({ ok: false });
    expect(await MS.validerFormulation({ version: "mp-inconnu-v9", confirmeParOperateur: true })).toMatchObject({ ok: false });
    expect(await MS.validerFormulation({ version: "mp-m1-v3", confirmeParOperateur: true })).toMatchObject({ ok: false });
    expect(await MS.validerFormulation({ version: "mp-m1-v2", confirmeParOperateur: true })).toMatchObject({ ok: false }); // actif mais hors de tout groupe
    expect(await MS.validerFormulation({ version: "mp-m1-v4-1", confirmeParOperateur: true })).toMatchObject({ ok: true });
    expect(await MS.validerFormulation({ version: "mp-m1-v4-1", confirmeParOperateur: true })).toMatchObject({ ok: true }); // idempotent
    expect([...(await MS.formulationsValidees())]).toEqual(["mp-m1-v4-1"]);
    expect(MS.empreinteFormulation("mp-m1-v4-1")).toBe(empreinte("mp-m1-v4-1"));
  });
  it("une validation dont l'empreinte ne correspond plus n'est pas comptée", async () => {
    await Com.ecrireParametre("parcours.validation.formulations", { "mp-m1-v4-1": { empreinte: "0".repeat(64) } });
    expect((await MS.formulationsValidees()).size).toBe(0);
  });
});

describe("8 · stop gagnant, fenêtre", () => {
  it("opposition enregistrée avant le choix : 0 envoi", async () => {
    await validerFormulationsAuParcours();
    await deposerCommentaire(depots, {});
    await Opp.enregistrerOpposition(cleConversation(A));
    await passer();
    expect(port.prive).toHaveLength(0);
  });
  it("hors fenêtre de 24 h : aucun envoi « adresse refusée » et aucune formulation figée", async () => {
    await validerFormulationsAuParcours();
    await deposerCommentaire(depots, {});
    await passer();
    site.reponses = refuse;
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "msg-tard" });
    await passer(T0 + 30 * 3_600_000);
    expect(port.envoyes).toHaveLength(0);
    expect((await etatDe()).formulations?.["adresse-refusee"]).toBeUndefined();
  });
});

describe("9 · rien de sensible, interrupteur éteint", () => {
  it("après un passage : l'état ne contient que des noms de versions, aucun texte rendu ni lien", async () => {
    await validerFormulationsAuParcours();
    await deposerCommentaire(depots, {});
    await passer();
    const tout = JSON.stringify([await Com.lireParametre(C.PARAM_CONVERSATIONS, {}), await depots().evenements.lister(() => true), await depots().notifications.lister(() => true)]);
    expect(tout).not.toContain("guide-reseau?j=");
    expect(tout).not.toContain("Merci pour votre commentaire");
  });
  it("interrupteur PARCOURS_LIEN_GUIDE éteint : M1 = mp-m1-v2 octet pour octet", async () => {
    await validerFormulationsAuParcours();
    await deposerCommentaire(depots, {});
    await passer(T0, { ...ENV_LIEN, PARCOURS_LIEN_GUIDE: undefined });
    expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
  });
});

describe("10 · écran /mots", () => {
  it("la vue liste les 7 formulations non validées ; valider l'une ne change que celle-ci ; l'action refuse une version hors dictionnaire", async () => {
    const actions = await import("@/app/(studio)/mots/actions");
    const avant = await MS.lireVueMots();
    expect(avant.formulations!.map((f) => f.version).slice(0, TOUTES.length)).toEqual([...TOUTES]); // les 13 de la série 5 suivent (serie-5-formulations.test.ts)
    expect(avant.formulations!.every((f) => !f.valide)).toBe(true);
    expect(avant.formulations![0].texte).toBe(M1_VALIDES[0]);
    expect(await actions.validerFormulationAction("mp-m1-v4-2")).toMatchObject({ ok: true });
    const apres = await MS.lireVueMots();
    expect(apres.formulations!.filter((f) => f.valide).map((f) => f.version)).toEqual(["mp-m1-v4-2"]);
    expect(await actions.validerFormulationAction("mp-m1-v3")).toMatchObject({ ok: false });
    expect(await actions.validerFormulationAction("n'importe quoi")).toMatchObject({ ok: false });
  });
  it("EcranMots affiche le texte de chaque formulation, sa pastille et le bouton « Valider cette formulation »", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { EcranMots } = await import("@/components/mots/EcranMots");
    const vue = await MS.lireVueMots();
    await MS.validerFormulation({ version: "mp-m1-v4-2", confirmeParOperateur: true });
    const vue2 = await MS.lireVueMots();
    const rendu = (v: typeof vue) => renderToStaticMarkup(createElement(EcranMots, { vue: v, services: { validerFormulation: async () => ({ ok: true, raison: "valide" }) } as never, comptes: [COMPTE] }));
    const html = rendu(vue);
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    for (const t of [...M1_VALIDES, ...AR_VALIDES]) expect(html, t.slice(0, 30)).toContain(esc(t));
    expect(html.match(/Valider cette formulation/g)).toHaveLength(7 + 13);
    expect(html.match(/Non validée/g)).toHaveLength(7 + 13);
    const html2 = rendu(vue2);
    expect(html2.match(/Validée/g)).toHaveLength(1);
    expect(html2.match(/Non validée/g)).toHaveLength(6 + 13);
  });
});
