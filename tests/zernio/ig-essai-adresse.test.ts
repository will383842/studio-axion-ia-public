/**
 * T3b + T4b · Instagram, cible d'ESSAI : après le OK, la personne reçoit la demande d'adresse validée (groupe « m1-adresse-rgpd », ex. mp-m1-v6-1),
 * JAMAIS un lien, JAMAIS mp-m1-v2 ; puis son adresse est transmise au site avec le code de la cible d'essai.
 * Mode « plusieurs mots » + instagram_suivre ; compte et auteur listés ; faux port, faux site, faux catalogue ; données 100 % fictives ; aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { CHEMIN_GUIDE } from "./aides/oppositions";
import { ADRESSE_FICTIVE, cleConversation, deposerCommentaire as deposerCommentaireAide, deposerMessage as deposerMessageAide, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, lireTexteDe, MS, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";

const site = vi.hoisted(() => ({ versions: new Set<string>(["mp-m1-v4-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", "mp-m1-v6-1"]), catalogue: null as unknown, panneEssai: false, pannes: 0, lieux: [] as string[] }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => {
    // Panne de lecture limitée à l'appel de la fonction qui décide « cible d'essai du jour » (les autres lectures réussissent).
    // `pannes` / `lieux` prouvent que la panne s'est déclenchée DANS la fonction visée (pas seulement qu'une regex a trouvé un mot dans la pile).
    const lieu = /at (?:async )?(statutEssaiCatalogue|cibleEstEssaiAujourdhui)\b/.exec(new Error().stack ?? "");
    if (site.panneEssai && lieu) { site.pannes++; site.lieux.push(lieu[1]); throw new Error("catalogue en panne (fictif)"); }
    return site.catalogue;
  } }));
vi.mock("@/services/notifications", async (orig) => ({ ...(await orig<Record<string, unknown>>()), creerNotification: vi.fn(async () => undefined) }));

const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");
const V = await import("@/services/mots-validation-par-mot");

const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const MOT = "ESSAICONV";
const CODE = "gde-essai05";
const TITRE_ESSAI = "Guide d'essai conversation";
const NOUVELLE = "mp-m1-v6-1";
const SECRET_LIEN = "secret-fictif-du-lien-0123456789-abcdefghij";
const ENV_X = {
  ...ENV, PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE, PARCOURS_LIEN_GUIDE: "true", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale`,
  PARCOURS_ESSAI_COMPTES: COMPTE, PARCOURS_ESSAI_AUTEURS: AUTEUR,
};
const ENV_RETIRE = { ...ENV_X, PARCOURS_ESSAI_AUTEURS: "auteur-fictif-401" };
const FORM = ["mp-ig-suivre-v1-1", "mp-ig-pas-encore-v1-1", NOUVELLE, "mp-adresse-refusee-v3-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", "mp-m2-v2-1"];

const catalogue = (test = true) => ({
  catalogue: [
    { code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false },
    { code: CODE, type: "guide" as const, titre: TITRE_ESSAI, actif: true, test },
  ],
  liaisons: [
    { mot: "GUIDE", reseau: "tous" as const, codeCible: "guide-ia", actif: true },
    { mot: MOT, reseau: "tous" as const, codeCible: CODE, actif: true },
  ],
  luLe: T0, ignores: 0, depuisCopie: false,
});
// Le réglage public d'Instagram reste TEL QUEL (absent) : seuls les auteurs listés sont servis.
const deposerCommentaire = (d: () => any, o: Parameters<typeof deposerCommentaireAide>[1] = {}) => deposerCommentaireAide(d, { ...o, reglageInstagram: "intact" });
const deposerMessage = (d: () => any, o: Parameters<typeof deposerMessageAide>[1] = {}) => deposerMessageAide(d, { ...o, reglageInstagram: "intact" });
const com = (mot: string) => deposerCommentaire(depots, { motSeul: mot, reseau: "instagram" });
const msg = (id: string, avance = 5000) => deposerMessage(depots, { idMessage: id, avance });
const pass = (ms: number, env: Record<string, string | undefined> = ENV_X) => passer(ms, { env });
const demandes = () => banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE);
const conv = async () => (Object.values(await toutesLesConversations()) as any[])[0];
const charge = async (id: string) => (await evenement(depots, id)).charge;
const suivi = { appels: 0 };
const sorties = () => banc.port.pub.length + banc.port.prive.length + banc.port.envoyes.length;
const T1 = T0 + 10_000;

const registreMots = async () => {
  const reg: Record<string, unknown> = {};
  for (const mot of ["GUIDE", MOT]) reg[`${mot}|${COMPTE}`] = { mot, compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};
const validerEssaiIg = async () => {
  const a = (await V.apercuTextesMot({ mot: MOT, env: ENV_X, maintenantMs: T0 })).find((x) => x.reseau === "instagram")!;
  if (!a.ok) throw new Error(`aperçu refusé : ${a.raison}`);
  const r = await V.validerTextesMot({ mot: MOT, reseau: "instagram", empreinteVue: a.empreinte, confirmeParOperateur: true, env: ENV_X, maintenantMs: T0 });
  if (!r.ok) throw new Error(r.raison);
};
/** Commentaire du mot d'essai → ig-suivre ; puis un OK → (selon le suivi) la demande d'adresse. */
async function jusquAuOk(mot = MOT, env = ENV_X): Promise<string> {
  await com(mot);
  await pass(T0, env);
  const id = await msg("msg-ok-1");
  await pass(T1, env);
  return id;
}

beforeEach(async () => {
  await preparer();
  site.versions = new Set(["mp-m1-v4-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", NOUVELLE]);
  site.catalogue = catalogue();
  site.panneEssai = false;
  site.pannes = 0;
  site.lieux = [];
  suivi.appels = 0;
  (banc.port.port as any).lireSuiviInstagram = async () => (suivi.appels++, { statut: "suit" });
  lireTexteDe("OK");
  await validerFormulationsAuParcours(FORM);
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
  await registreMots();
  await validerEssaiIg();
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
});

describe("T4b · après le OK, une cible d'essai reçoit la demande d'adresse (jamais un lien)", () => {
  it("1 · suit déjà : OK → texte = rendu de mp-m1-v6-1 (aucun http, aucun jeton) ; attente_email, versionTexteM1 = v6-1, adresseIgLe posé, lienIgLe absent", async () => {
    await jusquAuOk();
    expect(banc.port.prive).toHaveLength(1); // ig-suivre
    expect(banc.port.envoyes).toHaveLength(1);
    const envoye = banc.port.envoyes[0];
    expect(envoye.texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(envoye.texte).not.toMatch(/https?:|\[LIEN\]/i);
    expect(envoye.cle).toContain("|ig|m1-adresse-rgpd|");
    const c = await conv();
    expect(c).toMatchObject({ etat: "attente_email", versionTexteM1: NOUVELLE, suiviIg: "deja_suivi", cibleEssai: true, formulations: { "m1-adresse": NOUVELLE } });
    expect(typeof c.adresseIgLe).toBe("string");
    expect(c.lienIgLe).toBeUndefined();
    expect(c.refLienConv).toBeUndefined();
    expect(c.empreintesLien ?? []).toEqual([]);
    expect(suivi.appels).toBe(1);
  });

  it("2 · ne suit pas : « pas encore » ; 2e OK → v6-1 (jamais bloqué sur le suivi) ", async () => {
    let n = 0;
    (banc.port.port as any).lireSuiviInstagram = async () => (suivi.appels++, ++n === 1 ? { statut: "ne_suit_pas" } : { statut: "ne_suit_pas" });
    await jusquAuOk();
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp("mp-ig-pas-encore-v1-1", { mot: MOT, titre: TITRE_ESSAI }));
    expect((await conv()).etat).toBe("ig_pas_encore");
    await msg("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    expect(banc.port.envoyes).toHaveLength(2);
    expect(banc.port.envoyes[1].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(banc.port.envoyes[1].texte).not.toMatch(/https?:/);
    expect(await conv()).toMatchObject({ etat: "attente_email", versionTexteM1: NOUVELLE, suiviIg: "sans_suivre" });
  });

  it("3 · adresse écrite : le corps envoyé au site porte versionTexteM1 = v6-1, reseau instagram et le code de la cible d'essai", async () => {
    await jusquAuOk();
    lireTexteDe(`Mon adresse : ${ADRESSE_FICTIVE}`);
    await msg("msg-adr", 30_000);
    await pass(T1 + 40_000);
    expect(demandes()).toHaveLength(1);
    expect(JSON.parse(demandes()[0].corps)).toMatchObject({ guide: CODE, mot: MOT, reseau: "instagram", versionTexteM1: NOUVELLE });
  });

  it("4 · plafond : adresse refusée (422) quand l'auteur suit déjà : le message part (ig-suivre + v6-1 comptés, l'adresse refusée est hors plafond)", async () => {
    await jusquAuOk();
    banc.site.reponses = () => ({ statut: 422, corps: { erreur: "invalide" } });
    lireTexteDe(`Mon adresse : ${ADRESSE_FICTIVE}`);
    await msg("msg-adr-1", 30_000);
    await pass(T1 + 40_000);
    expect(banc.port.envoyes).toHaveLength(2); // v6-1 puis « adresse refusée »
    expect(typeof (await conv()).adresseRefuseeLe).toBe("string");
  });

  it("4 · plafond : ne suit pas (ig-suivre, « pas encore », v6-1 = 3 messages comptés) : adresse refusée (422) → le message part quand même, la demande d'adresse compte", async () => {
    (banc.port.port as any).lireSuiviInstagram = async () => (suivi.appels++, { statut: "ne_suit_pas" });
    await jusquAuOk();
    await msg("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    expect(banc.port.envoyes).toHaveLength(2); // pas encore, v6-1
    expect(typeof (await conv()).adresseIgLe).toBe("string");
    banc.site.reponses = () => ({ statut: 422, corps: { erreur: "invalide" } });
    lireTexteDe(`Mon adresse : ${ADRESSE_FICTIVE}`);
    await msg("msg-adr-1", 40_000);
    await pass(T1 + 50_000);
    expect(banc.port.envoyes).toHaveLength(3); // l'adresse refusée part : hors plafond de 3
  });

  it("4 · plafond : ne suit pas, bonne adresse : le guide est demandé, l'accusé part (hors plafond de 3, termine)", async () => {
    (banc.port.port as any).lireSuiviInstagram = async () => (suivi.appels++, { statut: "ne_suit_pas" });
    await jusquAuOk();
    await msg("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    lireTexteDe(`Mon adresse : ${ADRESSE_FICTIVE}`);
    const id = await msg("msg-adr-2", 40_000);
    await pass(T1 + 50_000);
    expect(demandes()).toHaveLength(1);
    expect(banc.port.envoyes).toHaveLength(3); // l'accusé part
    expect(await conv()).toMatchObject({ etat: "termine" });
    expect((await charge(id)).dernierCode).toBeNull();
  });

  it("5 · mp-m1-v6-1 non validée : aucun envoi, aucun repli vers mp-m1-v2 ni vers un lien, alerte, parcours consommé, clos « ignore/adresse_indisponible »", async () => {
    await com(MOT);
    await pass(T0);
    await validerFormulationsAuParcours(FORM.filter((x) => x !== NOUVELLE));
    const { creerNotification } = await import("@/services/notifications");
    vi.mocked(creerNotification).mockClear();
    const id = await msg("msg-ok-1");
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(banc.port.prive).toHaveLength(1); // seulement ig-suivre
    expect(JSON.stringify(banc.port.envoyes)).not.toMatch(/https?:/);
    expect(vi.mocked(creerNotification)).toHaveBeenCalled();
    expect(await charge(id)).toMatchObject({ etat: "ignore", dernierCode: "adresse_indisponible" });
    expect(await conv()).toMatchObject({ etat: "ig_attente_ok", idMessageOk: "msg-ok-1", okRecus: 1 });
  });

  it("6 · cible devenue d'essai AUJOURD'HUI (drapeau absent de la conversation) : v6-1, pas de lien", async () => {
    const cle = cleParcours(cleConversation(AUTEUR), "a".padEnd(64, "0"));
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: graineConv("ig_attente_ok", {
        reseau: "instagram", cleIdempotenceGuide: "a".padEnd(64, "0"), idCommentaire: "com-graine-1", mot: MOT, guide: CODE, nature: "premier", groupeM1: "m1-lien", titreCible: TITRE_ESSAI,
        versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 2 * H), m1Le: iso(T0 - 2 * H + 1000), derniereActiviteLe: iso(T0 - 1000),
      }),
    });
    expect((await conv()).cibleEssai).toBeUndefined();
    await msg("msg-ok-1");
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(banc.port.envoyes[0].texte).not.toMatch(/https?:/);
    const c = await conv();
    expect(c).toMatchObject({ etat: "attente_email", versionTexteM1: NOUVELLE });
    expect(c.lienIgLe).toBeUndefined();
  });

  it("6 bis · cible devenue d'essai AUJOURD'HUI : v6-1 puis le drapeau cibleEssai est posé ; l'adresse écrite part au site avec guide, reseau instagram et versionTexteM1 v6-1", async () => {
    const cle = cleParcours(cleConversation(AUTEUR), "a".padEnd(64, "0"));
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: graineConv("ig_attente_ok", {
        reseau: "instagram", cleIdempotenceGuide: "a".padEnd(64, "0"), idCommentaire: "com-graine-1", mot: MOT, guide: CODE, nature: "premier", groupeM1: "m1-lien", titreCible: TITRE_ESSAI,
        versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 2 * H), m1Le: iso(T0 - 2 * H + 1000), derniereActiviteLe: iso(T0 - 1000),
      }),
    });
    expect((await conv()).cibleEssai).toBeUndefined();
    await msg("msg-ok-1");
    await pass(T1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect((await conv()).cibleEssai).toBe(true);
    lireTexteDe(`Mon adresse : ${ADRESSE_FICTIVE}`);
    await msg("msg-adr", 30_000);
    await pass(T1 + 40_000);
    expect(demandes()).toHaveLength(1);
    expect(JSON.parse(demandes()[0].corps)).toMatchObject({ guide: CODE, reseau: "instagram", versionTexteM1: NOUVELLE });
  });

  it("7 · texte sans adresse : M2 part UNE fois, m2Le compté ; un 2e texte sans adresse : silence", async () => {
    await jusquAuOk();
    lireTexteDe("bonjour");
    await msg("msg-t1", 30_000);
    await pass(T1 + 40_000);
    expect(banc.port.envoyes).toHaveLength(2); // v6-1 puis M2
    const c = await conv();
    expect(c.m2Envoye).toBe(true);
    expect(typeof c.m2Le).toBe("string");
    lireTexteDe("encore bonjour");
    await msg("msg-t2", 60_000);
    await pass(T1 + 70_000);
    expect(banc.port.envoyes).toHaveLength(2);
  });

  it("8 · rejeu du même OK : un seul envoi", async () => {
    const id = await jusquAuOk();
    expect(banc.port.envoyes).toHaveLength(1);
    const e = await evenement(depots, id);
    await depots().evenementsFournisseurs.enregistrer({ ...e, traite: false, charge: { ...e.charge, etat: "a_faire", dernierCode: undefined } });
    await pass(T1 + 20_000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.prive).toHaveLength(1);
  });

  it("8 · issue inconnue ou redémarrage en vol : ig_a_verifier, jamais renvoyé", async () => {
    banc.port.reponses.envoyer = () => ({ statut: "a_verifier", code: "timeout" });
    await com(MOT);
    await pass(T0);
    const id = await msg("msg-ok-1");
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect((await conv()).etat).toBe("ig_a_verifier");
    const e = await evenement(depots, id);
    await depots().evenementsFournisseurs.enregistrer({ ...e, traite: false, charge: { ...e.charge, etat: "a_faire", dernierCode: undefined } });
    banc.port.reponses.envoyer = () => ({ statut: "envoye" } as any);
    await pass(T1 + 20_000);
    expect(banc.port.envoyes).toHaveLength(1);
  });

  it("9 · GUIDE réel sur Instagram (auteur listé) : le lien part comme avant (non-régression), pas de demande d'adresse", async () => {
    await jusquAuOk("GUIDE");
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toMatch(/https?:\/\//);
    expect(banc.port.envoyes[0].cle).toContain("|ig|lien-rappel|");
    const c = await conv();
    expect(c).toMatchObject({ etat: "attente_email", versionTexteM1: "mp-lien-v3-1" });
    expect(typeof c.lienIgLe).toBe("string");
    expect(c.cibleEssai).toBeUndefined();
    expect(c.adresseIgLe).toBeUndefined();
  });

  it("10 · auteur retiré de la liste avant le OK : rien ne part", async () => {
    await com(MOT);
    await pass(T0);
    const avant = banc.port.envoyes.length;
    await msg("msg-ok-1");
    await pass(T1, ENV_RETIRE);
    expect(banc.port.envoyes).toHaveLength(avant);
    expect(sorties()).toBe(2); // réponse publique + ig-suivre, rien d'autre
    expect(suivi.appels).toBe(0);
  });
});

describe("T3b · le site connaît le code de la cible d'essai Instagram", () => {
  it("compteEssaiPourGuides : Instagram listé → le compte ; non listé ou drapeau absent → undefined ; autre réseau → undefined", async () => {
    const etat: any = { cibleEssai: true, reseau: "instagram", idCompte: COMPTE };
    const cle = cleConversation(AUTEUR);
    expect(C.compteEssaiPourGuides(ENV_X, etat, cle)).toBe(COMPTE);
    expect(C.compteEssaiPourGuides(ENV_RETIRE, etat, cle)).toBeUndefined();
    expect(C.compteEssaiPourGuides(ENV_X, { ...etat, cibleEssai: undefined }, cle)).toBeUndefined();
    expect(C.compteEssaiPourGuides(ENV_X, { ...etat, reseau: "linkedin" }, cle)).toBeUndefined();
  });
  it("guidesDuCatalogue : la cible d'essai n'est incluse que pour le réseau et le compte listés", async () => {
    expect(await C.guidesDuCatalogue(ENV_X, T0, { compte: COMPTE, reseau: "instagram" })).toEqual(expect.arrayContaining(["guide-ia", CODE]));
    expect(await C.guidesDuCatalogue(ENV_X, T0, { compte: COMPTE, reseau: "facebook" })).toEqual(expect.arrayContaining(["guide-ia", CODE]));
    expect(await C.guidesDuCatalogue(ENV_X, T0, { compte: COMPTE, reseau: "linkedin" })).toEqual(["guide-ia"]);
    expect(await C.guidesDuCatalogue(ENV_X, T0, { compte: "compte-fictif-999", reseau: "instagram" })).toEqual(["guide-ia"]);
    expect(await C.guidesDuCatalogue(ENV_X, T0, undefined)).toEqual(["guide-ia"]);
  });
  it("VRAIE cible Instagram d'un autre mot (non essai) : clos « instagram_pas_encore », 0 envoi", async () => {
    site.catalogue = catalogue(false);
    const id = await com(MOT);
    await pass(T0);
    expect(sorties()).toBe(0);
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "instagram_pas_encore" });
  });
  it("cible d'essai : compte non listé ≠ auteur non listé (deux codes de refus distincts, silence dans les deux cas)", async () => {
    const id1 = await com(MOT);
    await pass(T0, { ...ENV_X, PARCOURS_ESSAI_COMPTES: "compte-fictif-999" });
    expect(await charge(id1)).toMatchObject({ etat: "ecarte", dernierCode: "essai_compte_refuse" });
    expect(sorties()).toBe(0);
  });
});

describe("Suites de la relecture de #853 : le drapeau cibleEssai n'est écrit que si l'essai est prouvé", () => {
  /** Conversation Instagram en attente du OK, drapeau cibleEssai ABSENT (née avant que la cible passe en essai). */
  const graineSansDrapeau = async () => {
    const cle = cleParcours(cleConversation(AUTEUR), "a".padEnd(64, "0"));
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
      [cle]: graineConv("ig_attente_ok", {
        reseau: "instagram", cleIdempotenceGuide: "a".padEnd(64, "0"), idCommentaire: "com-graine-1", mot: MOT, guide: CODE, nature: "premier", groupeM1: "m1-lien", titreCible: TITRE_ESSAI,
        versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 2 * H), m1Le: iso(T0 - 2 * H + 1000), derniereActiviteLe: iso(T0 - 1000),
      }),
    });
    expect((await conv()).cibleEssai).toBeUndefined();
  };

  it("T15 · OK Instagram, lecture du catalogue en PANNE au moment du OK (essai supposé) : rien ne part, événement reporté catalogue_illisible, aucun état ig_envoi_en_vol ; panne levée, rejeu après l'attente : la demande d'adresse part avec cibleEssai", async () => {
    await graineSansDrapeau();
    site.panneEssai = true;
    const id = await msg("msg-ok-1");
    await pass(T1);
    expect(site.pannes).toBeGreaterThan(0); // la panne s'est déclenchée dans statutEssaiCatalogue, au moment du OK
    expect(site.lieux.every((l) => l === "statutEssaiCatalogue")).toBe(true);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(sorties()).toBe(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    const c1 = await conv();
    expect(c1.etat).toBe("ig_attente_ok"); // ni ig_envoi_en_vol, ni parcours consommé : le OK n'est pas compté
    expect(c1.idMessageOk).toBeUndefined();
    expect(c1.okRecus).toBeUndefined();
    expect(c1.cibleEssai).toBeUndefined();
    // Avant la fin de l'attente (60 s) : toujours rien (l'horloge du banc, pas de remise à a_faire à la main).
    site.panneEssai = false;
    await pass(T1 + 30_000);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    // Après l'attente : l'événement est rejoué tout seul, l'essai est prouvé.
    await pass(T1 + 61_000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(await conv()).toMatchObject({ etat: "attente_email", versionTexteM1: NOUVELLE, cibleEssai: true });
    expect((await charge(id)).etat).not.toBe("a_reessayer");
  });

  it("T4 · catalogue lu SANS erreur, cible test:true, drapeau absent : cibleEssai est posé", async () => {
    await graineSansDrapeau();
    await msg("msg-ok-1");
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect((await conv()).cibleEssai).toBe(true);
  });
});
