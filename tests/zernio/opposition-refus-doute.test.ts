/**
 * Correctifs de relecture de la mention RGPD du message privé (PR « mention-rgpd-mp »). Données fictives, port et site FAUX, sans base ni réseau.
 *  D1/N1 : en attente d'adresse, un refus ou une demande de retrait SANS adresse = doute (jamais la relance « adresse non reconnue »).
 *  D2/N2 : « je m'y oppose », « opposée »… = opposition. D4/N3 : contrôle de conformité du texte RGPD. N4 : journal d'une figée non validée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classerOpposition, exprimeUnRefus } from "@/domaine/guide-reseau/opposition";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Le contrôle du dictionnaire peut être rendu refusant pour le texte RGPD (sinon : le vrai contrôle).
const controle = vi.hoisted(() => ({ refuserRgpd: false }));
vi.mock("@/fournisseurs/publication/zernio-inbox-corps", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/fournisseurs/publication/zernio-inbox-corps")>();
  return { ...orig, texteDuDictionnaire: (t: string, ...r: unknown[]) => (controle.refuserRgpd && t.includes("Nous notons") ? false : (orig.texteDuDictionnaire as (...a: unknown[]) => boolean)(t, ...r)) };
});
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const NOUVELLE = "mp-m1-v6-1";
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, { douteOpposition?: boolean; formulations?: Record<string, string>; m2Envoye?: boolean }>>(C.PARAM_CONVERSATIONS, {}))[cleConversation("auteur-fictif-400")];
const journal = async (re: RegExp) => (await depots().evenements.lister((x: any) => re.test(x.message))).length;

beforeEach(async () => {
  controle.refuserRgpd = false;
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

describe("D2/N2 · nouvelles formes d'opposition", () => {
  it.each(["Je m'y oppose", "JE M'Y OPPOSE.", "Je m'oppose à la collecte", "je m oppose a la collecte !", "Je m'oppose au traitement de mes données", "Je suis opposé(e)", "Je suis opposée", "Je suis opposé", "Opposée", "opposee"])("« %s » → opposition", (t) => {
    expect(classerOpposition(t)).toBe("opposition");
  });
  it.each(["Je ne m'oppose pas", "Pas d'opposition", "Je ne m'y oppose pas"])("« %s » → doute (rien ne part)", (t) => {
    expect(classerOpposition(t)).toBe("doute");
  });
});

describe("D1/N1 · refus sans adresse", () => {
  it.each(["Non merci", "Je refuse", "Je suis contre", "Je ne veux pas", "Supprimez mes données", "Effacez tout", "Retirez-moi", "Je m'opose", "Non, merci !"])("« %s » exprime un refus", (t) => {
    expect(exprimeUnRefus(t)).toBe(true);
  });
  it.each(["Mon adresse est a@example.test", "Je veux le guide", "Merci !"])("« %s » n'est pas un refus", (t) => {
    expect(exprimeUnRefus(t)).toBe(false);
  });
  it.each(["Non merci", "Je refuse", "Je suis contre", "Je ne veux pas", "Supprimez mes données", "Je m'opose"])("« %s » en attente d'adresse : pause + alerte, jamais « adresse non reconnue »", async (texte) => {
    await validerFormulationsAuParcours(["mp-m1-v5-3"]);
    await deposerCommentaire(depots, {});
    await passer();
    const avant = port.prive.length;
    port.reponses.texte = () => texte;
    await deposerMessage(depots, { idMessage: "m-refus" });
    await passer(T0 + 1000);
    expect(port.prive.length).toBe(avant); // aucun message de relance
    expect(site.vus.length).toBe(0);
    expect((await etatDe())?.douteOpposition).toBe(true);
    expect((await etatDe())?.m2Envoye).not.toBe(true);
    expect(await journal(/doute|ALERTE/i)).toBeGreaterThan(0);
  });
  it("une vraie réponse avec adresse reste traitée comme avant (demande de guide, pas de doute)", async () => {
    await validerFormulationsAuParcours(["mp-m1-v5-3"]);
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => `Je refuse de payer mais voici ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "m-adr" });
    await passer(T0 + 1000);
    expect(site.vus.length).toBe(1);
  });
});

describe("D4/N3 · le texte RGPD passe le contrôle de conformité", () => {
  it("texte RGPD validé mais refusé par le contrôle : retombe sur la version précédente", async () => {
    await validerFormulationsAuParcours(["mp-m1-v5-3", NOUVELLE]);
    controle.refuserRgpd = true;
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v5-3", { mot: "GUIDE", titre: TITRE }));
  });
});

describe("N4 · journal d'une version RGPD figée dont la validation est retirée", () => {
  it("écrit formulation_figee_non_validee (sans donnée personnelle)", async () => {
    await validerFormulationsAuParcours(["mp-m1-v5-3", NOUVELLE]);
    await deposerCommentaire(depots, {});
    port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" }) as never;
    await passer();
    expect((await etatDe())?.formulations?.["m1-adresse-rgpd"] ?? (await etatDe())?.formulations?.["m1-adresse"]).toBe(NOUVELLE);
    await validerFormulationsAuParcours(["mp-m1-v5-3"]); // la validation de la version RGPD est retirée
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" }) as never;
    await passer(T0 + 3_600_000);
    expect(await journal(/formulation_figee_non_validee/)).toBeGreaterThan(0);
    expect(await journal(/@|example\.test/)).toBe(0);
  });
});
