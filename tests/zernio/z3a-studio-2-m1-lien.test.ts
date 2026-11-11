/**
 * Z3a-Studio-2 · le 1er message privé (M1) porte le lien signé de la page « Recevoir le guide ».
 * Interrupteur PARCOURS_LIEN_GUIDE éteint par défaut : M1 v2 part alors octet pour octet comme avant.
 * Données 100 % fictives ; le jeton n'est jamais stocké ni journalisé ; repli exact sur M1 v2 si un élément manque.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { construireLienGuide, creerJetonLien, refConversationLien } from "@/domaine/guide-reseau/lien-guide";
import * as LG from "@/domaine/guide-reseau/lien-guide";
import { creerPortInboxZernio } from "@/fournisseurs/zernio-inbox";
import { creerFauxClientZernio } from "./aides/faux-zernio";
import { ADRESSE_FICTIVE, COMPTE, ENV, POST, SECRET_EMPREINTE, T0, TITRE, cleConversation, deposerCommentaire, deposerMessage, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Notif = await import("@/services/notifications");
const Opp = await import("@/services/oppositions-mots");

const H = 3600_000;
const SECRET_LIEN = "secret-fictif-lien-page-guide-0123456789-abcdef";
const ENV_LIEN = { ...ENV, PARCOURS_LIEN_GUIDE: "1", GUIDES_RESEAU_LIEN_SECRET: SECRET_LIEN, LIEN_GUIDE_COMPTES: `${COMPTE}=page_principale` };
const PARAM_VALIDATION_M1 = "parcours.validation.m1_lien";
const A = "auteur-fictif-400";
const empreinteV3 = () => { const b = TEXTES_MP["mp-m1-v3"]; return createHash("sha256").update(`${b.version}\n${b.texte}`).digest("hex"); };
const validerV3 = () => Com.ecrireParametre(PARAM_VALIDATION_M1, { empreinte: empreinteV3() });
const PREFIXE = "https://axion-ia.com/guide-reseau?j=";

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (env: Record<string, string | undefined> = ENV_LIEN, ms = T0, p = port.port) => C.traiterConversations({ port: p, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const etatDe = async (auteur = A) => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(auteur)];
const sansLien = async () => (await depots().notifications.lister((n: any) => /sans lien/.test(n.message))).length;
const jetonAttendu = (etat: Record<string, any>, extra: Record<string, string> = {}) =>
  creerJetonLien({ conv: refConversationLien(SECRET_EMPREINTE, etat.cleIdempotenceGuide), mot: "GUIDE", reseau: "instagram", guide: "guide-ia", compte: "page_principale", post_ref: POST, version_m1: "mp-m1-v3", ...extra }, SECRET_LIEN, T0);
const v2 = () => rendreTexteMp("mp-m1-v2", { mot: "GUIDE", titre: TITRE });

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
  await validerV3();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("1 · interrupteur éteint = comportement d'aujourd'hui", () => {
  it("absent : M1 v2 exact, aucun champ de lien, version v2, aucune alerte", async () => {
    await deposerCommentaire(depots, {});
    await passer({ ...ENV_LIEN, PARCOURS_LIEN_GUIDE: undefined });
    expect(port.prive).toHaveLength(1);
    expect(port.prive[0].texte).toBe(v2());
    const e = await etatDe();
    expect(e.refLienConv).toBeUndefined();
    expect(e.versionTexteM1).toBe("mp-m1-v2");
    expect(await sansLien()).toBe(0);
    expect((await depots().evenements.lister((x: any) => /Lien du 1er message/.test(x.message))).length).toBe(0);
  });
  it("valeurs autres que 1/true/oui : éteint", async () => {
    await deposerCommentaire(depots, {});
    await passer({ ...ENV_LIEN, PARCOURS_LIEN_GUIDE: "0" });
    expect(port.prive[0].texte).toBe(v2());
  });
});

describe("2 · allumé et tout prêt : M1 v3 avec lien signé", () => {
  it("texte, jeton, référence et version", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    const e = await etatDe();
    const lien = construireLienGuide(jetonAttendu(e));
    expect(port.prive).toHaveLength(1);
    expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v3", { mot: "GUIDE", titre: TITRE, lien: lien! }));
    expect(e.refLienConv).toBe(refConversationLien(SECRET_EMPREINTE, e.cleIdempotenceGuide));
    expect(e.versionTexteM1).toBe("mp-m1-v3");
  });
  it("identifiant de publication inadmissible dans le jeton (« : ») : lien SANS post_ref, M1 v3 quand même", async () => {
    await deposerCommentaire(depots, { idPost: "post:fictif:1" });
    await passer();
    const e = await etatDe();
    const attendu = creerJetonLien({ conv: e.refLienConv, mot: "GUIDE", reseau: "instagram", guide: "guide-ia", compte: "page_principale", version_m1: "mp-m1-v3" }, SECRET_LIEN, T0);
    expect(port.prive[0].texte).toBe(rendreTexteMp("mp-m1-v3", { mot: "GUIDE", titre: TITRE, lien: construireLienGuide(attendu)! }));
    expect(e.versionTexteM1).toBe("mp-m1-v3");
  });
});

describe("3 · VRAI constructeur de corps d'envoi", () => {
  const reel = () => {
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: { messageId: "msg-sortant-1" } }));
    const p = creerPortInboxZernio({ client, comptesPermis: [COMPTE], titresGuidesPermis: [TITRE] });
    return { port: { ...port.port, repondreEnPrive: p.repondreEnPrive }, faux, p };
  };
  it("exactement 1 POST, message = texte v3 avec le lien signé", async () => {
    const r = reel();
    await deposerCommentaire(depots, {});
    await passer(ENV_LIEN, T0, r.port);
    const posts = r.faux.appels.filter((a) => a.methode === "POST");
    const e = await etatDe();
    expect(posts).toHaveLength(1);
    const message = (posts[0].json as { message: string }).message;
    expect(message).toBe(rendreTexteMp("mp-m1-v3", { mot: "GUIDE", titre: TITRE, lien: construireLienGuide(jetonAttendu(e))! }));
    expect(message).toContain(PREFIXE);
  });
  it("un lien sans signature est refusé avant le réseau (preuve que le test peut rougir)", async () => {
    const r = reel();
    const texte = rendreTexteMp("mp-m1-v3", { mot: "GUIDE", titre: TITRE, lien: `${PREFIXE}abc` })!;
    const res = await r.p.repondreEnPrive({ idCompte: COMPTE, idPost: POST, idCommentaire: "com-1", texte });
    expect(res.statut).toBe("refuse");
    expect(r.faux.appels.filter((a) => a.methode === "POST")).toHaveLength(0);
  });
  it("formeLienPageGuide : lien signé accepté, lien sans signature refusé", async () => {
    const { formeLienPageGuide } = await import("@/fournisseurs/publication/zernio-inbox-corps");
    const jeton = creerJetonLien({ conv: "c1_abcdefghijklmnopqrstuv", mot: "GUIDE", reseau: "instagram", guide: "guide-ia", compte: "page_principale", version_m1: "mp-m1-v3" }, SECRET_LIEN, T0);
    expect(formeLienPageGuide(PREFIXE + jeton)).toBe(true);
    expect(formeLienPageGuide(`${PREFIXE}abc`)).toBe(false);
  });
});

describe("4 · repli exact sur M1 v2, une alerte cloche par code et par heure", () => {
  async function repli(env: Record<string, string | undefined>) {
    await deposerCommentaire(depots, {});
    await passer(env);
    expect(port.prive).toHaveLength(1);
    expect(port.prive[0].texte).toBe(v2());
    expect((await etatDe()).versionTexteM1).toBe("mp-m1-v2");
    expect((await etatDe()).refLienConv).toBeUndefined();
    expect(await sansLien()).toBe(1);
  }
  it("secret_lien_absent", async () => { await repli({ ...ENV_LIEN, GUIDES_RESEAU_LIEN_SECRET: undefined }); });
  it("texte_lien_non_valide (validation absente)", async () => { await Com.ecrireParametre(PARAM_VALIDATION_M1, null); await repli(ENV_LIEN); });
  it("compte_lien_inconnu", async () => { await repli({ ...ENV_LIEN, LIEN_GUIDE_COMPTES: "autre-compte=page_autre" }); });
  it("jeton_invalide", async () => { vi.spyOn(LG, "creerJetonLien").mockImplementation(() => { throw new Error("secret-ne-pas-lire"); }); await repli(ENV_LIEN); });
  it("lien_trop_long", async () => { vi.spyOn(LG, "construireLienGuide").mockReturnValue(null); await repli(ENV_LIEN); });
  it("forme_refusee", async () => { vi.spyOn(LG, "construireLienGuide").mockReturnValue(`${PREFIXE}abc`); await repli(ENV_LIEN); });

  it("deux personnes dans l'heure, même code : UNE seule alerte, jamais de push, jamais d'identifiant", async () => {
    const spy = vi.spyOn(Notif, "creerNotification");
    const env = { ...ENV_LIEN, GUIDES_RESEAU_LIEN_SECRET: undefined };
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-401" });
    await deposerCommentaire(depots, { idAuteur: "auteur-fictif-402" });
    await passer(env);
    expect(port.prive).toHaveLength(2);
    expect(await sansLien()).toBe(1);
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    for (const c of spy.mock.calls) expect(c[1]).toMatchObject({ cloche: true });
    expect(JSON.stringify(await depots().notifications.lister(() => true))).not.toMatch(/auteur-fictif|secret-ne-pas-lire/);
  });
  it("le catch du jeton ne lit jamais le message d'erreur", async () => {
    vi.spyOn(LG, "creerJetonLien").mockImplementation(() => { throw new Error("secret-ne-pas-lire"); });
    await deposerCommentaire(depots, {});
    await passer();
    const tout = JSON.stringify([await depots().evenements.lister(() => true), await depots().notifications.lister(() => true), (console.error as any).mock.calls, (console.log as any).mock.calls, (console.warn as any).mock.calls]);
    expect(tout).not.toContain("secret-ne-pas-lire");
  });
});

describe("5 · la référence est écrite UNE fois", () => {
  it("(a) nouvel essai après a_reessayer : même référence", async () => {
    port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" } as any);
    await deposerCommentaire(depots, {});
    await passer();
    const r1 = (await etatDe()).refLienConv;
    expect(r1).toMatch(/^c1_/);
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" });
    await passer(ENV_LIEN, T0 + 10 * 60_000);
    expect((await etatDe()).refLienConv).toBe(r1);
    expect(port.prive.length).toBeGreaterThanOrEqual(2);
  });
  it("(b) rotation du secret d'empreinte entre deux essais : référence inchangée", async () => {
    port.reponses.prive = () => ({ statut: "a_reessayer", code: "reseau" } as any);
    await deposerCommentaire(depots, {});
    await passer();
    const r1 = (await etatDe()).refLienConv;
    port.reponses.prive = () => ({ statut: "envoye", idMessage: "m" });
    const apres = { ...ENV_LIEN, STUDIO_EMPREINTE_SECRET: "secret-fictif-empreinte-NOUVEAU-0123456789-xyz", STUDIO_EMPREINTE_SECRET_ANCIEN: SECRET_EMPREINTE };
    await passer(apres, T0 + 10 * 60_000);
    const tout = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
    expect(Object.values(tout).map((x) => x.refLienConv)).toContain(r1);
  });
  it("(c) référence déjà présente : jamais écrasée", async () => {
    await deposerCommentaire(depots, {});
    await passer({ ...ENV_LIEN, PARCOURS_LIEN_GUIDE: undefined }); // M1 v2 envoyé
    const k = cleConversation(A);
    const tout = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...tout, [k]: { ...tout[k], etat: "pub_ok", refLienConv: "c1_dejaecriteabcdefghijkl" } });
    const ev = await depots().evenementsFournisseurs.lister(() => true);
    for (const x of ev) await depots().evenementsFournisseurs.enregistrer({ ...x, traite: false });
    await passer(ENV_LIEN, T0 + 1000);
    expect((await etatDe()).refLienConv).toBe("c1_dejaecriteabcdefghijkl");
  });
});

describe("6 · le jeton n'est jamais stocké ni journalisé", () => {
  it("absent de l'état, du journal, des notifications, des événements et de la console", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    const e = await etatDe();
    const jeton = jetonAttendu(e);
    expect(port.prive[0].texte).toContain(jeton); // le jeton est bien parti à la personne...
    const tout = JSON.stringify([
      await Com.lireParametre(C.PARAM_CONVERSATIONS, {}), await Com.lireParametre("parcours.conversations.alias", {}), await Com.lireParametre("parcours.conversations.compteurs", {}),
      await depots().evenements.lister(() => true), await depots().notifications.lister(() => true), await depots().evenementsFournisseurs.lister(() => true),
      (console.log as any).mock.calls, (console.error as any).mock.calls, (console.warn as any).mock.calls, (console.info as any).mock.calls,
    ]);
    expect(tout).not.toContain(jeton.split(".")[0]); // ... mais nulle part ailleurs
    expect(tout).not.toContain("guide-reseau?j=");
  });
});

describe("7 · un « stop » l'emporte toujours", () => {
  it("(a) STOP en commentaire avant M1 : 0 envoi", async () => {
    await deposerCommentaire(depots, { motSeul: "STOP" });
    await passer();
    expect(port.prive).toHaveLength(0);
  });
  it("(b) opposition inscrite entre le rendu du lien et l'envoi : 0 envoi, clos silence/opposee", async () => {
    let apresRendu = false;
    vi.spyOn(LG, "construireLienGuide").mockImplementation((j: string) => {
      apresRendu = true; // l'opposition « arrive » au moment où le lien est rendu
      return PREFIXE + j;
    });
    vi.spyOn(Opp, "empreintesOpposees").mockImplementation(async () => apresRendu);
    const id = await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive).toHaveLength(0);
    const ev = (await depots().evenementsFournisseurs.lister((x: any) => x.idEvenement === id))[0];
    expect(ev.traite).toBe(true);
    expect(JSON.stringify(ev.charge)).toContain("opposee");
  });
});

describe("8 · rejeu, doublon, redémarrage", () => {
  it("le même événement traité deux fois : 1 seul M1", async () => {
    const id = await deposerCommentaire(depots, {});
    await passer();
    const ev = (await depots().evenementsFournisseurs.lister((x: any) => x.idEvenement === id))[0];
    await depots().evenementsFournisseurs.enregistrer({ ...ev, traite: false });
    await passer(ENV_LIEN, T0 + 1000);
    expect(port.prive).toHaveLength(1);
  });
  it("m1_en_vol + redémarrage : m1_a_verifier, aucun nouvel envoi même allumé", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    const k = cleConversation(A);
    const tout = await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...tout, [k]: { ...tout[k], etat: "m1_en_vol" } });
    C.reinitialiserParcoursConversation();
    await passer(ENV_LIEN, T0 + 1000);
    expect(port.prive).toHaveLength(1);
    expect((await etatDe()).etat).toBe("m1_a_verifier");
  });
});

describe("9 · la version de M1 suit jusqu'au site", () => {
  const versionEnvoyee = () => (site.vus[0].corps as { versionTexteM1?: string }).versionTexteM1 ?? JSON.stringify(site.vus[0].corps);
  it("après M1 v3 : mp-m1-v3", async () => {
    await deposerCommentaire(depots, {});
    await passer();
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "msg-s1" });
    await passer(ENV_LIEN, T0 + 1000);
    expect(site.vus).toHaveLength(1);
    expect(JSON.stringify(site.vus[0].corps)).toContain("mp-m1-v3");
    expect(versionEnvoyee()).toBeTruthy();
  });
  it("après repli v2 : mp-m1-v2", async () => {
    await deposerCommentaire(depots, {});
    await passer({ ...ENV_LIEN, GUIDES_RESEAU_LIEN_SECRET: undefined });
    port.reponses.texte = () => `Mon adresse ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idMessage: "msg-s2" });
    await passer(ENV_LIEN, T0 + 1000);
    expect(JSON.stringify(site.vus[0].corps)).toContain("mp-m1-v2");
    expect(JSON.stringify(site.vus[0].corps)).not.toContain("mp-m1-v3");
  });
});

describe("10 · la validation suit le texte", () => {
  it("empreinte de l'ancien texte : repli v2 texte_lien_non_valide", async () => {
    await Com.ecrireParametre(PARAM_VALIDATION_M1, { empreinte: createHash("sha256").update("mp-m1-v3\nautre texte").digest("hex") });
    await deposerCommentaire(depots, {});
    await passer();
    expect(port.prive[0].texte).toBe(v2());
    expect(await sansLien()).toBe(1);
  });
  it("PARAM_VALIDATION_M1_LIEN est la clé attendue, texte proposé conforme (mention, vouvoiement, pas de STOP)", () => {
    expect(MS.PARAM_VALIDATION_M1_LIEN).toBe(PARAM_VALIDATION_M1);
    const t = TEXTES_MP["mp-m1-v3"].texte;
    expect(t.startsWith("Message automatique envoyé par Axion IA. ")).toBe(true);
    expect(t).toContain("[LIEN]");
    expect(t).toMatch(/48 h/);
    expect(t).not.toMatch(/\bstop\b|autres informations/i);
  });
});
