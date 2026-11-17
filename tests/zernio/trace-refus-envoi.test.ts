/** Trace des refus d'envoi : raison courte et nettoyée dans l'état et le journal. Données FICTIVES. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerPortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { raisonRefus } from "@/fournisseurs/zernio-inbox";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { emettreJetonNonOpposee } from "@/domaine/guide-reseau/jeton-non-opposee";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

describe("raisonRefus (pure)", () => {
  it("assemble statut, code et message", () => {
    expect(raisonRefus(new ErreurZernio("refuse", "Zernio a refusé la demande.", { statut: 400 }))).toBe("HTTP 400 · refuse · Zernio a refusé la demande.");
  });
  it("masque suites de 10 chiffres ou plus, adresses e-mail et jetons Bearer", () => {
    const r = raisonRefus({ code: "refuse", statut: 400, message: "user 12345678901234 mail a.b@exemple.fr Authorization: Bearer abc.def-123 fin 123456789" });
    expect(r).not.toMatch(/\d{10,}/);
    expect(r).not.toContain("@");
    expect(r).not.toContain("abc.def-123");
    expect(r).toContain("123456789");
  });
  it("tronque le message à 200 caractères", () => {
    const r = raisonRefus({ code: "x", statut: 400, message: "a".repeat(500) });
    expect(r).toBe(`HTTP 400 · x · ${"a".repeat(200)}`);
  });
  it("ne lève jamais : objet sans message, null, valeurs étranges", () => {
    expect(raisonRefus({})).toBe("");
    expect(raisonRefus({ code: "refuse" })).toBe("refuse");
    expect(raisonRefus(null)).toBe("");
    expect(raisonRefus(undefined)).toBe("");
    expect(raisonRefus({ message: 12, code: {}, statut: "x" })).toBe("");
    expect(() => raisonRefus({ get message(): string { throw new Error("boum"); } })).not.toThrow();
  });
});

describe("port inbox : refus 400", () => {
  it("rend un détail nettoyé pour un refus, sans toucher au statut ni au code", async () => {
    const base = creerFauxClientZernio([{ statut: 400, corps: { error: "mauvaise demande pour 12345678901234" } }]);
    const port = creerPortInboxZernio({ client: base.client, comptesPermis: ["exemple-compte-1"], titresGuidesPermis: ["Guide d'exemple"] });
    const r = await port.repondreEnPrive({ nonOpposee: emettreJetonNonOpposee(), idCompte: "exemple-compte-1", idPost: "exemple-post-1", idCommentaire: "exemple-com-1", texte: rendreTexteMp("mp-recu-v2", { titre: "Guide d'exemple" })! });
    expect(r).toMatchObject({ statut: "refuse", code: "refuse" });
    expect(r.detail).toMatch(/^HTTP 400 · refuse · /);
    expect(r.detail).not.toMatch(/\d{10,}/);
  });
});

describe("parcours : refus d'une réponse privée", () => {
  let port: ReturnType<typeof fauxPort>;
  beforeEach(async () => {
    reinitialiserDepots();
    C.reinitialiserParcoursConversation();
    pm.reinitialiserGardesParcours();
    silencerConsole();
    port = fauxPort();
    pm.injecterTransportSite(fauxSite().transport);
    await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
    await validerGuideAuParcours();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    pm.injecterTransportSite(null);
  });

  it("l'état porte detailRefus et le journal le contient ; dernierCode inchangé", async () => {
    port.reponses.prive = () => ({ statut: "refuse", code: "refuse", detail: "HTTP 400 · refuse · Zernio a refusé la demande." });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-400" });
    await C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: T0 });
    const e = (await Com.lireParametre<Record<string, { etat: string; dernierCode: string; detailRefus?: string }>>(C.PARAM_CONVERSATIONS, {}))[cleConversation("auteur-fictif-400")];
    expect(e.etat).toBe("m1_refuse");
    expect(e.dernierCode).toBe("refuse");
    expect(e.detailRefus).toBe("HTTP 400 · refuse · Zernio a refusé la demande.");
    const lignes = await depots().evenements.lister((x: { message: string }) => /m1_refuse \(refuse\)/.test(x.message));
    expect(lignes.some((x: { message: string }) => x.message.includes("HTTP 400 · refuse"))).toBe(true);
  });
  it("sans détail : comportement inchangé, aucun champ detailRefus", async () => {
    port.reponses.prive = () => ({ statut: "refuse", code: "refuse" });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-401" });
    await C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: T0 });
    const e = (await Com.lireParametre<Record<string, { etat: string; dernierCode: string; detailRefus?: string }>>(C.PARAM_CONVERSATIONS, {}))[cleConversation("auteur-fictif-401")];
    expect(e.etat).toBe("m1_refuse");
    expect(e.detailRefus).toBeUndefined();
  });
  it.todo("ESCALADE : le client (publication/zernio-client.ts) ne porte aucun code ni message du service pour les routes inbox (detailReponse vide exprès) ; hors périmètre");
});
