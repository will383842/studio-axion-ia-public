/** Lot 5b · R-c : suivi des conversations après rotation du secret d'empreinte. Données 100 % fictives (example.test) ; port et site FAUX. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { empreintePersonne, ErreurEmpreinteIndisponible, lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { ADRESSE_FICTIVE, COMPTE, ENV, SECRET_EMPREINTE, T0, TITRE, deposerCommentaire, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const Opp = await import("@/services/oppositions-mots");

const SECRET_B = "secret-fictif-empreinte-rotation-B-0123456789";
/** Après rotation : B courant, A (le secret des autres tests) ancien. */
const ENV_B = { ...ENV, STUDIO_EMPREINTE_SECRET: SECRET_B, STUDIO_EMPREINTE_SECRET_ANCIEN: SECRET_EMPREINTE };
/** Ancien secret retiré trop tôt : B seul. */
const ENV_B_SEUL = { ...ENV, STUDIO_EMPREINTE_SECRET: SECRET_B };
const H = 3600_000;
const A = "auteur-fictif-400";
const FIL = "conv-fictive-700";

const clesDe = (env: typeof ENV) => {
  const k = lireClesEmpreinte(env);
  if (!k.ok) throw new Error("clés attendues");
  return k;
};
const formeA = (id: string) => empreintePersonne(clesDe(ENV).courante, "zernio-conversation", id);
const formeB = (id: string) => empreintePersonne(clesDe(ENV_B).courante, "zernio-conversation", id);

let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (env: Record<string, string | undefined>, ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const tout = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const aliasTous = () => Com.lireParametre<Record<string, string>>(C.PARAM_CONVERSATIONS_ALIAS, {});
const graine = (cle: string, etat: string, extra: Record<string, unknown> = {}) => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}).then((conv) =>
  Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    ...conv,
    [cle]: { etat, reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
      cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0 - 2 * H).toISOString(), m1Le: new Date(T0 - H).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0,
      prochainEssaiLe: null, dernierCode: null, alias: [], ...extra },
  }));
const registre = async () => {
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
};

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await registre();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("rotation · (1) conversation créée sous A, suivie sous B", () => {
  it("l'adresse reçue après rotation est traitée dans LA MÊME conversation ; alias B ajouté, rien d'orphelin", async () => {
    await passer(ENV, T0); // GUIDE → M1 sous A
    const id0 = await deposerCommentaire(depots, { idAuteur: A, idCommentaire: "com-rot-1" });
    await passer(ENV, T0);
    expect((await evenement(depots, id0)).charge.etat).toBe("attente_email");
    const cleA = formeA(A);
    expect(Object.keys(await tout())).toEqual([cleA]);
    const cleGuide = (await tout())[cleA].cleIdempotenceGuide;

    port.reponses.texte = () => `Mon adresse : ${ADRESSE_FICTIVE}`;
    const id = await deposerMessage(depots, { idExpediteur: A, idConversation: FIL, idMessage: "msg-rot-1" });
    await passer(ENV_B, T0 + 1000);

    const ev = await evenement(depots, id);
    expect(ev.charge.etat).toBe("termine");
    expect(ev.charge.dernierCode).not.toBe("orphelin");
    const conv = await tout();
    expect(Object.keys(conv)).toEqual([cleA]); // la clé reste l'ancienne : pas de second parcours, rien de supprimé
    expect(conv[cleA].etat).toBe("termine");
    expect(conv[cleA].cleIdempotenceGuide).toBe(cleGuide); // jamais recalculée
    expect(conv[cleA].alias).toContain(formeB(A));
    expect((await aliasTous())[formeB(A)]).toBe(cleA);
    expect(site.vus).toHaveLength(1);
    expect(JSON.stringify(site.vus[0].corps)).toContain(cleGuide);
  });
});

const kidA = () => clesDe(ENV_B).anciennes[0].kid;
const lignes = () => Com.lireParametre<any[]>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const seulA = async () => (await Opp.etatRegistreEmpreintes({ env: ENV_B })).seulementParKid[kidA()] ?? 0;

describe("rotation · (2) « stop » après rotation", () => {
  it("l'opposition est enregistrée sous toutes les formes connues (courante ET ancienne), sans ligne isolée pour l'ancien secret", async () => {
    await graine(formeA(A), "attente_email");
    port.reponses.texte = () => "stop";
    const id = await deposerMessage(depots, { idExpediteur: A, idConversation: FIL, idMessage: "msg-rot-stop" });
    await passer(ENV_B, T0);
    expect((await evenement(depots, id)).charge.etat).toBe("oppose");
    expect((await tout())[formeA(A)].etat).toBe("oppose");
    const registreOpp = JSON.stringify(await Com.lireParametre(Opp.PARAM_OPPOSITIONS_MOTS, []));
    for (const forme of [formeA(A), formeB(A), formeA(FIL), formeB(FIL)]) expect(registreOpp, "forme absente du registre").toContain(forme);
    expect(await Opp.personneOpposee(A, "zernio-conversation", { env: ENV_B })).toBe(true);
    expect(await seulA()).toBe(0);
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
    expect(site.vus).toHaveLength(0);
  });
});

describe("rotation · T1 « stop » après rotation, retrait de l'ancien secret", () => {
  it("seulementParKid[ancien] = 0 ; un second « stop » ne change pas le registre ; vrai sous B seul ET sous A seul", async () => {
    await graine(formeA(A), "attente_email");
    port.reponses.texte = () => "stop";
    await deposerMessage(depots, { idExpediteur: A, idConversation: FIL, idMessage: "msg-t1-a" });
    await passer(ENV_B, T0);
    expect(await seulA()).toBe(0);
    const avant = await lignes();
    await deposerMessage(depots, { idExpediteur: A, idConversation: FIL, idMessage: "msg-t1-b" });
    await passer(ENV_B, T0 + 1000);
    expect(await lignes()).toEqual(avant);
    for (const env of [ENV_B_SEUL, ENV]) {
      expect(await Opp.personneOpposee(A, "zernio-conversation", { env })).toBe(true);
      expect(await Opp.personneOpposee(FIL, "zernio-conversation", { env })).toBe(true);
    }
    const idc = await deposerCommentaire(depots, { idAuteur: A, idCommentaire: "com-t1" });
    await passer(ENV_B_SEUL, T0 + 2000);
    const ev = await evenement(depots, idc);
    expect(ev.charge.etat).toBe("silence");
    expect(ev.charge.dernierCode).not.toBe("registre_illisible");
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
  });
});

describe("rotation · T2 dette honnête (forme ancienne sans identifiant brut)", () => {
  it("la forme sans brut garde sa propre ligne (échec fermé), puis disparaît quand son brut revient", async () => {
    const AUTEUR = "auteur-commentaire-fictif-401";
    await graine(formeA(AUTEUR), "attente_email", { alias: [formeA(FIL)] });
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { [formeA(FIL)]: formeA(AUTEUR) });
    port.reponses.texte = () => "stop";
    await deposerMessage(depots, { idExpediteur: A, idConversation: FIL, idMessage: "msg-t2" });
    await passer(ENV_B, T0);
    expect((await tout())[formeA(AUTEUR)].etat).toBe("oppose");
    expect(await seulA()).toBe(1);
    await expect(Opp.personneOpposee(A, "zernio-conversation", { env: ENV_B_SEUL })).rejects.toBeInstanceOf(ErreurEmpreinteIndisponible);
    expect(await Opp.personneOpposee(AUTEUR, "zernio-conversation", { env: ENV_B })).toBe(true);
    expect(await seulA()).toBe(0);
    for (const id of [A, FIL, AUTEUR]) expect(await Opp.personneOpposee(id, "zernio-conversation", { env: ENV_B_SEUL })).toBe(true);
  });
});

describe("rotation · T3 « stop » par commentaire après rotation", () => {
  it("conversation passée en oppose sans nouvelle clé ; ancien secret retirable ; aucun envoi", async () => {
    await graine(formeA(A), "attente_email");
    await deposerCommentaire(depots, { idAuteur: A, idCommentaire: "com-t3", motSeul: "stop" });
    await passer(ENV_B, T0);
    expect(Object.keys(await tout())).toEqual([formeA(A)]);
    expect((await tout())[formeA(A)].etat).toBe("oppose");
    expect(await seulA()).toBe(0);
    expect(await Opp.personneOpposee(A, "zernio-conversation", { env: ENV_B_SEUL })).toBe(true);
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
  });
});

describe("rotation · T5 opposé avant rotation (ancien format, lignes séparées)", () => {
  it("personneOpposee(A) vrai sous B et ajoute B(A) ; commentaire GUIDE clos en silence", async () => {
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [{ id: formeA(A), le: "x", transmise: false }, { id: formeA(FIL), le: "x", transmise: false }]);
    expect(await Opp.personneOpposee(A, "zernio-conversation", { env: ENV_B })).toBe(true);
    expect(JSON.stringify(await lignes())).toContain(formeB(A));
    const id = await deposerCommentaire(depots, { idAuteur: A, idCommentaire: "com-t5" });
    await passer(ENV_B, T0);
    expect((await evenement(depots, id)).charge.etat).toBe("silence");
    expect(port.total()).toBe(0);
  });
});

describe("rotation · (3) commentaire GUIDE après rotation", () => {
  it("silence : pas de second parcours, pas de nouvelle conversation, pas d'envoi", async () => {
    await graine(formeA(A), "attente_email");
    const id = await deposerCommentaire(depots, { idAuteur: A, idCommentaire: "com-rot-3" });
    await passer(ENV_B, T0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(true);
    expect(ev.charge.etat).toBe("silence");
    expect(Object.keys(await tout())).toEqual([formeA(A)]);
    expect((await tout())[formeA(A)].etat).toBe("attente_email");
    expect((await tout())[formeA(A)].alias).toContain(formeB(A)); // migration douce : alias courant ajouté, clé ancienne gardée
    expect(port.pub.length + port.prive.length + port.envoyes.length).toBe(0);
  });
});

describe("rotation · (4) ancien secret retiré trop tôt", () => {
  it("la personne opposée sous A est vue comme nouvelle, mais le registre non couvert lève : rien ne part, événement réessayé", async () => {
    await graine(formeA(A), "oppose");
    await Opp.enregistrerOpposition(A, "zernio-conversation", { env: ENV }); // ligne sous A
    const id = await deposerCommentaire(depots, { idAuteur: A, idCommentaire: "com-rot-4" });
    const rap = await passer(ENV_B_SEUL, T0);
    expect(rap.enAttente).toBe(1);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge.dernierCode).toBe("registre_illisible");
    expect(port.total()).toBe(0);
    expect(site.vus).toHaveLength(0);
    expect(Object.keys(await tout())).toEqual([formeA(A)]); // aucun second parcours
  });
});

describe("rotation · (5) l'alias du fil d'abord", () => {
  it("alias courant (fil) → conversation 2 ; clé ancienne de l'expéditeur → conversation 1 : c'est la conversation 2 qui est suivie", async () => {
    const cleAutre = formeA("autre-personne-fictive-900");
    await graine(formeA(A), "attente_email"); // conversation 1 : clé ancienne de l'expéditeur
    await graine(cleAutre, "attente_email", { alias: [formeB(FIL)] }); // conversation 2 : alias courant du fil
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { [formeB(FIL)]: cleAutre });
    port.reponses.texte = () => `Mon adresse : ${ADRESSE_FICTIVE}`;
    const id = await deposerMessage(depots, { idExpediteur: A, idConversation: FIL, idMessage: "msg-rot-5" });
    await passer(ENV_B, T0);
    expect((await evenement(depots, id)).charge.etat).toBe("termine");
    const conv = await tout();
    expect(conv[cleAutre].etat).toBe("termine");
    expect(conv[formeA(A)].etat).toBe("attente_email");
    expect(Object.keys(conv).sort()).toEqual([cleAutre, formeA(A)].sort());
  });
});

describe("rotation · T4 alias ancien du fil avant la clé courante de l'expéditeur", () => {
  it("conv 1 (alias ancien du fil) est suivie ; conv 2 (clé courante de l'expéditeur) intacte ; B(FIL) devient alias de conv 1", async () => {
    await graine(formeA("conv1-fictive-801"), "attente_email", { alias: [formeA(FIL)] });
    await graine(formeB(A), "attente_email");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { [formeA(FIL)]: formeA("conv1-fictive-801") });
    port.reponses.texte = () => `Mon adresse : ${ADRESSE_FICTIVE}`;
    await deposerMessage(depots, { idExpediteur: A, idConversation: FIL, idMessage: "msg-t4" });
    await passer(ENV_B, T0);
    const conv = await tout();
    expect(conv[formeA("conv1-fictive-801")].etat).toBe("termine");
    expect(conv[formeB(A)].etat).toBe("attente_email");
    expect(conv[formeA("conv1-fictive-801")].alias).toContain(formeB(FIL));
  });
});

describe("rotation · registre : compte de conversations par kid (nombres seulement)", () => {
  it("compte les conversations par kid, clés et alias compris, sans aucune empreinte", async () => {
    await graine(formeA(A), "attente_email", { alias: [formeB(A)] });
    await graine(formeA("autre-fictif-901"), "attente_email");
    await graine(formeB("autre-fictif-902"), "termine");
    const k = clesDe(ENV_B);
    const etat = await Opp.etatRegistreEmpreintes({ env: ENV_B });
    expect(etat.conversationsParKid[k.anciennes[0].kid]).toBe(2);
    expect(etat.conversationsParKid[k.courante.kid]).toBe(2);
    expect(etat.conversationsActivesParKid[k.anciennes[0].kid]).toBe(2);
    expect(etat.conversationsActivesParKid[k.courante.kid]).toBe(1); // la conversation « termine » n'est plus active
    expect(JSON.stringify(etat)).not.toMatch(/[0-9a-f]{32}/);
  });
});
