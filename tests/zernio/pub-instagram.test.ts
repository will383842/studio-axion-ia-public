/**
 * C3-b · réponse publique Instagram : groupe « pub-instagram » quand une formulation est VALIDÉE, sinon « mp-pub-igfb-v1 » inchangé.
 * Facebook inchangé. Données fictives ; port faux.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GROUPES_PAR_RESEAU } from "@/domaine/guide-reseau/empreinte-mot";
import { GROUPES_MP, TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

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

const P1 = "mp-pub-ig-v1-1";
const P2 = "mp-pub-ig-v1-2";
const TEXTE_P1 = "Merci pour votre commentaire ! Je vous écris en message privé. Si votre compte est privé ou si vous ne suivez pas le compte, le message peut se trouver dans vos demandes de messages.";
const TEXTE_P2 = "Merci ! Je vous écris en message privé. Pour le voir plus facilement, vous pouvez suivre le compte ; sinon, regardez dans vos demandes de messages.";
const ANCIEN = rendreTexteMp("mp-pub-igfb-v1", {});
const A = "auteur-fictif-400";
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, { formulations?: Record<string, string> }>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];

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

describe("C3-b · dictionnaire et écran /mots", () => {
  it("deux formulations actives, mot pour mot, dans le groupe pub-instagram", () => {
    expect(GROUPES_MP["pub-instagram"]).toEqual([P1, P2]);
    expect(TEXTES_MP[P1].texte).toBe(TEXTE_P1);
    expect(TEXTES_MP[P2].texte).toBe(TEXTE_P2);
    for (const v of [P1, P2]) expect((TEXTES_MP as Record<string, { statut?: string }>)[v].statut, v).toBe("actif");
  });
  it("pub-instagram est rendu sur /mots pour Instagram seulement ; pub-commentaire n'est plus listé pour Instagram (PR #1084)", () => {
    expect(GROUPES_PAR_RESEAU.instagram).toContain("pub-instagram");
    expect(GROUPES_PAR_RESEAU.facebook).not.toContain("pub-instagram");
    expect(GROUPES_PAR_RESEAU.instagram).not.toContain("pub-commentaire");
    expect(GROUPES_PAR_RESEAU.facebook).toContain("pub-commentaire");
  });
});

describe("C3-b · réponse publique", () => {
  it("Instagram, aucune formulation pub-instagram validée : mp-pub-igfb-v1 exact, rien noté", async () => {
    await deposerCommentaire(depots, { reseau: "instagram" });
    await passer();
    expect(port.pub).toHaveLength(1);
    expect(port.pub[0].texte).toBe(ANCIEN);
    expect((await etatDe())?.formulations?.["pub-instagram"]).toBeUndefined();
  });
  it("Instagram, P1 seule validée : le texte public est exactement P1, version notée", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", P1]);
    await deposerCommentaire(depots, { reseau: "instagram" });
    await passer();
    expect(port.pub).toHaveLength(1);
    expect(port.pub[0].texte).toBe(TEXTE_P1);
    expect((await etatDe())?.formulations?.["pub-instagram"]).toBe(P1);
  });
  it("Instagram, P2 seule validée : exactement P2", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", P2]);
    await deposerCommentaire(depots, { reseau: "instagram" });
    await passer();
    expect(port.pub[0].texte).toBe(TEXTE_P2);
  });
  it("la formulation figée est gardée au réessai : un vrai échec d'envoi, puis un réessai avec le même texte noté", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", P1, P2]);
    await deposerCommentaire(depots, { reseau: "instagram" });
    let n = 0;
    port.reponses.pub = () => (++n < 2 ? { statut: "a_reessayer", code: "debit", reessayerApresSec: 1 } : { statut: "envoye", idMessage: "msg-pub-fictif" });
    await passer();
    expect(port.pub).toHaveLength(1); // premier envoi : échec
    const fige = (await etatDe())?.formulations?.["pub-instagram"];
    expect([P1, P2]).toContain(fige);
    await passer(T0 + 60_000); // réessai
    expect(port.pub).toHaveLength(2);
    expect(port.pub[1].texte).toBe(port.pub[0].texte);
    expect(port.pub[0].texte).toBe(fige === P1 ? TEXTE_P1 : TEXTE_P2);
    expect((await etatDe())?.formulations?.["pub-instagram"]).toBe(fige);
    await passer(T0 + 120_000); // réussi : plus de nouvelle réponse
    expect(port.pub).toHaveLength(2);
  });
  it.each([
    [P1, TEXTE_P1],
    [P2, TEXTE_P2],
  ])("figée au réessai : %s validée seule au premier essai, puis les deux validées : le réessai envoie exactement le texte figé, pas le texte courant", async (figee, texteFige) => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", figee]);
    await deposerCommentaire(depots, { reseau: "instagram" });
    let n = 0;
    port.reponses.pub = () => (++n < 2 ? { statut: "a_reessayer", code: "debit", reessayerApresSec: 1 } : { statut: "envoye", idMessage: "msg-pub-fictif" });
    await passer();
    expect(port.pub).toHaveLength(1);
    expect(port.pub[0].texte).toBe(texteFige);
    expect((await etatDe())?.formulations?.["pub-instagram"]).toBe(figee);
    // Les textes validés changent entre-temps : les deux sont validés, le choix courant (par rang) peut désormais être l'autre.
    await validerFormulationsAuParcours(["mp-m1-v4-1", P1, P2]);
    await passer(T0 + 60_000);
    expect(port.pub).toHaveLength(2);
    expect(port.pub[1].texte).toBe(texteFige);
    expect((await etatDe())?.formulations?.["pub-instagram"]).toBe(figee);
  });
  it("Facebook inchangé : une formulation pub-instagram validée ne change rien (mp-pub-igfb-v1)", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", P1, P2]);
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(port.pub[0].texte).toBe(ANCIEN);
    expect((await etatDe())?.formulations?.["pub-instagram"]).toBeUndefined();
  });
  it("Instagram : une formulation pub-commentaire validée ne sert toujours pas (inchangé)", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", ...(GROUPES_MP["pub-commentaire"] as readonly string[])]);
    await deposerCommentaire(depots, { reseau: "instagram" });
    await passer();
    expect(port.pub[0].texte).toBe(ANCIEN);
  });
});
