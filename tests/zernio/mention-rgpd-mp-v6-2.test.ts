/**
 * Mention d'information RGPD, version PROPOSÉE mp-m1-v6-2 (groupe « m1-adresse-rgpd », après mp-m1-v6-1).
 * Jamais utilisée sans la validation du fondateur sur /mots (empreinte exacte) ; v6-1 seule validée : comportement inchangé.
 * Données 100 % fictives ; port et site FAUX.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GROUPES_MP, TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { choisirFormulation } from "@/domaine/guide-reseau/formulations";
import { texteDuDictionnaire } from "@/fournisseurs/publication/zernio-inbox-corps";
import { controlerTexteSortant } from "@/services/mots-controle";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const V1 = "mp-m1-v6-1";
const V2 = "mp-m1-v6-2";
const brut = (id: string) => (TEXTES_MP as Record<string, { version: string; statut: string; texte: string }>)[id];
const rendu = (id: string) => rendreTexteMp(id as never, { mot: "GUIDE", titre: TITRE })!;
const J = (...p: string[]) => p.join("");

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, { formulations?: Record<string, string>; versionTexteM1?: string }>>(C.PARAM_CONVERSATIONS, {}))[cleConversation("auteur-fictif-400")];

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

describe("1 · le texte proposé", () => {
  it("existe, dans le groupe après v6-1 ; v6-1 est inchangée", () => {
    expect(brut(V2).version).toBe(V2);
    expect((GROUPES_MP as Record<string, readonly string[]>)["m1-adresse-rgpd"]).toEqual([V1, V2]);
    expect(brut(V1).texte).toBe("Bonjour ! Merci pour votre commentaire, ça fait plaisir. Pour vous envoyer le guide « [TITRE DU GUIDE] », il me suffit de votre adresse e-mail : répondez-moi simplement ici. Nous notons le mot, le réseau et la publication par lesquels vous nous contactez, pour savoir d'où viennent les demandes. Ces informations sont gardées aussi longtemps que votre fiche de contact. Vous pouvez vous y opposer à tout moment en nous écrivant ici.");
  });
  it("dit qui, pourquoi, combien de temps, les droits, et renvoie vers la politique de confidentialité", () => {
    const t = brut(V2).texte;
    expect(t).toContain("Axion IA");
    expect(t).toMatch(/note le mot, le réseau et la publication/);
    expect(t).toMatch(/pour savoir d'où viennent les demandes/);
    expect(t).toMatch(/aussi longtemps que votre fiche de contact/);
    expect(t).toMatch(/précisée dans la notice/);
    expect(t).toMatch(/opposer/);
    expect(t).toMatch(/accéder/);
    expect(t).toMatch(/effacement/);
    expect(t).toContain("https://axion-ia.com/fr/politique-confidentialite (section « Origine des demandes de guide »)");
    expect(t.match(/https?:\/\//g)).toHaveLength(1); // un seul lien
  });
  it("aucun mot interdit, aucun nom de personne, aucune promesse", () => {
    const t = brut(V2).texte;
    expect(t).not.toMatch(new RegExp(J("abonn"), "i"));
    expect(t.toLowerCase()).not.toContain(J("gren", "oble"));
    expect(t).not.toMatch(/garanti|\bstop\b|automatique|€|\beuros?\b|\bprix\b|@|\b(tu|ton|ta|tes|toi)\b/i);
    expect(t).not.toMatch(/fondateur|will|williams/i);
  });
  it("passe le contrôle de sortie et de conformité du dictionnaire, court (< 600 caractères), rendu sans trou", () => {
    expect(controlerTexteSortant("message_prive", rendu(V2))).toEqual([]);
    expect(texteDuDictionnaire(rendu(V2), false)).toBe(true);
    expect(rendu(V2).length).toBeLessThan(600);
    expect(rendu(V2)).not.toMatch(/\[[A-Z ]+\]/);
  });
});

describe("2 · choix dans le groupe (fonction pure)", () => {
  const choisir = (validees: string[], figee?: string) =>
    choisirFormulation({ groupe: "m1-adresse-rgpd", cleConversation: "c", figee, validees: new Set(validees), rendre: (v) => rendu(v), derniereValidee: true });
  it("v6-1 seule validée : v6-1 ; v6-2 seule : v6-2 ; les deux : la dernière (v6-2) ; aucune : rien", () => {
    expect(choisir([V1])?.version).toBe(V1);
    expect(choisir([V2])?.version).toBe(V2);
    expect(choisir([V1, V2])?.version).toBe(V2);
    expect(choisir([])).toBeNull();
  });
  it("une conversation figée sur v6-1 garde v6-1 même si v6-2 est validée", () => {
    expect(choisir([V1, V2], V1)?.version).toBe(V1);
  });
});

describe("3 · le parcours", () => {
  it("v6-1 seule validée : v6-1 part, comme avant", async () => {
    await validerFormulationsAuParcours([V1]);
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendu(V1));
  });
  it("v6-2 non validée (ou validation périmée) : jamais envoyée", async () => {
    await validerFormulationsAuParcours([V1]);
    await Com.ecrireParametre("parcours.validation.formulations", { ...(await Com.lireParametre<Record<string, unknown>>("parcours.validation.formulations", {})), [V2]: { empreinte: "0".repeat(64), valideLe: "x" } });
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendu(V1));
  });
  it("v6-1 et v6-2 validées : v6-2 part pour une nouvelle conversation", async () => {
    await validerFormulationsAuParcours([V1, V2]);
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendu(V2));
    expect(await etatDe()).toMatchObject({ versionTexteM1: V2 });
  });
  it("aucune conversation déjà figée sur v6-1 n'est basculée quand v6-2 est validée ensuite", async () => {
    await validerFormulationsAuParcours([V1]);
    await deposerCommentaire(depots, {});
    await passer();
    expect((await etatDe())?.formulations).toEqual({ "m1-adresse": V1 });
    await validerFormulationsAuParcours([V1, V2]);
    expect((await etatDe())?.formulations?.["m1-adresse"]).toBe(V1);
  });
});
