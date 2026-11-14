/**
 * PR-B · restes de la relecture de PR-A2 côté garde : la clôture d'une conversation en `pub_ok` (réglage éteint / Instagram) est prouvée,
 * et une conversation qui reste en `guide_demande` après clôture à la reprise est SIGNALÉE à l'opérateur (journal clair, sans identité).
 * Faux Zernio, faux site : aucun réseau, données fictives.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleConversation, deposerCommentaire, deposerMessage, evenement, validerFormulationsAuParcours } from "./aides/conversation";
import { ADRESSE, AUTEUR, banc, Com, COMPTE, depots, ENV, graineConv, lireTexteDe, MS, nettoyer, passer, preparer, T0, TITRE } from "./filet-guide/_amorce";
import { CHEMIN_GUIDE } from "./aides/oppositions";

const site = vi.hoisted(() => ({ versions: new Set<string>(["mp-m1-v4-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"]), catalogue: null as unknown, lectures: [] as Array<number | undefined> }));
const espion = vi.hoisted(() => ({ verifier: 0, multiples: 0 }));
const course = vi.hoisted(() => ({ n: 0, refusDesLeSecondAppel: null as string | null }));
vi.mock("@/services/parcours-dossier", async (orig) => {
  const m = await orig<Record<string, any>>();
  return { ...m, validationPourEnvoi: async (...a: unknown[]) => (++course.n >= 3 && course.refusDesLeSecondAppel !== null ? course.refusDesLeSecondAppel : m.validationPourEnvoi(...a)) };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), siteAccepteVersionM1: (v: string) => site.versions.has(v) }));
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async (o?: { maintenantMs?: number }) => (site.lectures.push(o?.maintenantMs), site.catalogue) }));
vi.mock("@/services/mots-validation-par-mot", async (orig) => {
  const m = await orig<Record<string, any>>();
  return { ...m, verifierMotPourEnvoi: async (...a: unknown[]) => (espion.verifier++, m.verifierMotPourEnvoi(...a)) };
});

const MM = await import("@/services/parcours-mots-multiples");
const V = await import("@/services/mots-validation-par-mot");

const ENV_TITRE = { PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE };
const ENV_LIEN = { ...ENV, ...ENV_TITRE, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: "secret-fictif-du-lien-0123456789-abcdefghij", LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const FORMULATIONS = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1", "mp-deja-envoye-v1-1", "mp-lien-v3-1"];
const CODE = "gde-essai01";
const catalogue = (guideCible = "guide-ia") => ({
  catalogue: [
    { code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false },
    { code: CODE, type: "guide" as const, titre: "Titre essai", actif: true, test: false },
  ],
  liaisons: [
    { mot: "GUIDE", reseau: "tous" as const, codeCible: guideCible, actif: true },
    { mot: "CHATGPT", reseau: "tous" as const, codeCible: CODE, actif: true },
  ],
  luLe: T0, ignores: 0, depuisCopie: false,
});
const registre = async () => {
  const reg: Record<string, unknown> = {};
  for (const mot of ["GUIDE", "CHATGPT"]) reg[`${mot}|${COMPTE}`] = { mot, compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" };
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, reg);
};
const demandes = () => banc.site.vus.filter((r) => r.chemin === CHEMIN_GUIDE);
const conversations = () => Com.lireParametre<Record<string, any>>("parcours.conversations", {});
const journalOperateur = async () => (await depots().evenements.lister((e: any) => e.type === "parcours_conversation")).map((e: any) => e.message as string);

beforeEach(async () => {
  site.lectures.length = 0;
  await preparer();
  await validerFormulationsAuParcours(FORMULATIONS);
  site.catalogue = catalogue();
  await registre();
});
afterEach(() => {
  nettoyer();
  vi.useRealTimers();
});
const decrire = async (id: string) => {
  const e = await evenement(depots, id);
  return { etat: e.charge.etat as string, code: e.charge.dernierCode as string | null, traite: e.traite as boolean };
};

async function validerChatgpt(): Promise<void> {
  const ap = (await V.apercuTextesMot({ mot: "CHATGPT", env: ENV, maintenantMs: T0 })).find((x) => x.reseau === "facebook")!;
  if (!ap.ok) throw new Error(`aperçu refusé : ${ap.raison}`);
  const r = await V.validerTextesMot({ mot: "CHATGPT", reseau: "facebook", empreinteVue: ap.empreinte, confirmeParOperateur: true, env: ENV, maintenantMs: T0 });
  if (!r.ok) throw new Error(r.raison);
}

describe("clôture d'une conversation en pub_ok (garde ~l.973) : événement CLOS, état conservé, aucun message privé", () => {
  it("la garde par mot refuse APRÈS la réponse publique (le réseau du compte a changé entre-temps) : ecarte / garde_instagram_pas_encore, pub_ok reste, même après un rallumage", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await validerChatgpt();
    course.n = 0;
    course.refusDesLeSecondAppel = "instagram_pas_encore"; // 1er appel (réception) et 2e (garde avant la réponse publique) passent ; 3e (garde du message privé, après pub_ok) : refus
    const id = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-pub-ok", motSeul: "CHATGPT", reseau: "facebook" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(course.n).toBeGreaterThanOrEqual(3);
    expect(await decrire(id)).toEqual({ etat: "ecarte", code: "garde_instagram_pas_encore", traite: true });
    expect(Object.values(await conversations())[0]).toMatchObject({ etat: "pub_ok", mot: "CHATGPT" }); // rien n'est effacé
    expect(banc.port.prive).toHaveLength(0);
    expect(demandes()).toHaveLength(0);
    course.refusDesLeSecondAppel = null;
    await passer(T0 + 3 * 24 * 3600_000, { env: ENV_LIEN });
    expect(banc.port.prive).toHaveLength(0); // l'événement est clos : rien ne part des jours après
  });
  it("même scénario, refus « validation_absente » : clos aussi (comportement existant conservé)", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await validerChatgpt();
    course.n = 0;
    course.refusDesLeSecondAppel = "validation_absente";
    const id = await deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: "com-pub-ok2", motSeul: "CHATGPT", reseau: "facebook" });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect(await decrire(id)).toEqual({ etat: "ecarte", code: "validation_absente", traite: true });
    expect(banc.port.prive).toHaveLength(0);
    course.refusDesLeSecondAppel = null;
  });
});

describe("conversation restée en guide_demande après la clôture à la reprise : le journal opérateur le dit clairement", () => {
  it("réglage éteint : la ligne du journal nomme l'état, le motif et la suite ; ni adresse, ni identifiant de personne", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, false);
    await Com.ecrireParametre("parcours.conversations", { [cleConversation(AUTEUR)]: graineConv("guide_demande", { mot: "CHATGPT", guide: CODE, titreCible: "Titre essai", versionTexteM1: "mp-m1-v4-1", idMessageGuide: "msg-j" }) });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-j", idExpediteur: AUTEUR });
    await passer(T0 + 1000, { env: ENV_LIEN });
    const lignes = (await journalOperateur()).filter((m) => /guide_demande/.test(m));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatch(/plusieurs_mots_eteint/);
    expect(lignes[0]).toMatch(/reste en guide_demande/);
    expect(lignes[0]).toMatch(/expire/); // la suite : expiration sous 7 jours, rien d'envoyé
    expect(lignes[0]).not.toContain(AUTEUR);
    expect(lignes[0]).not.toContain(ADRESSE);
    expect(Object.values(await conversations())[0]).toMatchObject({ etat: "guide_demande" });
  });
  it("Instagram pas encore : même signalement avec son motif", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
    await Com.ecrireParametre("parcours.conversations", { [cleConversation(AUTEUR)]: graineConv("guide_demande", { mot: "CHATGPT", guide: CODE, reseau: "instagram", titreCible: "Titre essai", versionTexteM1: "mp-m1-v4-1", idMessageGuide: "msg-j2" }) });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-j2", idExpediteur: AUTEUR });
    await passer(T0 + 1000, { env: ENV_LIEN });
    const lignes = (await journalOperateur()).filter((m) => /guide_demande/.test(m));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatch(/instagram_pas_encore/);
  });
  it("une conversation qui n'est PAS en guide_demande (attente_email) : aucune ligne de ce genre", async () => {
    await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, false);
    await Com.ecrireParametre("parcours.conversations", { [cleConversation(AUTEUR)]: graineConv("attente_email", { mot: "CHATGPT", guide: CODE, titreCible: "Titre essai", versionTexteM1: "mp-m1-v4-1" }) });
    lireTexteDe(ADRESSE);
    await deposerMessage(depots, { idMessage: "msg-j3", idExpediteur: AUTEUR });
    await passer(T0 + 1000, { env: ENV_LIEN });
    expect((await journalOperateur()).filter((m) => /guide_demande/.test(m))).toHaveLength(0);
  });
});
