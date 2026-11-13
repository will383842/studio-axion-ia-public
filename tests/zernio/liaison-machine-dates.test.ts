/**
 * LIA-C · correctif de la machine : une cible non vide dont TOUTES les dates sont illisibles (hors `m1_refuse`) ne repart jamais en
 * premier envoi : réponse publique seule, raison « deja_envoye ». Données 100 % fictives.
 */
import { describe, expect, it } from "vitest";
import {
  deciderCommentaire,
  type Conversation,
} from "@/domaine/guide-reseau/machine-conversation";

const T = Date.parse("2026-10-18T10:00:30.000Z");
const H = 3600_000;
const enreg = (
  etat: Conversation["etat"],
  extra: Partial<Conversation> = {},
): { cle: string; etat: Conversation } => ({
  cle: `r|${etat}-${Object.keys(extra).length}`,
  etat: {
    etat,
    reseau: "facebook",
    idCompte: "c",
    idCommentaire: "com-x",
    idPostPlateforme: "p",
    versionTexteM1: "mp-m1-v2",
    guide: "guide-ia",
    cleIdempotenceGuide: "b".repeat(64),
    creeLe: new Date(T - 100 * H).toISOString(),
    m1Le: new Date(T - 100 * H).toISOString(),
    occurredAt: null,
    m2Envoye: false,
    essaisSite: 0,
    essaisPub: 0,
    essaisM1: 0,
    prochainEssaiLe: null,
    dernierCode: null,
    alias: [],
    ...extra,
  },
});
const ev = { idCommentaire: "com-nouveau", ageMs: 1000, maintenantMs: T };
const o = { plafondPersonneJour: 3 };

describe("deciderCommentaire · dates illisibles", () => {
  it("toutes les dates illisibles (attente_email) : public seul « deja_envoye », jamais un premier envoi", () => {
    const D = [
      enreg("attente_email", { m1Le: "pas une date", creeLe: "pas une date" }),
    ];
    expect(deciderCommentaire(D, D, ev, o)).toEqual({
      action: "public_seul",
      raison: "deja_envoye",
    });
  });
  it("dates absentes (null / vide) : même résultat", () => {
    const D = [enreg("termine", { m1Le: null, creeLe: "" })];
    expect(deciderCommentaire(D, D, ev, o)).toEqual({
      action: "public_seul",
      raison: "deja_envoye",
    });
  });
  it("un seul `m1_refuse` ancien (sans date d'envoi par nature) : un nouveau parcours peut démarrer (inchangé)", () => {
    const D = [
      enreg("m1_refuse", { refuseLe: new Date(T - 30 * H).toISOString() }),
    ];
    expect(deciderCommentaire(D, D, ev, o)).toEqual({ action: "demarrer" });
  });
  it("un `m1_refuse` récent (sous 24 h) : public seul (inchangé)", () => {
    const D = [enreg("m1_refuse", { refuseLe: new Date(T - H).toISOString() })];
    expect(deciderCommentaire(D, D, ev, o)).toEqual({
      action: "public_seul",
      raison: "deja_envoye",
    });
  });
  it("`m1_refuse` ancien ET un parcours sans date lisible : public seul", () => {
    const D = [
      enreg("m1_refuse", { refuseLe: new Date(T - 30 * H).toISOString() }),
      enreg("attente_email", { m1Le: "x", creeLe: "x" }),
    ];
    expect(deciderCommentaire(D, D, ev, o)).toEqual({
      action: "public_seul",
      raison: "deja_envoye",
    });
  });
  it("une date lisible parmi d'autres illisibles : la règle ordinaire s'applique (inchangé)", () => {
    const D = [
      enreg("attente_email", { m1Le: "x", creeLe: "x" }),
      enreg("attente_email", { m1Le: new Date(T - 60 * H).toISOString() }),
    ];
    expect(deciderCommentaire(D, D, ev, o)).toEqual({
      action: "renvoyer",
      groupe: "lien-rappel",
    });
  });
});
