/**
 * LIA-E · migration des ANCIENS enregistrements de parcours (format d'avant LIA-C).
 * Format ancien : UN seul parcours à vie par personne, stocké sous la clé nue `racine` (sans `|`), SANS les champs `mot`, `nature`,
 * `groupeM1`, `titreCible` (voir le commentaire « Absent = ancien » de `Conversation`). Les champs de départ sont ceux de `graineConv`.
 * Preuve : la lecture par le code ACTUEL (réglage « plusieurs mots » allumé) ne perd aucune opposition, ne renvoie jamais un guide
 * déjà envoyé, n'écrit jamais un champ à `undefined`, garde les dates, et traite un enregistrement illisible comme « rien ne part ».
 * Données 100 % fictives ; faux port, faux site, aucun réseau.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dossierDe, partieCible } from "@/domaine/guide-reseau/cles-parcours";
import { deciderCommentaire } from "@/domaine/guide-reseau/machine-conversation";
import { lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { AUTEUR, banc, C, Com, depots, graineConv, nettoyer, passer, preparer, T0, toutesLesConversations } from "./filet-guide/_amorce";
import { cleConversation, deposerCommentaire, evenement, ENV } from "./aides/conversation";

const etat = vi.hoisted(() => ({ allume: true }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("@/services/parcours-mots-multiples", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  motsMultiplesActifs: async () => etat.allume,
}));
vi.mock("@/services/cibles-site", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  lireCiblesSite: async () => null,
}));
const Opp = await import("@/services/oppositions-mots");
const OT = await import("@/services/oppositions-transmission");
const { reserverParcours, opposerDossier } = await import("@/services/parcours-dossier");

const H = 3600_000;
const racine = () => cleConversation(AUTEUR);
const cles = () => {
  const k = lireClesEmpreinte(ENV);
  if (!k.ok) throw new Error("clés attendues");
  return k;
};
const CHAMPS_NOUVEAUX = ["mot", "nature", "groupeM1", "titreCible"] as const;

/** Enregistrement au format d'AVANT LIA-C : aucun des quatre champs ajoutés par LIA-C n'existe, pas même à `undefined`. */
function ancien(etatParcours: string, extra: Record<string, unknown> = {}): Record<string, any> {
  const e: Record<string, any> = { ...graineConv(etatParcours, { reseau: "facebook" }), ...extra };
  for (const c of CHAMPS_NOUVEAUX) delete e[c];
  return e;
}
const semerAncien = async (e: Record<string, any>, cle = racine()) =>
  Com.ecrireParametre(C.PARAM_CONVERSATIONS, { ...(await toutesLesConversations()), [cle]: e });
/** Vrai si une valeur `undefined` se cache n'importe où (profondeur comprise) : `JSON` la ferait disparaître sans bruit. */
const aUndefined = (v: unknown): boolean =>
  v === undefined || (typeof v === "object" && v !== null && Object.values(v).some(aUndefined));
const commenter = (id: string, a = T0, mot = "GUIDE") =>
  deposerCommentaire(depots, { idAuteur: AUTEUR, idCommentaire: id, motSeul: mot, ageMs: 1000 - (a - T0), reseau: "facebook" });
const compter = () => ({ pub: banc.port.pub.length, prive: banc.port.prive.length, envoyes: banc.port.envoyes.length });
const reserver = (id: string, maintenantMs = T0, code = "guide-ia") =>
  reserverParcours({
    cles: cles(), idAuteur: AUTEUR, idCommentaire: id, ageMs: 1000, maintenantMs, code,
    creer: (o) => graineConv("nouveau", { cleIdempotenceGuide: o.cleGuide, idCommentaire: id, mot: "GUIDE", nature: o.nature, groupeM1: o.groupeM1 }) as never,
  });

beforeEach(async () => {
  await preparer();
  OT.reinitialiserOppositionsTransmission();
  etat.allume = true;
});
afterEach(nettoyer);

describe("LIA-E · le format ancien est bien celui d'avant LIA-C", () => {
  it("le gabarit ancien n'a aucun des quatre champs de LIA-C et garde ses dates", () => {
    const e = ancien("termine");
    for (const c of CHAMPS_NOUVEAUX) expect(Object.prototype.hasOwnProperty.call(e, c)).toBe(false);
    expect(typeof e.creeLe).toBe("string");
    expect(typeof e.m1Le).toBe("string");
    expect(aUndefined(e)).toBe(false);
  });
});

describe("LIA-E · lecture pure d'un ancien enregistrement (clé nue)", () => {
  it("la clé nue appartient au dossier de la personne ; sans `guide` ou `guide` vide, la cible est `guide-ia`", () => {
    const R = racine();
    const conv = { [R]: ancien("termine") as any, [`${R}|x`]: ancien("termine", { guide: "gde-aaaaaa" }) as any, [`${R}2`]: ancien("oppose") as any };
    const T = dossierDe(R, conv);
    expect(T.map((x) => x.cle).sort()).toEqual([R, `${R}|x`].sort());
    expect(partieCible(T, "guide-ia").map((x) => x.cle)).toEqual([R]);
    const sansGuide = { ...conv[R] };
    delete sansGuide.guide;
    expect(partieCible([{ cle: R, etat: sansGuide }], "guide-ia")).toHaveLength(1);
    expect(partieCible([{ cle: R, etat: { ...conv[R], guide: "" } }], "guide-ia")).toHaveLength(1);
    expect(partieCible([{ cle: R, etat: { ...conv[R], guide: "gde-aaaaaa" } }], "guide-ia")).toHaveLength(0);
  });

  it("opposition ancienne (`oppose`, aucun champ de LIA-C) : silence, quel que soit le mot ou la cible du nouveau commentaire", () => {
    const R = racine();
    const T = [{ cle: R, etat: ancien("oppose") as any }];
    for (const guide of ["guide-ia", "gde-autre"]) {
      const d = deciderCommentaire(T, partieCible(T, guide), { idCommentaire: "c-neuf", ageMs: 1000, maintenantMs: T0 }, { plafondPersonneJour: 3 });
      expect(d).toEqual({ action: "silence", raison: "oppose" });
    }
  });

  it("guide déjà envoyé (ancien, 1 h) : réponse publique seule `deja_envoye`, jamais `demarrer` ni `renvoyer`", () => {
    const R = racine();
    for (const e of [ancien("attente_email"), ancien("m2_envoye"), ancien("guide_demande"), ancien("termine")]) {
      const T = [{ cle: R, etat: e as any }];
      const d = deciderCommentaire(T, partieCible(T, "guide-ia"), { idCommentaire: "c-neuf", ageMs: 1000, maintenantMs: T0 }, { plafondPersonneJour: 3 });
      expect(d).toEqual({ action: "public_seul", raison: "deja_envoye" });
    }
  });

  it("guide ancien déjà envoyé, plus tard : seulement un RENVOI (nouveau lien), jamais un premier envoi", () => {
    const R = racine();
    const T = [{ cle: R, etat: ancien("termine", { creeLe: new Date(T0 - 100 * H).toISOString(), m1Le: new Date(T0 - 99 * H).toISOString() }) as any }];
    const d = deciderCommentaire(T, partieCible(T, "guide-ia"), { idCommentaire: "c-neuf", ageMs: 1000, maintenantMs: T0 }, { plafondPersonneJour: 3 });
    expect(d.action).toBe("renvoyer");
  });

  it("dates toutes illisibles dans un ancien enregistrement : `deja_envoye` (échec fermé), jamais un premier envoi", () => {
    const R = racine();
    for (const dates of [{ creeLe: "n'importe quoi", m1Le: "pas une date" }, { creeLe: "", m1Le: null }]) {
      const T = [{ cle: R, etat: ancien("termine", dates) as any }];
      const d = deciderCommentaire(T, partieCible(T, "guide-ia"), { idCommentaire: "c-neuf", ageMs: 1000, maintenantMs: T0 }, { plafondPersonneJour: 3 });
      expect(d).toEqual({ action: "public_seul", raison: "deja_envoye" });
    }
  });

  it("ancien enregistrement créé il y a longtemps mais dont le message est parti il y a 1 h : la date d'envoi (`m1Le`) fait foi, `deja_envoye` et plafond", () => {
    const R = racine();
    const e = ancien("termine", { creeLe: new Date(T0 - 100 * H).toISOString(), m1Le: new Date(T0 - H).toISOString() });
    const T = [{ cle: R, etat: e as any }];
    expect(deciderCommentaire(T, partieCible(T, "guide-ia"), { idCommentaire: "c-neuf", ageMs: 1000, maintenantMs: T0 }, { plafondPersonneJour: 3 })).toEqual({ action: "public_seul", raison: "deja_envoye" });
    const trois = [R, `${R}|a`, `${R}|b`].map((cle) => ({ cle, etat: ancien("termine", { guide: cle === R ? "guide-ia" : `gde-${cle.slice(-1)}`, creeLe: new Date(T0 - 100 * H).toISOString(), m1Le: new Date(T0 - H).toISOString() }) as any }));
    expect(deciderCommentaire(trois, partieCible(trois, "gde-neuf"), { idCommentaire: "c-neuf", ageMs: 1000, maintenantMs: T0 }, { plafondPersonneJour: 3 })).toEqual({ action: "public_seul", raison: "plafond_personne" });
  });

  it("le plafond par personne compte les messages d'un ancien enregistrement (date gardée)", () => {
    const R = racine();
    const T = [R, `${R}|a`, `${R}|b`].map((cle) => ({ cle, etat: ancien("termine", { guide: cle === R ? "guide-ia" : `gde-${cle.slice(-1)}`, m1Le: new Date(T0 - 5 * 60_000).toISOString() }) as any }));
    const d = deciderCommentaire(T, partieCible(T, "gde-neuf"), { idCommentaire: "c-neuf", ageMs: 1000, maintenantMs: T0 }, { plafondPersonneJour: 3 });
    expect(d).toEqual({ action: "public_seul", raison: "plafond_personne" });
  });
});

describe("LIA-E · le service de réservation sur un ancien enregistrement", () => {
  it("ancien enregistrement envoyé : `public_seul`, rien n'est écrit, l'enregistrement reste identique à l'octet près", async () => {
    const e = ancien("attente_email");
    await semerAncien(e);
    const avant = JSON.stringify(await toutesLesConversations());
    const r = await reserver("com-neuf");
    expect(r.decision).toEqual({ action: "public_seul", raison: "deja_envoye" });
    expect(r.racine).toBe(racine());
    expect(JSON.stringify(await toutesLesConversations())).toBe(avant);
  });

  it("autre cible pour la même personne : démarre, l'ancien enregistrement est intact (dates gardées) et le neuf n'a aucun champ à `undefined`", async () => {
    const e = ancien("termine", { creeLe: new Date(T0 - 50 * H).toISOString(), m1Le: new Date(T0 - 49 * H).toISOString(), occurredAt: new Date(T0 - 48 * H).toISOString() });
    await semerAncien(e);
    const r = await reserver("com-autre", T0, "gde-autre");
    expect(r.decision.action).toBe("demarrer");
    const conv = await toutesLesConversations();
    expect(conv[racine()]).toEqual(e);
    expect(conv[racine()].creeLe).toBe(e.creeLe);
    expect(conv[racine()].m1Le).toBe(e.m1Le);
    expect(conv[racine()].occurredAt).toBe(e.occurredAt);
    expect(Object.keys(conv)).toHaveLength(2);
    expect(r.cle!.startsWith(`${racine()}|`)).toBe(true);
    expect(aUndefined(conv)).toBe(false);
    expect(aUndefined(r.etat)).toBe(false);
  });

  it("racine ANCIENNE (ancien secret) : la forme courante devient un alias vers la racine, sans rien supprimer ni écrire à `undefined`", async () => {
    const vieux = lireClesEmpreinte({ ...ENV, STUDIO_EMPREINTE_SECRET: "secret-fictif-ANCIEN-conversation-0123456789" });
    if (!vieux.ok) throw new Error("clés");
    const { empreintePersonne } = await import("@/domaine/guide-reseau/empreinte-personne");
    const R = empreintePersonne(vieux.courante, "zernio-conversation", AUTEUR);
    const e = ancien("termine", { alias: ["alias-ancien-fictif"] });
    await semerAncien(e, R);
    const r = await reserverParcours({
      cles: lireClesEmpreinte({ ...ENV, STUDIO_EMPREINTE_SECRET: "secret-fictif-NOUVEAU-conversation-0123456789", STUDIO_EMPREINTE_SECRET_ANCIEN: "secret-fictif-ANCIEN-conversation-0123456789" }) as never,
      idAuteur: AUTEUR, idCommentaire: "com-rot", ageMs: 1000, maintenantMs: T0, code: "gde-autre",
      creer: (o) => graineConv("nouveau", { cleIdempotenceGuide: o.cleGuide, idCommentaire: "com-rot", mot: "X", nature: o.nature, groupeM1: o.groupeM1 }) as never,
    });
    expect(r.racine).toBe(R);
    const conv = await toutesLesConversations();
    expect(conv[R]).toEqual(e);
    const alias = await Com.lireParametre<Record<string, string>>(C.PARAM_CONVERSATIONS_ALIAS, {});
    expect(Object.values(alias)).toEqual([R]);
    expect(aUndefined(alias)).toBe(false);
  });
});

describe("LIA-E · une opposition ancienne n'est jamais perdue", () => {
  it("`oppose` ancien : la personne est opposée partout (source état), même pour un identifiant d'un autre espace", async () => {
    await semerAncien(ancien("oppose"));
    expect(await Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).toEqual({ opposee: true, source: "etat" });
  });

  it("témoin : même personne, ancien enregistrement sur une AUTRE cible et sans opposition : le mot GUIDE démarre bien (le banc voit le commentaire), l'ancien est intact", async () => {
    const e = ancien("termine", { guide: "gde-autre", creeLe: new Date(T0 - 100 * H).toISOString(), m1Le: new Date(T0 - 99 * H).toISOString() });
    await semerAncien(e);
    await commenter("com-temoin");
    await passer(T0);
    expect(compter()).toMatchObject({ pub: 1, prive: 1 });
    const conv = await toutesLesConversations();
    expect(conv[racine()]).toEqual(e);
    expect(Object.values(conv).filter((x: any) => x.mot === "GUIDE" && x.nature === "premier")).toHaveLength(1);
    expect(aUndefined(conv)).toBe(false);
  });

  it("`oppose` ancien, puis commentaire en mode allumé sur n'importe quel mot (deux mots essayés) : aucun envoi, aucune écriture", async () => {
    await semerAncien(ancien("oppose"));
    const avant = JSON.stringify(await toutesLesConversations());
    for (const [i, mot] of ["GUIDE", "AUTREMOT"].entries()) {
      const evt = await commenter(`com-op-1-${i}`, T0, mot);
      await passer(T0);
      expect(compter()).toEqual({ pub: 0, prive: 0, envoyes: 0 });
      expect(JSON.stringify(await toutesLesConversations())).toBe(avant);
      expect(String((await evenement(depots, evt)).charge.etat)).toMatch(/^(silence|ecarte)$/);
    }
  });

  it.each(["expire", "perime", "m1_a_verifier"])("ancien enregistrement `%s` (idCommentaire « reduit »), commentaire sur la même cible : jamais un nouveau départ, aucun envoi, l'enregistrement reste identique", async (etatAncien) => {
    const e = ancien(etatAncien, { idCommentaire: "reduit", creeLe: new Date(T0 - 100 * H).toISOString(), m1Le: new Date(T0 - 99 * H).toISOString() });
    await semerAncien(e);
    for (const [i, code] of ["guide-ia", "guide-ia"].entries()) {
      const r = await reserver(`com-reduit-${etatAncien}-${i}`, T0 + i * 60_000, code);
      expect(r.decision.action, `${code}`).not.toBe("demarrer");
    }
    expect(compter()).toEqual({ pub: 0, prive: 0, envoyes: 0 });
    expect(JSON.stringify((await toutesLesConversations())[racine()])).toBe(JSON.stringify(e));
    expect(aUndefined(await toutesLesConversations())).toBe(false);
  });

  it("opposition ancienne SEULEMENT au registre (conversation `termine`) : rien ne part", async () => {
    await semerAncien(ancien("termine", { m1Le: new Date(T0 - 100 * H).toISOString(), creeLe: new Date(T0 - 100 * H).toISOString() }));
    await Opp.enregistrerOpposition(AUTEUR, "zernio-conversation", { env: ENV });
    await commenter("com-op-2");
    await passer(T0);
    expect(compter()).toEqual({ pub: 0, prive: 0, envoyes: 0 });
  });

  it("« stop » reçu d'une personne à enregistrement ancien : passe à `oppose`, dates et champs gardés, rien à `undefined`, rien de supprimé", async () => {
    const e = ancien("attente_email", { occurredAt: new Date(T0 - H).toISOString(), alias: ["alias-fictif-1"], refLienConv: "c1_AbCdEf0123456789_-xyZQ" });
    await semerAncien(e);
    await opposerDossier({ racine: racine(), idsBruts: [AUTEUR], cles: cles().courante, env: ENV, maintenantMs: T0 });
    const apres = (await toutesLesConversations())[racine()];
    expect(apres.etat).toBe("oppose");
    expect(apres).toEqual({ ...e, etat: "oppose", prochainEssaiLe: null });
    expect(Object.keys(apres).sort()).toEqual(Object.keys({ ...e, prochainEssaiLe: null }).sort());
    expect(aUndefined(apres)).toBe(false);
    expect(await Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).toMatchObject({ opposee: true });
  });

  it("une opposition d'un parcours ancien reste vue quand un nouveau dossier `racine|…` existe à côté", async () => {
    const R = racine();
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [R]: ancien("oppose"), [`${R}|a`]: graineConv("termine", { mot: "GUIDE", nature: "premier", groupeM1: "m1-lien" }) });
    expect(await Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).toEqual({ opposee: true, source: "etat" });
  });
});

describe("LIA-E · enregistrement illisible : « au moindre doute rien ne part »", () => {
  const illisibles: Array<[string, unknown]> = [
    ["une chaîne", "corrompu"],
    ["un nombre", 42],
    ["une liste", []],
    ["null", null],
  ];
  it.each(illisibles)("registre « stop partout » : un enregistrement de la personne qui est %s lève (jamais « non opposée »)", async (_n, valeur) => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [racine()]: valeur });
    await expect(Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).rejects.toMatchObject({ code: "conversations" });
  });

  it.each([["une chaîne", "corrompu"], ["une liste", []], ["un nombre", 7]])("tout le paramètre des conversations est %s : « stop partout » lève, jamais « non opposée »", async (_n, valeur) => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, valeur);
    await expect(Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).rejects.toMatchObject({ code: "conversations" });
  });

  it("toute la table d'alias est illisible (une liste) : erreur fermée", async () => {
    await semerAncien(ancien("termine"));
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, []);
    await expect(Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).rejects.toMatchObject({ code: "conversations" });
  });

  it("liste d'alias mal formée dans un ancien enregistrement : erreur fermée", async () => {
    await semerAncien(ancien("termine", { alias: "pas-une-liste" }));
    await expect(Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).rejects.toMatchObject({ code: "conversations" });
  });

  it("table d'alias mal formée : erreur fermée", async () => {
    await semerAncien(ancien("termine"));
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS_ALIAS, { x: 12 });
    await expect(Opp.personneOpposeePartout({ idsBruts: [AUTEUR] }, { env: ENV })).rejects.toMatchObject({ code: "conversations" });
  });

  it.each(illisibles)("service allumé : commentaire d'une personne dont l'enregistrement est %s : aucun envoi du tout", async (_n, valeur) => {
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [racine()]: valeur });
    await commenter("com-ill-1");
    await passer(T0).catch(() => undefined);
    expect(compter()).toEqual({ pub: 0, prive: 0, envoyes: 0 });
    expect(await toutesLesConversations()).toEqual({ [racine()]: valeur });
  });

  it("service allumé : ancien enregistrement dont `etat` est inconnu (valeur d'un futur format) : réponse publique seule `deja_envoye`, aucun message privé, aucun enregistrement neuf", async () => {
    const e = ancien("etat-inconnu-fictif");
    await semerAncien(e);
    const evt = await commenter("com-ill-2");
    await passer(T0);
    expect(compter()).toEqual({ pub: 1, prive: 0, envoyes: 0 });
    expect(await toutesLesConversations()).toEqual({ [racine()]: e });
    expect(`${(await evenement(depots, evt)).charge.etat}/${(await evenement(depots, evt)).charge.dernierCode ?? "-"}`).toBe("public_seul/deja_envoye");
  });
});
