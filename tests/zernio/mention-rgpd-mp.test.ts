/**
 * Mention d'information RGPD dans le message privé « sans page » (la personne donne son adresse en réponse).
 * Nouvelle version PROPOSÉE : mp-m1-v6-1 (groupe « m1-adresse-rgpd »). Elle n'est utilisée que si le fondateur l'a validée sur /mots.
 * Tant qu'elle ne l'est pas, l'ancienne version validée (ou mp-m1-v2) part, à l'octet, et le corps envoyé au site ne change pas.
 * Données 100 % fictives ; port et site FAUX.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GROUPES_MP, TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { controlerTexteSortant } from "@/services/mots-controle";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const NOUVELLE = "mp-m1-v6-1";
const GROUPE = "m1-adresse-rgpd";
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
  it("existe, actif, dans son propre groupe ; le groupe m1-adresse reste intact (4 versions, même ordre)", () => {
    expect(brut(NOUVELLE)).toBeDefined();
    expect(brut(NOUVELLE).version).toBe(NOUVELLE);
    expect(brut(NOUVELLE).statut).toBe("actif");
    expect((GROUPES_MP as Record<string, readonly string[]>)[GROUPE]).toEqual([NOUVELLE, "mp-m1-v6-2"]);
    expect(GROUPES_MP["m1-adresse"]).toEqual(["mp-m1-v5-1", "mp-m1-v5-2", "mp-m1-v5-3", "mp-m1-v5-4"]);
  });
  it("garde les 4 éléments de la mention : origine de la demande, finalité, droit d'opposition, contact", () => {
    const t = brut(NOUVELLE).texte.toLowerCase();
    expect(t).toMatch(/nous notons le mot, le réseau et la publication/); // origine, même formule que la page du site
    expect(t).toMatch(/pour savoir d'où viennent les demandes/); // finalité
    expect(t).toMatch(/aussi longtemps que votre fiche de contact/); // durée, comme en ligne
    expect(t).toMatch(/opposer à tout moment/); // opposition
    expect(t).toMatch(/en nous écrivant ici|en nous répondant ici/); // contact = cette conversation
    expect(t).toContain("[titre du guide]");
    expect(t).toMatch(/adresse e-mail/); // le message demande toujours l'adresse
  });
  it("ne contient aucun mot interdit (abonné, nom de ville interdit, gain garanti, stop, automatique, prix) ni adresse e-mail ni jargon", () => {
    const t = brut(NOUVELLE).texte;
    expect(t).not.toMatch(new RegExp(J("abonn"), "i"));
    expect(t.toLowerCase()).not.toContain(J("gren", "oble"));
    expect(t).not.toMatch(/gains? garantis?|garanti/i);
    expect(t).not.toMatch(/\bstop\b/i);
    expect(t).not.toMatch(/automatique/i);
    expect(t).not.toMatch(/€|\beuros?\b|\bprix\b|\btarifs?\b/i);
    expect(t).not.toMatch(/RGPD|règlement|base légale|traitement de données|responsable de traitement/i);
    expect(t).not.toMatch(/@/);
    expect(t).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
  });
  it("passe le contrôle de sortie, reste court (< 600 caractères) et se rend sans trou", () => {
    expect(controlerTexteSortant("message_prive", rendu(NOUVELLE))).toEqual([]);
    expect(rendu(NOUVELLE).length).toBeLessThan(600);
    expect(rendu(NOUVELLE)).not.toMatch(/\[[A-Z ]+\]/);
  });
});

describe("2 · le gardien : la validation du fondateur", () => {
  it("non validée, aucune autre : l'ancien mp-m1-v2 part, à l'octet", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
  });
  it("non validée, l'ancienne version validée (mp-m1-v5-3) reste en service, figée comme avant", async () => {
    await validerFormulationsAuParcours(["mp-m1-v5-3"]);
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendu("mp-m1-v5-3"));
    expect(await etatDe()).toMatchObject({ versionTexteM1: "mp-m1-v5-3", formulations: { "m1-adresse": "mp-m1-v5-3" } });
    expect(port.prive[0].texte).not.toContain("Nous notons");
  });
  it("une validation périmée de la nouvelle version (mauvaise empreinte) ne compte pas", async () => {
    await Com.ecrireParametre("parcours.validation.formulations", { "mp-m1-v5-3": { empreinte: "0".repeat(64), valideLe: "x" }, [NOUVELLE]: { empreinte: "0".repeat(64), valideLe: "x" } });
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE }));
  });
  it("une fois validée par le fondateur, la nouvelle version part (et seulement alors)", async () => {
    await validerFormulationsAuParcours(["mp-m1-v5-3", NOUVELLE]);
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(rendu(NOUVELLE));
    expect(await etatDe()).toMatchObject({ versionTexteM1: NOUVELLE });
  });
  it("une conversation déjà figée sur une ancienne version la garde, même si la nouvelle est validée ensuite", async () => {
    await validerFormulationsAuParcours(["mp-m1-v5-3"]);
    await deposerCommentaire(depots, {});
    await passer();
    expect((await etatDe())?.formulations).toEqual({ "m1-adresse": "mp-m1-v5-3" });
    await validerFormulationsAuParcours(["mp-m1-v5-3", NOUVELLE]);
    expect((await etatDe())?.formulations?.["m1-adresse"]).toBe("mp-m1-v5-3");
  });
});

describe("3 · le corps envoyé au site ne change pas", () => {
  const corpsApresAdresse = async (validees: readonly string[], perimee = false): Promise<Record<string, unknown> | undefined> => {
    reinitialiserDepots();
    C.reinitialiserParcoursConversation();
    pm.reinitialiserGardesParcours();
    site = fauxSite();
    pm.injecterTransportSite(site.transport);
    port = fauxPort();
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
    await validerGuideAuParcours();
    await validerFormulationsAuParcours(validees);
    if (perimee) await Com.ecrireParametre("parcours.validation.formulations", { ...(await Com.lireParametre<Record<string, unknown>>("parcours.validation.formulations", {})), [NOUVELLE]: { empreinte: "0".repeat(64), valideLe: "x" } });
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "m-b" });
    await passer(T0 + 1000);
    const brutCorps = site.vus[0]?.corps as unknown;
    const o = (typeof brutCorps === "string" ? JSON.parse(brutCorps) : brutCorps) as Record<string, unknown> | undefined;
    // La clé d'idempotence est propre à chaque conversation d'essai (non rejouable d'un essai à l'autre) : seul son format est contrôlé.
    expect(String(o?.cleIdempotence)).toMatch(/^[0-9a-f]{64}$/);
    return o ? { ...o, cleIdempotence: "<clé>" } : undefined;
  };
  it("non validée : même corps, octet pour octet, que sans la nouvelle version ; champs transmis connus ; jamais de référence de commentaire", async () => {
    const avant = await corpsApresAdresse(["mp-m1-v5-3"]);
    const nonValidee = await corpsApresAdresse(["mp-m1-v5-3"], true); // validation périmée de la nouvelle version = non validée
    expect(avant).toBeDefined();
    expect(JSON.stringify(nonValidee)).toBe(JSON.stringify(avant));
    expect(Object.keys(avant!).sort()).toEqual(["cleIdempotence", "email", "guide", "locale", "mot", "occurredAt", "reseau", "schemaVersion", "versionTexteM1"]);
    expect(avant!.versionTexteM1).toBe("mp-m1-v5-3");
    const brutJson = JSON.stringify(avant);
    expect(brutJson).not.toMatch(/commentaire_?id|id_?commentaire|comment_?ref|commentRef|commentId/i);
    expect(brutJson).not.toContain("Nous notons"); // le texte du message privé n'est jamais dans le corps du site
  });
  it("une fois validée : mêmes champs, seule la version du texte (preuve) change ; toujours aucune référence de commentaire", async () => {
    const avant = await corpsApresAdresse(["mp-m1-v5-3"]);
    const apres = await corpsApresAdresse(["mp-m1-v5-3", NOUVELLE]);
    expect(Object.keys(apres!).sort()).toEqual(Object.keys(avant!).sort());
    const diff = Object.keys(avant!).filter((k) => JSON.stringify(avant![k]) !== JSON.stringify(apres![k])).sort();
    expect(diff).toEqual(["versionTexteM1"]);
    expect(apres!.versionTexteM1).toBe(NOUVELLE);
    expect(JSON.stringify(apres)).not.toMatch(/commentaire_?id|id_?commentaire|comment_?ref|commentRef|commentId/i);
    expect(JSON.stringify(apres)).not.toContain("Nous notons");
  });
});
