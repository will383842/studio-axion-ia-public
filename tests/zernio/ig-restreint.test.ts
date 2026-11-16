/**
 * T2 · Instagram réservé aux auteurs d'essai : tant que `parcours.instagram_public` n'est pas exactement `true`, le parcours ne sert sur Instagram
 * QUE les auteurs listés dans PARCOURS_ESSAI_AUTEURS. Facebook inchangé. Mode simple ET mode « plusieurs mots » + `instagram_suivre`.
 * Données 100 % fictives ; faux port, faux site : aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import fixture from "./aides/confirmations-page-guide.v1.json";
import { ADRESSE_FICTIVE, cleConversation, deposerCommentaire as deposerCommentaireAide, deposerMessage as deposerMessageAide, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, nettoyer, Opp, passer, pm, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: () => true }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => null }));
vi.mock("@/services/parcours-dossier", async (orig) => ({ ...(await orig<Record<string, any>>()), textesValidesPourLeMot: () => true, validationPourEnvoi: async () => null }));

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

const H = 3600_000;
// Ici le réglage public reste EXACTEMENT tel que le test l'a posé (absent par défaut) : les aides ne l'ouvrent pas.
const deposerCommentaire = (d: () => any, o: Parameters<typeof deposerCommentaireAide>[1] = {}) => deposerCommentaireAide(d, { ...o, reglageInstagram: "intact" });
const deposerMessage = (d: () => any, o: Parameters<typeof deposerMessageAide>[1] = {}) => deposerMessageAide(d, { ...o, reglageInstagram: "intact" });
const FORM = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", "mp-m2-v2-1"];
const ENV_OK = { ...ENV, PARCOURS_ESSAI_AUTEURS: AUTEUR };
const ENV_LIEN_OK = { ...ENV_OK, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: "secret-fictif-du-lien-0123456789-abcdefghij", LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const iso = (ms: number) => new Date(ms).toISOString();

const suivi = { appels: 0 };
const alertes = async () => (await depots().notifications.lister(() => true)).length;
const sorties = () => banc.port.pub.length + banc.port.prive.length + banc.port.envoyes.length;
const rienNeSort = () => {
  expect(sorties()).toBe(0);
  expect(banc.site.vus).toHaveLength(0);
  expect(suivi.appels).toBe(0);
};
const charge = async (id: string) => (await evenement(depots, id)).charge;

beforeEach(async () => {
  await preparer();
  suivi.appels = 0;
  (banc.port.port as any).lireSuiviInstagram = async () => (suivi.appels++, { statut: "suit" });
  banc.port.reponses.texte = () => "OK";
  await validerFormulationsAuParcours(FORM);
});
afterEach(nettoyer);

describe.each([["mode simple", false], ["mode « plusieurs mots » + instagram_suivre", true]] as const)("T2 · %s", (_nom, multi) => {
  beforeEach(async () => {
    if (multi) {
      await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
      await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
    }
  });
  const pass = (ms: number, env: Record<string, string | undefined>) => passer(ms, { env });
  const cleSemee = () => (multi ? cleParcours(cleConversation(AUTEUR), "a".padEnd(64, "0")) : cleConversation(AUTEUR));
  async function semer(etat: string, extra: Record<string, unknown> = {}): Promise<string> {
    const cle = cleSemee();
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: {
        ...graineConv(etat, {
          reseau: "instagram", cleIdempotenceGuide: "a".padEnd(64, "0"), idCommentaire: "com-graine-1", versionTexteM1: "mp-m1-v4-1", creeLe: iso(T0 - 2 * H), m1Le: iso(T0 - 2 * H + 1000),
          ...(multi ? { mot: "GUIDE", nature: "premier", groupeM1: "m1-lien", titreCible: TITRE, formulations: { "m1-adresse": "mp-m1-v4-1" } } : {}),
        }),
        ...extra,
      },
    });
    return cle;
  }
  const com = (o: Parameters<typeof deposerCommentaire>[1] = {}) => deposerCommentaire(depots, { motSeul: "GUIDE", reseau: "instagram", ...o });

  it("1 · réglage absent, auteur non listé, GUIDE sur Instagram : rien ne part, clos « ecarte/ig_hors_essai » au PREMIER passage, aucune conversation", async () => {
    const alertesAvant = await alertes(); // la base en mémoire contient déjà des notifications de départ : on compare avant / après
    const id = await com();
    const rap = await pass(T0, ENV);
    rienNeSort();
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "ig_hors_essai" });
    expect((await charge(id)).prochainEssaiLe ?? null).toBeNull();
    expect(rap.enAttente).toBe(0);
    expect(Object.keys(await toutesLesConversations())).toHaveLength(0);
    expect(await alertes()).toBe(alertesAvant);
    await pass(T0 + 5000, ENV);
    rienNeSort();
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "ig_hors_essai" });
  });

  it("2 · auteur listé : réponse publique puis premier message (ig-suivre si réglé, sinon M1)", async () => {
    await com();
    await pass(T0, ENV_OK);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
    expect(suivi.appels).toBe(0);
    const [c] = Object.values(await toutesLesConversations()) as any[];
    expect(c.etat).toBe(multi ? "ig_attente_ok" : "attente_email");
    expect(c.reseau).toBe("instagram");
  });

  it("3 · « STOP » d'un auteur non listé, en commentaire : opposition inscrite, rien d'envoyé", async () => {
    const id = await com({ motSeul: "STOP" });
    await pass(T0, ENV);
    rienNeSort();
    expect((await charge(id)).etat).toBe("oppose");
    const o = await Opp.personneOpposeePartout({ idsBruts: [AUTEUR], empreintes: [cleConversation(AUTEUR)] }, { env: ENV, douteBloque: false });
    expect(o.opposee).toBe(true);
  });

  it("3 · « STOP » d'un auteur non listé, en message privé : opposition inscrite, rien d'envoyé", async () => {
    await semer("attente_email");
    banc.port.reponses.texte = () => "stop";
    const id = await deposerMessage(depots, { idMessage: "msg-stop-ig", avance: 5000 });
    await pass(T0 + 10_000, ENV);
    expect(sorties()).toBe(0);
    expect(banc.site.vus).toHaveLength(0);
    expect((await charge(id)).etat).toBe("oppose");
    expect(((Object.values(await toutesLesConversations()) as any[])[0]).etat).toBe("oppose");
    const o = await Opp.personneOpposeePartout({ idsBruts: [AUTEUR], empreintes: [cleConversation(AUTEUR)] }, { env: ENV, douteBloque: false });
    expect(o.opposee).toBe(true);
  });

  it("4 · Facebook, auteur non listé : servi comme avant", async () => {
    await com({ reseau: "facebook" });
    await pass(T0, ENV);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
  });

  it("5 · réglage exactement `true` : un auteur non listé est servi", async () => {
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_PUBLIC, true);
    await com();
    await pass(T0, ENV);
    expect(banc.port.pub).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
  });

  it.each([["la chaîne « true »", "true"], ["le nombre 1", 1], ["un objet vide", {}], ["faux", false], ["null", null]])("5 · réglage valant %s : éteint, auteur non listé non servi", async (_n, v) => {
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_PUBLIC, v);
    const id = await com();
    await pass(T0, ENV);
    rienNeSort();
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "ig_hors_essai" });
  });

  it.each([
    ["liste absente", undefined],
    ["liste vide", ""],
    ["liste mal formée", "auteur fictif 400!"],
    ["plus de 3 entrées", `${AUTEUR},auteur-fictif-401,auteur-fictif-402,auteur-fictif-403`],
  ])("6 · %s : personne n'est servi sur Instagram", async (_n, liste) => {
    const id = await com();
    await pass(T0, { ...ENV, ...(liste === undefined ? {} : { PARCOURS_ESSAI_AUTEURS: liste }) });
    rienNeSort();
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "ig_hors_essai" });
  });

  it("9 · garde() sur Instagram sans clé d'état : « ig_hors_essai » (échec fermé), même auteur listé ; Facebook non touché", async () => {
    const d = { port: banc.port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV_OK, maintenantMs: T0 };
    expect(await C.gardeParcoursPourTest(d, ENV_OK, COMPTE, "instagram")).toBe("ig_hors_essai");
    expect(await C.gardeParcoursPourTest(d, ENV_OK, COMPTE, "facebook")).toBeNull();
    expect(await C.gardeParcoursPourTest(d, ENV_OK, COMPTE, "instagram", undefined, T0, cleConversation(AUTEUR))).toBeNull();
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_PUBLIC, true);
    expect(await C.gardeParcoursPourTest(d, ENV, COMPTE, "instagram")).toBeNull();
  });

  /* --- 8 · liste vidée en cours de route : chaque envoi de SUITE est revérifié ---------------------------------------- */
  const SUITES: Array<{ nom: string; preparer: () => Promise<string>; envoi: () => number; motif: RegExp }> = [
    {
      nom: "avant M2 (texte sans adresse)",
      preparer: async () => (await semer("attente_email", { versionTexteM1: "mp-m1-v2" }), banc.port.reponses.texte = () => "bonjour", deposerMessage(depots, { idMessage: "msg-m2", avance: 5000 })),
      envoi: () => banc.port.envoyes.length,
      motif: /^garde_ig_hors_essai$/,
    },
    {
      nom: "avant la demande au site (adresse écrite)",
      preparer: async () => (await semer("attente_email"), banc.port.reponses.texte = () => `Mon adresse : ${ADRESSE_FICTIVE}`, deposerMessage(depots, { idMessage: "msg-adr", avance: 5000 })),
      envoi: () => banc.site.vus.length,
      motif: /^garde_ig_hors_essai$/,
    },
    {
      nom: "avant l'accusé (reprendre_recu)",
      preparer: async () => (await semer("guide_demande", { idMessageGuide: "msg-accuse" }), deposerMessage(depots, { idMessage: "msg-accuse", avance: 5000 })),
      envoi: () => banc.port.envoyes.length,
      motif: /^garde_ig_hors_essai$/,
    },
    {
      nom: "avant le renvoi « deja-envoye » (reprise d'un commentaire)",
      preparer: async () => (await semer("pub_ok", { m1Le: undefined, ...(multi ? { nature: "renvoi", groupeM1: "deja-envoye" } : {}) }), com({ idCommentaire: "com-graine-1", ageMs: 1000 })),
      envoi: () => banc.port.prive.length,
      motif: /ig_hors_essai$/,
    },
  ];
  for (const s of SUITES) {
    it(`8 · ${s.nom} : témoin (auteur listé) = envoi`, async () => {
      await s.preparer();
      await pass(T0 + 10_000, ENV_LIEN_OK);
      expect(s.envoi()).toBeGreaterThan(0);
    });
    it(`8 · ${s.nom} : liste vidée = rien ne part, événement clos`, async () => {
      const id = await s.preparer();
      await pass(T0 + 10_000, ENV);
      expect(sorties() + banc.site.vus.length).toBe(0);
      const e = await charge(id);
      expect(e.etat).toBe("ecarte");
      expect(String(e.dernierCode)).toMatch(s.motif);
      expect(e.prochainEssaiLe ?? null).toBeNull();
    });
  }
});

describe("T2 · mode « plusieurs mots » + instagram_suivre · liste vidée entre ig-suivre et le OK", () => {
  beforeEach(async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
  });
  const cle = () => cleParcours(cleConversation(AUTEUR), "a".padEnd(64, "0"));
  async function semerAttenteOk(): Promise<void> {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle()]: {
        ...graineConv("ig_attente_ok", {
          reseau: "instagram", cleIdempotenceGuide: "a".padEnd(64, "0"), idCommentaire: "com-graine-1", mot: "GUIDE", nature: "premier", groupeM1: "m1-lien", titreCible: TITRE,
          versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 5 * H), m1Le: iso(T0 - 5 * H + 1000),
        }),
      },
    });
  }
  it("témoin : auteur listé, le OK lit le suivi et envoie le lien", async () => {
    await semerAttenteOk();
    await deposerMessage(depots, { idMessage: "msg-ok-1", avance: 5000 });
    await passer(T0 + 10_000, { env: ENV_LIEN_OK });
    expect(suivi.appels).toBe(1);
    expect(banc.port.envoyes).toHaveLength(1);
  });
  it("7 · liste vidée : 0 envoi ET 0 lecture du suivi ; parcours consommé ; événement clos « ecarte/garde_ig_hors_essai »", async () => {
    await semerAttenteOk();
    const id = await deposerMessage(depots, { idMessage: "msg-ok-1", avance: 5000 });
    await passer(T0 + 10_000, { env: { ...ENV_LIEN_OK, PARCOURS_ESSAI_AUTEURS: "auteur-fictif-401" } });
    expect(banc.port.envoyes).toHaveLength(0);
    expect(banc.port.prive).toHaveLength(0);
    expect(suivi.appels).toBe(0);
    const [c] = Object.values(await toutesLesConversations()) as any[];
    expect(c).toMatchObject({ etat: "ig_attente_ok", idMessageOk: "msg-ok-1", okRecus: 1 });
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "garde_ig_hors_essai" });
  });
});

/* --- 8 · avant le merci ----------------------------------------------------------------------------------------------- */
describe("T2 · liste vidée avant le merci", () => {
  const REF = createHash("sha256").update("jeton-fictif-ig-restreint").digest("hex");
  const ENV_MERCI = { ...ENV, PARCOURS_MERCI_ENABLED: "1" };
  const accuses: RequeteSignee[] = [];
  const transport = async (r: RequeteSignee) => {
    if (r.chemin === fixture.lecture.chemin) return { statut: 200, corps: { ok: true, schemaVersion: 1, confirmations: [{ ref: REF, valideLe: iso(T0 - 60_000) }] } };
    if (r.chemin === fixture.accuse.chemin) return (accuses.push(r), { statut: 200, corps: { ok: true, schemaVersion: 1, recus: 1 } });
    return { statut: 404, corps: {} };
  };
  beforeEach(async () => {
    accuses.length = 0;
    pm.injecterTransportSite(transport);
    await Com.ecrireParametre("parcours.validation.merci", { empreinte: createHash("sha256").update(`mp-merci-v1\n${TEXTES_MP["mp-merci-v1"].texte}`).digest("hex") });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cleConversation(AUTEUR)]: {
        ...graineConv("attente_email", { reseau: "instagram", versionTexteM1: "mp-m1-v4-1", guide: "guide-ia", refLienConv: "c1_AbCdEf0123456789_-xyZQ", empreintesLien: [REF], derniereActiviteLe: iso(T0 - H), idMessageDernier: "msg-dernier" }),
      },
    });
    await depots().evenementsFournisseurs.enregistrer({ id: "evf-msg-dernier", fournisseur: "zernio", idEvenement: "evt-msg-dernier", type: "zernio.message", recuLe: iso(T0 - H), traite: true, creeLe: iso(T0 - H), modifieLe: iso(T0 - H), charge: { idMessage: "msg-dernier", idConversation: "conv-fictive-700", idCompte: COMPTE, idExpediteur: AUTEUR, etat: "termine" } });
  });
  const merci = (env: Record<string, string | undefined>) => C.traiterMercis({ port: banc.port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: T0 });
  const journal = () => Com.lireParametre<Record<string, any>>(C.PARAM_MERCI_JOURNAL, {});
  it("témoin : auteur listé, le merci part", async () => {
    await merci({ ...ENV_MERCI, PARCOURS_ESSAI_AUTEURS: AUTEUR });
    expect(banc.port.envoyes).toHaveLength(1);
    expect((await journal())[REF]).toMatchObject({ etat: "envoye" });
  });
  it("liste vidée : aucun merci, accusé « non_envoye » avec le code garde_ig_hors_essai", async () => {
    await merci(ENV_MERCI);
    expect(banc.port.envoyes).toHaveLength(0);
    expect((await journal())[REF]).toMatchObject({ etat: "non_envoye", issue: "garde_ig_hors_essai" });
  });
});

/* --- Le lecteur du réglage (modèle : insta-b-reglage) ------------------------------------------------------------------- */
describe("instagramPublicActif", () => {
  it("la clé exacte est parcours.instagram_public", () => expect(IG.PARAM_INSTAGRAM_PUBLIC).toBe("parcours.instagram_public"));
  it("absent => éteint (défaut du code)", async () => expect(await IG.instagramPublicActif()).toBe(false));
  it("true enregistré => allumé", async () => {
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_PUBLIC, true);
    expect(await IG.instagramPublicActif()).toBe(true);
  });
  it.each([false, "true", 1, "1", "oui", 0, "", null, {}, [], [true]])("valeur %j => éteint", async (v) => {
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_PUBLIC, v);
    expect(await IG.instagramPublicActif()).toBe(false);
  });
  it("lecture en panne => éteint", async () => expect(await IG.instagramPublicActif({ lire: async () => { throw new Error("panne"); } })).toBe(false));
  it("lecture injectée : true allume, le reste éteint", async () => {
    expect(await IG.instagramPublicActif({ lire: async () => true })).toBe(true);
    for (const v of [false, "true", 1, undefined, null]) expect(await IG.instagramPublicActif({ lire: async () => v })).toBe(false);
  });
  it("le réglage n'a AUCUN écrivain dans le code et son seul lecteur de production est parcours-conversation", { timeout: 60_000 }, () => {
    const MODULE = "src/services/parcours-instagram.ts";
    const parcourir = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? parcourir(p) : /\.(ts|tsx)$/.test(n) ? [p.replace(/\\/g, "/")] : []; });
    const fichiers = parcourir("src").filter((f) => f !== MODULE);
    expect(fichiers.filter((f) => /parcours\.instagram_public|instagramPublicActif|PARAM_INSTAGRAM_PUBLIC/.test(readFileSync(f, "utf8")))).toEqual(["src/services/parcours-conversation.ts"]);
    const src = readFileSync(MODULE, "utf8");
    expect(src).toContain("ÉTEINT PAR DÉFAUT ; seul lecteur de production : parcours-conversation (INSTA-C)");
    expect(src).not.toMatch(/ecrireParametre\(PARAM_INSTAGRAM_PUBLIC/);
    const conv = readFileSync("src/services/parcours-conversation.ts", "utf8");
    expect(conv).not.toMatch(/ecrireParametre\([^)]*PARAM_INSTAGRAM_PUBLIC/);
  });
});
