/** Raison d'un refus d'envoi sous FORME FERMÉE : client, port, parcours (T11 à T23). Données FICTIVES. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerPortInboxZernio, raisonRefus } from "@/fournisseurs/zernio-inbox";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { estRaisonRefus, formaterRaison, type RaisonRefus } from "@/domaine/guide-reseau/raison-refus";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { emettreJetonNonOpposee } from "@/domaine/guide-reseau/jeton-non-opposee";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";
import { MOT_INTERDIT, creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const TEXTE = rendreTexteMp("mp-recu-v2", { titre: "Guide d'exemple" })!;
const PRIVE = { methode: "POST", chemin: "/v1/inbox/comments/exemple-post-1/exemple-com-1/private-reply", corps: { accountId: "exemple-compte-1", message: TEXTE }, comptesPermis: ["exemple-compte-1"], titresGuidesPermis: ["Guide d'exemple"] } as const;
const brut = (texte: string | null, status: number) => creerFauxClientZernio([], { fetch: async () => new Response(texte, { status }) });
const echoue = async (p: Promise<unknown>): Promise<ErreurZernio> => {
  try {
    await p;
  } catch (e) {
    return e as ErreurZernio;
  }
  throw new Error("une erreur était attendue");
};
const RAISON_A: RaisonRefus = { motif: "fenetre-7-jours-depassee", statut: 400, codeClient: "refuse", meta: { code: 10, sousCode: 2018278 }, codeZernio: null };
const RAISON_B: RaisonRefus = { motif: "messagerie-desactivee-sur-la-page", statut: 400, codeClient: "refuse", meta: null, codeZernio: "platform_api_error" };

describe("client : motif fermé des routes inbox (T11 à T14)", () => {
  it("T11 réponse privée 400 « messagerie désactivée » : refuse, motifInbox renseigné, detailTechnique vide", async () => {
    const b = brut(JSON.stringify({ error: "platform_api_error", message: "HTTP error! status: 400 - The page has messages disabled in the settings" }), 400);
    const e = await echoue(b.client.requete(PRIVE));
    expect(e.code).toBe("refuse");
    expect(e.motifInbox?.motif).toBe("messagerie-desactivee-sur-la-page");
    expect(e.detailTechnique).toBeUndefined();
  });
  it("T11b corps réel (error objet) : motif messagerie-desactivee-sur-la-page, codeZernio platform_api_error", async () => {
    const b = brut(JSON.stringify({ error: { type: "platform_api_error", message: "HTTP error! status: 400 - The page has messages disabled in the settings" } }), 400);
    const e = await echoue(b.client.requete(PRIVE));
    expect(e.code).toBe("refuse");
    expect(e.motifInbox?.motif).toBe("messagerie-desactivee-sur-la-page");
    expect(e.motifInbox?.codeZernio).toBe("platform_api_error");
    expect(e.detailTechnique).toBeUndefined();
  });
  it("T12 400 inconnu, 502 sans issue, 502 unknown", async () => {
    const e1 = await echoue(brut("texte libre de Jeanne Exemple", 400).client.requete(PRIVE));
    expect(e1.code).toBe("refuse");
    expect(e1.motifInbox?.motif).toBe("raison-inconnue");
    expect(JSON.stringify(e1.motifInbox)).not.toContain("Jeanne");
    const e2 = await echoue(brut(null, 502).client.requete(PRIVE));
    expect(e2.code).toBe("a-verifier");
    expect(e2.motifInbox?.motif).toBe("erreur-serveur");
    const e3 = await echoue(brut(JSON.stringify({ privateReplyOutcome: "unknown" }), 502).client.requete(PRIVE));
    expect(e3.code).toBe("reponse-privee-inconnue");
  });
  it("T13 erreur réseau : coupure-reseau ou delai-depasse, aucun texte", async () => {
    const coupe = creerFauxClientZernio([{ erreur: "reseau", message: "fetch failed pour personne@exemple.invalid" }]);
    const e = await echoue(coupe.client.requete(PRIVE));
    expect(e.motifInbox?.motif).toBe("coupure-reseau");
    expect(JSON.stringify(e.motifInbox)).not.toContain("exemple.invalid");
    expect(e.detailTechnique).toBeUndefined();
    const delai = creerFauxClientZernio([{ erreur: "delai" }]);
    expect((await echoue(delai.client.requete(PRIVE))).motifInbox?.motif).toBe("delai-depasse");
  });
  it("T14 non-régression : hors boîte de messages, detailTechnique gardé et pas de motif ; boîte de messages, detailTechnique vide", async () => {
    const lire = creerFauxClientZernio([{ statut: 400, corps: { error: "message technique du service" } }]);
    const e = await echoue(lire.client.requete({ methode: "GET", chemin: "/v1/posts/exemple-post-1" }));
    expect(e.detailTechnique).toContain("message technique");
    expect(e.motifInbox).toBeUndefined();
    const boite = creerFauxClientZernio([{ statut: 400, corps: { error: "message technique du service" } }]);
    const e2 = await echoue(boite.client.requete({ methode: "GET", chemin: "/v1/inbox/conversations/exemple-conv-1/messages", query: { accountId: "exemple-compte-1" }, comptesPermis: ["exemple-compte-1"] }));
    expect(e2.detailTechnique).toBeUndefined();
    expect(e2.motifInbox).toBeDefined();
  });
});

describe("port : raisonRefus et issues (T15 à T18)", () => {
  const prive = (client: ReturnType<typeof creerFauxClientZernio>["client"], over: Record<string, string> = {}) =>
    creerPortInboxZernio({ client, comptesPermis: ["exemple-compte-1"], titresGuidesPermis: ["Guide d'exemple"] }).repondreEnPrive({ nonOpposee: emettreJetonNonOpposee(), idCompte: "exemple-compte-1", idPost: "exemple-post-1", idCommentaire: "exemple-com-1", texte: TEXTE, ...over });

  it("T15 exception qui n'est pas une erreur Zernio : erreur-interne, aucun texte", () => {
    const r = raisonRefus(new Error("plantage pour personne@exemple.invalid"));
    expect(r).toEqual({ motif: "erreur-interne", codeClient: "erreur-inconnue", statut: null, meta: null, codeZernio: null });
    expect(raisonRefus(null).motif).toBe("erreur-interne");
    expect(() => raisonRefus({ get code(): string { throw new Error("boum"); } })).not.toThrow();
  });
  it("T16 chemin-refuse : refus-avant-envoi, codeClient chemin-refuse, sans le chemin", async () => {
    const b = creerFauxClientZernio([]);
    const r = await prive(b.client, { idPost: "exemple post/../12345678901234567" });
    expect(r.statut).toBe("refuse");
    expect(r.raison).toMatchObject({ motif: "refus-avant-envoi", codeClient: "chemin-refuse", statut: null });
    expect(JSON.stringify(r.raison)).not.toContain("12345678901234567");
    expect(estRaisonRefus(r.raison)).toBe(true);
  });
  it("T17 mot-interdit, lien-hors-domaine, guide-inconnu : code seul", async () => {
    const mot = await prive(creerFauxClientZernio([]).client, { texte: `${TEXTE} ${MOT_INTERDIT}` });
    expect(mot.raison).toMatchObject({ motif: "refus-avant-envoi", codeClient: "mot-interdit" });
    const lien = await prive(creerFauxClientZernio([]).client, { texte: `${TEXTE} https://hors-domaine.exemple.invalid/x` });
    expect(["lien-hors-domaine", "mot-interdit", "chemin-refuse"]).toContain(lien.raison?.codeClient);
    const guide = await creerPortInboxZernio({ client: creerFauxClientZernio([]).client, comptesPermis: ["exemple-compte-1"], titresGuidesPermis: ["Autre guide"] }).repondreEnPrive({ nonOpposee: emettreJetonNonOpposee(), idCompte: "exemple-compte-1", idPost: "exemple-post-1", idCommentaire: "exemple-com-1", texte: TEXTE });
    expect(guide.raison).toMatchObject({ motif: "refus-avant-envoi", codeClient: "guide-inconnu" });
    for (const r of [mot, lien, guide]) expect(estRaisonRefus(r.raison)).toBe(true);
  });
  it("T18 raisonRefus ignore message et detailTechnique", () => {
    const e = new ErreurZernio("refuse", "Jeanne Exemple a refusé", { statut: 400, detailTechnique: "Jeanne Exemple personne@exemple.invalid" });
    const r = raisonRefus(e);
    expect(JSON.stringify(r)).not.toMatch(/Jeanne|exemple\.invalid/);
    expect(r).toMatchObject({ motif: "raison-inconnue", statut: 400, codeClient: "refuse" });
    expect(raisonRefus({ code: "refuse", statut: 400, message: "Jeanne Exemple", detailTechnique: "Jeanne" })).toMatchObject({ motif: "erreur-interne" });
  });
  it("le refus 400 du port porte la raison fermée, sans champ detail", async () => {
    const r = await prive(creerFauxClientZernio([{ statut: 400, corps: { platformError: { code: 10, error_subcode: 2018278 } } }]).client);
    expect(r).toMatchObject({ statut: "refuse", code: "refuse" });
    expect(r.raison).toMatchObject({ motif: "fenetre-7-jours-depassee", statut: 400, meta: { code: 10, sousCode: 2018278 } });
    expect("detail" in r).toBe(false);
  });
});

describe("parcours : raisons stockées et journal (T19 à T23)", () => {
  let port: ReturnType<typeof fauxPort>;
  type Etat = { etat: string; dernierCode: string; refusPublic?: RaisonRefus & { le: string }; refusPrive?: RaisonRefus & { le: string }; detailRefus?: unknown };
  const lire = async (id: string) => (await Com.lireParametre<Record<string, Etat>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(id)];
  const passer = (ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: ms });
  const journalComplet = async () => (await depots().evenements.lister(() => true)).map((x: { message: string }) => x.message).join("\n");
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

  it("T19 réponse publique refusée : seule refusPublic est posée ; la clôture du premier message ne porte pas la raison du public", async () => {
    port.reponses.pub = () => ({ statut: "refuse", code: "refuse", raison: RAISON_A });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-19" });
    await passer();
    const e = await lire("auteur-fictif-19");
    expect(e.refusPublic).toMatchObject(RAISON_A);
    expect(typeof e.refusPublic?.le).toBe("string");
    expect(e.refusPrive).toBeUndefined();
    expect(e.detailRefus).toBeUndefined();
    expect(await journalComplet()).not.toContain(formaterRaison(RAISON_A));
  });
  it("T19b premier message refusé : refusPrive posée, refusPublic gardée, la clôture porte la seule raison du privé", async () => {
    port.reponses.pub = () => ({ statut: "refuse", code: "refuse", raison: RAISON_A });
    port.reponses.prive = () => ({ statut: "refuse", code: "refuse", raison: RAISON_B });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-19b" });
    await passer();
    const e = await lire("auteur-fictif-19b");
    expect(e.etat).toBe("m1_refuse");
    expect(e.refusPrive).toMatchObject(RAISON_B);
    expect(e.refusPublic).toMatchObject(RAISON_A);
    const lignes = (await depots().evenements.lister((x: { message: string }) => /m1_refuse \(refuse\)/.test(x.message))).map((x: { message: string }) => x.message).join("\n");
    expect(lignes).toContain(formaterRaison(RAISON_B));
    expect(lignes).not.toContain(formaterRaison(RAISON_A));
  });
  it("T20 succès : les deux champs disparaissent du JSON relu", async () => {
    port.reponses.pub = () => ({ statut: "refuse", code: "refuse", raison: RAISON_A });
    port.reponses.prive = () => ({ statut: "a_reessayer", code: "debit", reessayerApresSec: 1 });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-20" });
    await passer();
    // état préparé : les deux raisons présentes
    const cle = cleConversation("auteur-fictif-20");
    const tout = await Com.lireParametre<Record<string, Record<string, unknown>>>(C.PARAM_CONVERSATIONS, {});
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...tout, [cle]: { ...tout[cle], etat: "nouveau", essaisPub: 0, essaisM1: 0, m1Le: null, refusPublic: { ...RAISON_A, le: "2026-11-17T08:00:00.000Z" }, refusPrive: { ...RAISON_B, le: "2026-11-17T08:00:00.000Z" } } });
    port.reponses.pub = () => ({ statut: "envoye", idMessage: "msg-pub" });
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "msg-prive" });
    await passer(T0 + 3600_000);
    const brutJson = JSON.stringify((await Com.lireParametre<Record<string, unknown>>(C.PARAM_CONVERSATIONS, {}))[cle]);
    expect(brutJson).not.toContain("refusPublic");
    expect(brutJson).not.toContain("refusPrive");
  });
  it("T21 premier message à vérifier, définitif ou à réessayer : refusPrive non écrite", async () => {
    const cas: Array<[string, () => import("@/fournisseurs/zernio-inbox").ResultatEcritureInbox]> = [
      ["a", () => ({ statut: "a_verifier", code: "a-verifier", etat: "a_verifier", raison: RAISON_B })],
      ["d", () => ({ statut: "definitif", code: "reponse-privee-consommee", etat: "consommee", consomme: true, raison: RAISON_B })],
      ["r", () => ({ statut: "a_reessayer", code: "debit", reessayerApresSec: 30, raison: RAISON_B })],
    ];
    for (const [k, rep] of cas) {
      port.reponses.prive = rep;
      await deposerCommentaire(depots, { idAuteur: `auteur-fictif-21${k}` });
      await passer();
      expect((await lire(`auteur-fictif-21${k}`)).refusPrive).toBeUndefined();
    }
  });
  it("T22 journal : libellé français et [HTTP n · code · meta a/b], aucun texte du service", async () => {
    port.reponses.prive = () => ({ statut: "refuse", code: "refuse", raison: RAISON_A });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-22" });
    await passer();
    const j = await journalComplet();
    expect(j).toContain("Commentaire de plus de 7 jours : réponse privée impossible [HTTP 400 · refuse · meta 10/2018278]");
  });
  it("T23 une raison mal formée est rejetée à l'écriture ; une raison stockée reste valide", async () => {
    port.reponses.prive = () => ({ statut: "refuse", code: "refuse", raison: { motif: "Jeanne Exemple", statut: 400, codeClient: "refuse", meta: null, codeZernio: null } as unknown as RaisonRefus });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-23" });
    await passer();
    const e = await lire("auteur-fictif-23");
    expect(e.refusPrive).toBeUndefined();
    expect(JSON.stringify(e)).not.toContain("Jeanne");
    port.reponses.prive = () => ({ statut: "refuse", code: "refuse", raison: RAISON_A });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-23b" });
    await passer();
    expect(estRaisonRefus(await (async () => { const { le, ...r } = (await lire("auteur-fictif-23b")).refusPrive!; void le; return r; })())).toBe(true);
  });
  it("T23b reduireIdentifiants ne touche pas à la raison stockée", async () => {
    port.reponses.prive = () => ({ statut: "refuse", code: "refuse", raison: RAISON_A });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-23c" });
    await passer();
    await C.reduireIdentifiants({ env: { ...ENV, PARCOURS_REDUCTION_IDS: "1" } as never, maintenantMs: T0 + 400 * 24 * 3600_000 });
    const { le, ...r } = (await lire("auteur-fictif-23c")).refusPrive!;
    void le;
    expect(estRaisonRefus(r)).toBe(true);
  });
});
