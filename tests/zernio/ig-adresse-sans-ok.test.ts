/**
 * Instagram « suivre le compte puis OK », cible d'ESSAI : une adresse écrite SANS OK vaut un OK (demande d'adresse v6-1, jamais un lien ni mp-m1-v2).
 * L'adresse de CE message n'est pas envoyée au site (donnée avant la mention d'information) ; la personne la renverra. Vraie cible et réglages éteints : inchangés.
 * Même préparation que ig-essai-adresse.test.ts ; données 100 % fictives ; aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleParcours } from "@/domaine/guide-reseau/cles-parcours";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { CHEMIN_GUIDE } from "./aides/oppositions";
import { ADRESSE_FICTIVE, cleConversation, deposerCommentaire as deposerCommentaireAide, deposerMessage as deposerMessageAide, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { AUTEUR, banc, C, Com, COMPTE, depots, ENV, graineConv, lireTexteDe, MS, nettoyer, passer, preparer, T0, TITRE, toutesLesConversations } from "./filet-guide/_amorce";

const site = vi.hoisted(() => ({ versions: new Set<string>(["mp-m1-v4-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", "mp-m1-v6-1"]), catalogue: null as unknown, panneEssai: false, pannes: 0, lieux: [] as string[], lectures: 0, course: false }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => {
    // Panne de lecture limitée à l'appel de la fonction qui décide « cible d'essai du jour » (les autres lectures réussissent).
    // `pannes` / `lieux` prouvent que la panne s'est déclenchée DANS la fonction visée (pas seulement qu'une regex a trouvé un mot dans la pile).
    const lieu = /at (?:async )?(statutEssaiCatalogue|cibleEstEssaiAujourdhui)\b/.exec(new Error().stack ?? "");
    // Course : la lecture faite DANS `repondreOkInstagram` (filtre) échoue une fois, puis le catalogue redevient lisible avec « non » (cible plus d'essai).
    if (site.course && /at (?:async )?repondreOkInstagram\b/.test(new Error().stack ?? "")) { site.course = false; site.catalogue = catalogue(false); site.pannes++; throw new Error("catalogue en panne (fictif, course)"); }
    if (site.panneEssai && lieu) { site.pannes++; site.lieux.push(lieu[1]); throw new Error("catalogue en panne (fictif)"); }
    site.lectures++;
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
const ADR = `Mon adresse : ${ADRESSE_FICTIVE}`;
const SEED = (suffixe: string, extra: Record<string, unknown> = {}) => ({
  reseau: "instagram", cleIdempotenceGuide: suffixe.padEnd(64, "0"), idCommentaire: `com-graine-${suffixe}`, mot: MOT, guide: CODE, nature: "premier", groupeM1: "m1-lien", titreCible: TITRE_ESSAI,
  versionTexteM1: "mp-ig-suivre-v1-1", formulations: { "ig-suivre": "mp-ig-suivre-v1-1" }, creeLe: iso(T0 - 2 * H), m1Le: iso(T0 - 2 * H + 1000), derniereActiviteLe: iso(T0 - 1000), ...extra,
});
const grainer = async (graines: Array<{ suffixe: string; etat?: string; extra?: Record<string, unknown> }>) => {
  const o: Record<string, unknown> = {};
  for (const g of graines) o[cleParcours(cleConversation(AUTEUR), g.suffixe.padEnd(64, "0"))] = graineConv(g.etat ?? "ig_attente_ok", SEED(g.suffixe, g.extra));
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, o);
};
const parSuffixe = async (s: string) => (await toutesLesConversations())[cleParcours(cleConversation(AUTEUR), s.padEnd(64, "0"))];
const nbAlertesNonReconnu = async () => (await depots().evenements.lister((e: any) => /réponse non reconnue/.test(e.message))).length;
/** Textes par idMessage (plusieurs messages de contenus différents). */
const textes = (t: Record<string, string>) => {
  (banc.port.port as any).lireMessage = async (p: any) => (banc.port.lire++, { texte: t[p.idMessage] ?? null, postback: null });
};
const apresIgSuivre = async () => {
  await com(MOT);
  await pass(T0);
  expect(banc.port.prive).toHaveLength(1);
};

beforeEach(async () => {
  await preparer();
  site.versions = new Set(["mp-m1-v4-1", "mp-lien-v3-1", "mp-deja-envoye-v1-1", NOUVELLE]);
  site.catalogue = catalogue();
  site.panneEssai = false;
  site.pannes = 0;
  site.lieux = [];
  site.lectures = 0;
  site.course = false;
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

describe("Adresse écrite sans OK (cible d'essai) : vaut un OK, la demande d'adresse v6-1 part, l'adresse de ce message n'est pas envoyée", () => {
  it("C1 · suit déjà : adresse → 1 envoi = v6-1 (sans http), 0 demande au site, attente_email, adresseIgLe, idMessageOk, cibleEssai ; événement envoyé ; aucune alerte « non reconnue »", async () => {
    await apresIgSuivre();
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(banc.port.envoyes[0].texte).not.toMatch(/https?:|\[LIEN\]/i);
    expect(demandes()).toHaveLength(0);
    const c = await conv();
    expect(c).toMatchObject({ etat: "attente_email", versionTexteM1: NOUVELLE, idMessageOk: "msg-adr", cibleEssai: true });
    expect(typeof c.adresseIgLe).toBe("string");
    expect(c.lienIgLe).toBeUndefined();
    expect(await charge(id)).toMatchObject({ etat: "envoye" });
    expect(await nbAlertesNonReconnu()).toBe(0);
    expect(JSON.stringify(await toutesLesConversations())).not.toContain(ADRESSE_FICTIVE);
  });

  it("C2 · suite : une nouvelle adresse dans un nouveau message → 1 demande au site (code de la cible, v6-1) et l'accusé part", async () => {
    await apresIgSuivre();
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1);
    await msg("msg-adr-2", 30_000);
    await pass(T1 + 40_000);
    expect(demandes()).toHaveLength(1);
    expect(JSON.parse(demandes()[0].corps)).toMatchObject({ guide: CODE, mot: MOT, reseau: "instagram", versionTexteM1: NOUVELLE });
    expect(banc.port.envoyes).toHaveLength(2); // v6-1 puis accusé
  });

  it("C3 · ne suit pas : adresse → « pas encore » (1 envoi), 0 demande ; puis OK → v6-1", async () => {
    (banc.port.port as any).lireSuiviInstagram = async () => (suivi.appels++, { statut: "ne_suit_pas" });
    await apresIgSuivre();
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp("mp-ig-pas-encore-v1-1", { mot: MOT, titre: TITRE_ESSAI }));
    expect(demandes()).toHaveLength(0);
    expect((await conv()).etat).toBe("ig_pas_encore");
    lireTexteDe("OK");
    await msg("msg-ok-2", 20_000);
    await pass(T1 + 30_000);
    expect(banc.port.envoyes).toHaveLength(2);
    expect(banc.port.envoyes[1].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(demandes()).toHaveLength(0);
  });

  it("C4 · « Stop » + adresse : 0 envoi, 0 demande ; doute posé (douteOpposition), silence/doute_opposition", async () => {
    await apresIgSuivre();
    lireTexteDe(`Stop ${ADRESSE_FICTIVE}`);
    const id = await msg("msg-stop", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    // « Stop » + adresse : le classement donne un DOUTE (pas une opposition nette) : parcours en pause, silence/doute_opposition, rien ne part.
    expect(await conv()).toMatchObject({ etat: "ig_attente_ok", douteOpposition: true });
    expect(await charge(id)).toMatchObject({ etat: "silence", dernierCode: "doute_opposition" });
  });

  it("C5 · refus + adresse (« non merci ») : 0 envoi, clos ecarte/ok_non_reconnu", async () => {
    await apresIgSuivre();
    lireTexteDe(`non merci ${ADRESSE_FICTIVE}`);
    const id = await msg("msg-refus", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "ok_non_reconnu" });
  });

  it("C6 · VRAI GUIDE en ig_attente_ok + adresse : 0 envoi, clos ecarte/ok_non_reconnu", async () => {
    await com("GUIDE");
    await pass(T0);
    expect((await conv()).etat).toBe("ig_attente_ok");
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "ecarte", dernierCode: "ok_non_reconnu" });
  });

  it("C7 · dossier mixte (essai + GUIDE réel en ig_attente_ok) + adresse : 1 seul envoi (v6-1) ; le GUIDE reste en attente, sans idMessageOk ; aucun http", async () => {
    await grainer([{ suffixe: "a" }, { suffixe: "b", extra: { mot: "GUIDE", guide: "guide-ia", titreCible: TITRE, creeLe: iso(T0 - 3 * H), m1Le: iso(T0 - 3 * H + 1000) } }]);
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(JSON.stringify(banc.port.envoyes)).not.toMatch(/https?:/);
    expect(demandes()).toHaveLength(0);
    expect(await parSuffixe("a")).toMatchObject({ etat: "attente_email", idMessageOk: "msg-adr" });
    const guide = await parSuffixe("b");
    expect(guide.etat).toBe("ig_attente_ok");
    expect(guide.idMessageOk).toBeUndefined();
  });

  it("C8 · v6-1 non validée : 0 envoi, alerte, ignore/adresse_indisponible, parcours consommé", async () => {
    await apresIgSuivre();
    await validerFormulationsAuParcours(FORM.filter((x) => x !== NOUVELLE));
    const { creerNotification } = await import("@/services/notifications");
    vi.mocked(creerNotification).mockClear();
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(vi.mocked(creerNotification)).toHaveBeenCalled();
    expect(await charge(id)).toMatchObject({ etat: "ignore", dernierCode: "adresse_indisponible" });
    expect(await conv()).toMatchObject({ etat: "ig_attente_ok", idMessageOk: "msg-adr", okRecus: 1 });
    expect(demandes()).toHaveLength(0);
  });

  it("C9 · trois relances récentes (m1Le, pasEncoreLe, lienIgLe) : 0 envoi, plafond_personne", async () => {
    await grainer([{ suffixe: "a", extra: { m1Le: iso(T0 - 3 * H), pasEncoreLe: iso(T0 - 2 * H), lienIgLe: iso(T0 - H) } }]);
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(JSON.stringify(await charge(id))).toContain("plafond_personne");
  });

  it("C10 · même idMessage déposé deux fois : 1 seul v6-1, 0 demande", async () => {
    await apresIgSuivre();
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await msg("msg-adr", 5100);
    await pass(T1);
    await pass(T1 + 20_000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(demandes()).toHaveLength(0);
  });

  it("C11 · P1 attente_email avec idMessageOk = msg-adr, P2 d'essai ig_attente_ok : 0 demande au site pour ce message ; P2 reçoit v6-1", async () => {
    await grainer([
      { suffixe: "a", etat: "attente_email", extra: { m1Le: iso(T0 - 30 * H), versionTexteM1: NOUVELLE, idMessageOk: "msg-adr", adresseIgLe: iso(T0 - 5000), cibleEssai: true, formulations: { "m1-adresse": NOUVELLE } } },
      { suffixe: "b", extra: { creeLe: iso(T0 - H), m1Le: iso(T0 - H + 1000) } },
    ]);
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1);
    expect(demandes()).toHaveLength(0);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(await parSuffixe("b")).toMatchObject({ etat: "attente_email", idMessageOk: "msg-adr" });
  });

  it("C12 · activité de plus de 23 h : 0 envoi, parcours consommé", async () => {
    await grainer([{ suffixe: "a", extra: { derniereActiviteLe: iso(T1 - 25 * H), creeLe: iso(T1 - 26 * H), m1Le: iso(T1 - 26 * H) } }]);
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T0 + 25 * H);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await conv()).toMatchObject({ idMessageOk: "msg-adr" });
  });

  it("C13 · réglage « suivre » éteint, ig_attente_ok semé, adresse : silence/ig_eteint ; la décision « adresse vaut OK » ne relit pas le catalogue (même nombre de lectures qu'un message sans adresse)", async () => {
    await grainer([{ suffixe: "a" }]);
    await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, false);
    textes({ "msg-base": "bonjour", "msg-adr": ADR });
    await msg("msg-base", 5000);
    site.lectures = 0;
    await pass(T1);
    const base = site.lectures; // lecture de base mesurée sur un message SANS adresse
    const id = await msg("msg-adr", 20_000);
    site.lectures = 0;
    await pass(T1 + 30_000);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "silence", dernierCode: "ig_eteint" });
    expect(site.lectures).toBe(base);
  });

  // Déblocage venu de la PR #923 : avant, les deux événements se reportaient l'un l'autre (stop_anterieur_non_lu) et rien ne partait ; maintenant l'adresse envoie UNE v6-1.
  // Le OK, arrivé quand le parcours est en attente_email, reçoit l'accusé « adresse non reconnue » (comportement d'aval préexistant, accepté par le fondateur).
  it("C15 · adresse puis OK à 1 s (déblocage PR #923) : exactement 2 envois (v6-1 puis accusé « adresse non reconnue »), un seul v6-1, 0 demande, rien de bloqué à T1 + 2 min", async () => {
    await apresIgSuivre();
    textes({ "msg-adr": ADR, "msg-ok": "OK" });
    await msg("msg-adr", 5000);
    await msg("msg-ok", 6000);
    for (const d of [T1, T1 + 30_000, T1 + 2 * 60_000, T1 + 5 * 60_000, T1 + 15 * 60_000]) await pass(d);
    const v61 = rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI });
    const e = banc.port.envoyes as Array<{ texte: string }>;
    expect(e).toHaveLength(2);
    expect(e[0].texte).toBe(v61);
    expect(e[0].texte).not.toMatch(/https?:|\[LIEN\]/i);
    expect(e[1].texte).toMatch(/Je n'ai pas reconnu d'adresse e-mail/);
    expect(e.filter((x) => x.texte === v61)).toHaveLength(1);
    expect(demandes()).toHaveLength(0);
    expect(await conv()).toMatchObject({ idMessageOk: "msg-adr" });
    const bloques = await depots().evenementsFournisseurs.lister((x: any) => x.charge?.dernierCode === "stop_anterieur_non_lu");
    expect(bloques).toHaveLength(0);
  });

  it("C16 · essai seulement SUPPOSÉ (panne de lecture du catalogue au moment de l'adresse) : rien ne part, report catalogue_illisible ; reprise après l'attente", async () => {
    await grainer([{ suffixe: "a" }]);
    site.panneEssai = true;
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    expect(site.pannes).toBeGreaterThan(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    expect((await parSuffixe("a")).etat).toBe("ig_attente_ok");
    site.panneEssai = false;
    await pass(T1 + 61_000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(await parSuffixe("a")).toMatchObject({ etat: "attente_email", cibleEssai: true });
  });

  it("C16b · catalogue en panne ET la personne NE SUIT PAS le compte + adresse : 0 envoi (ni « pas encore », ni lien), report catalogue_illisible, rien consommé", async () => {
    (banc.port.port as any).lireSuiviInstagram = async () => (suivi.appels++, { statut: "ne_suit_pas" });
    await grainer([{ suffixe: "a" }]);
    site.panneEssai = true;
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    expect(site.pannes).toBeGreaterThan(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    const a = await parSuffixe("a");
    expect(a.etat).toBe("ig_attente_ok");
    expect(a.idMessageOk).toBeUndefined();
  });

  it("C16c · course : catalogue illisible à la lecture du filtre puis lisible avec « non » : 0 envoi, jamais de lien, report catalogue_illisible", async () => {
    await grainer([{ suffixe: "a" }]);
    site.course = true;
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    expect(site.pannes).toBeGreaterThan(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(JSON.stringify(banc.port.envoyes)).not.toMatch(/https?:/);
    expect(demandes()).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    expect((await parSuffixe("a")).idMessageOk).toBeUndefined();
  });

  it("C7b · dossier mixte où le GUIDE réel est le plus RÉCENT et l'essai plus ancien + adresse : 1 seul envoi v6-1 pour l'essai ; le GUIDE reste intact (sans idMessageOk)", async () => {
    await grainer([
      { suffixe: "a", extra: { creeLe: iso(T0 - 3 * H), m1Le: iso(T0 - 3 * H + 1000) } },
      { suffixe: "b", extra: { mot: "GUIDE", guide: "guide-ia", titreCible: TITRE, creeLe: iso(T0 - H), m1Le: iso(T0 - H + 1000) } },
    ]);
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(JSON.stringify(banc.port.envoyes)).not.toMatch(/https?:/);
    expect(demandes()).toHaveLength(0);
    expect(await parSuffixe("a")).toMatchObject({ etat: "attente_email", idMessageOk: "msg-adr" });
    const guide = await parSuffixe("b");
    expect(guide.etat).toBe("ig_attente_ok");
    expect(guide.idMessageOk).toBeUndefined();
  });

  it("C6b · R3 : auteur non listé (réglage public éteint), dossier essai + GUIDE réel + adresse : 0 envoi ; le GUIDE n'est PAS consommé (ni idMessageOk, ni okRecus)", async () => {
    await grainer([
      { suffixe: "a" },
      { suffixe: "b", extra: { mot: "GUIDE", guide: "guide-ia", titreCible: TITRE, creeLe: iso(T0 - 3 * H), m1Le: iso(T0 - 3 * H + 1000) } },
    ]);
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1, { ...ENV_X, PARCOURS_ESSAI_AUTEURS: "auteur-autre-fictif" });
    expect(banc.port.envoyes).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    const guide = await parSuffixe("b");
    expect(guide.etat).toBe("ig_attente_ok");
    expect(guide.idMessageOk).toBeUndefined();
    expect(guide.okRecus ?? 0).toBe(0);
  });

  it("C17 · adresse en ig_pas_encore (la personne ne suivait pas, suit maintenant) : 1 envoi = v6-1, 0 demande au site", async () => {
    await grainer([{ suffixe: "a", etat: "ig_pas_encore", extra: { pasEncoreLe: iso(T0 - 500), essaisSuivi: 0 } }]);
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(demandes()).toHaveLength(0);
    expect(await parSuffixe("a")).toMatchObject({ etat: "attente_email", idMessageOk: "msg-adr" });
  });
});

describe("Réserves non bloquantes de la PR #910 (A1, A2, A3, A6) : statut d'essai « supposé » et plafond de 3 parcours", () => {
  // m1Le absent : les messages déjà envoyés comptent dans le plafond par personne (3), ces parcours de remplissage ne doivent pas le saturer.
  const vieux = { creeLe: iso(T0 - 5 * H), m1Le: null };
  const GUIDE_REEL = { mot: "GUIDE", guide: "guide-ia", titreCible: TITRE };

  it("A1 · parcours « supposé » hors fenêtre de 24 h : reporté catalogue_illisible, NON consommé (ni idMessageOk, ni okRecus) ; au retour du catalogue, consommé une seule fois", async () => {
    await grainer([{ suffixe: "a", extra: { derniereActiviteLe: iso(T1 - 25 * H), creeLe: iso(T1 - 26 * H), m1Le: iso(T1 - 26 * H) } }]);
    site.panneEssai = true;
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T0 + 25 * H);
    expect(site.pannes).toBeGreaterThan(0);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    const a = await parSuffixe("a");
    expect(a.idMessageOk).toBeUndefined();
    expect(a.okRecus ?? 0).toBe(0);
    site.panneEssai = false;
    await pass(T0 + 25 * H + 61_000);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await parSuffixe("a")).toMatchObject({ idMessageOk: "msg-adr", okRecus: 1 });
  });

  it("A2 · trois parcours non-essai plus anciens + un parcours d'essai plus récent + adresse : le filtre d'essai passe AVANT la limite de 3, l'essai reçoit v6-1, aucune alerte « non reconnue »", async () => {
    await grainer([
      { suffixe: "a" },
      { suffixe: "b", extra: { ...GUIDE_REEL, ...vieux } },
      { suffixe: "c", extra: { ...GUIDE_REEL, ...vieux } },
      { suffixe: "d", extra: { ...GUIDE_REEL, ...vieux } },
    ]);
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(banc.port.envoyes[0].texte).toBe(rendreTexteMp(NOUVELLE, { mot: MOT, titre: TITRE_ESSAI }));
    expect(await parSuffixe("a")).toMatchObject({ etat: "attente_email", idMessageOk: "msg-adr" });
    for (const s of ["b", "c", "d"]) {
      const g = await parSuffixe(s);
      expect(g.etat).toBe("ig_attente_ok");
      expect(g.idMessageOk).toBeUndefined();
    }
    expect(await nbAlertesNonReconnu()).toBe(0);
  });

  it("A6 · panne durable du catalogue, parcours « supposé » : le report a lieu AVANT la lecture du suivi (0 lecture à chaque report de 60 s)", async () => {
    await grainer([{ suffixe: "a" }]);
    site.panneEssai = true;
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    await pass(T1 + 61_000);
    await pass(T1 + 122_000);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    expect(suivi.appels).toBe(0);
    expect(banc.port.envoyes).toHaveLength(0);
  });

  it("A3 · essai « prouvé » + essai « supposé » dans le même événement, catalogue en panne : rien ne part avant le report (pas d'envoi suivi d'un report) ; au retour du catalogue, les deux sont servis, aucune fausse alerte « non reconnue »", async () => {
    await grainer([
      { suffixe: "a", extra: { cibleEssai: true } },
      { suffixe: "b", extra: { creeLe: iso(T0 - H), m1Le: null } },
    ]);
    site.panneEssai = true;
    lireTexteDe(ADR);
    const id = await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(0);
    expect(await charge(id)).toMatchObject({ etat: "a_reessayer", dernierCode: "catalogue_illisible" });
    site.panneEssai = false;
    await pass(T1 + 61_000);
    expect(banc.port.envoyes).toHaveLength(2);
    expect(await nbAlertesNonReconnu()).toBe(0);
    expect(await charge(id)).not.toMatchObject({ dernierCode: "ok_non_reconnu" });
  });

  it("A3b · rejeu du même message après un envoi à l'essai, un GUIDE réel restant en attente : pas de fausse alerte « réponse non reconnue », pas de clôture « ecarte »", async () => {
    await grainer([
      { suffixe: "a" },
      { suffixe: "b", extra: { ...GUIDE_REEL, ...vieux } },
    ]);
    lireTexteDe(ADR);
    await msg("msg-adr", 5000);
    await pass(T1);
    expect(banc.port.envoyes).toHaveLength(1);
    // Rejeu : l'événement est remis à traiter (comme après un plantage avant la clôture), le message a déjà servi l'essai.
    const evs = await depots().evenementsFournisseurs.lister(() => true);
    for (const e of evs as any[]) if (e.traite) await depots().evenementsFournisseurs.modifier(e.id, { traite: false, charge: { ...e.charge, etat: "a_reessayer", prochainEssaiLe: T1 } });
    await pass(T1 + 30_000);
    expect(banc.port.envoyes).toHaveLength(1);
    expect(await nbAlertesNonReconnu()).toBe(0);
    const clos = await depots().evenementsFournisseurs.lister((x: any) => x.charge?.dernierCode === "ok_non_reconnu");
    expect(clos).toHaveLength(0);
  });
});
