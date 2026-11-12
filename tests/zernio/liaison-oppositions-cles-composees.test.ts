/** LIA-D0 · les oppositions voient les clés composites `racine|xxx`. Données 100 % fictives ; aucun envoi réel. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  empreintePersonne,
  lireClesEmpreinte,
} from "@/domaine/guide-reseau/empreinte-personne";
import { ENV, T0 } from "./aides/conversation";
import { H, graineConv } from "./aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const Opp = await import("@/services/oppositions-mots");
const OT = await import("@/services/oppositions-transmission");
const Com = await import("@/services/_commun");

const CONV = "parcours.conversations";
const ALIAS = "parcours.conversations.alias";
const cles = () => {
  const k = lireClesEmpreinte(ENV);
  if (!k.ok) throw new Error("clés");
  return k.courante;
};
const racineDe = (id: string) => empreintePersonne(cles(), "instagram", id);
const ligne = (id: string) => ({
  id,
  le: "2026-01-01T00:00:00.000Z",
  transmise: false,
});
const conv = (etat: string, extra: Record<string, unknown> = {}) =>
  graineConv(etat, extra);
const verifier = (id: string) =>
  Opp.personneOpposeePartout({ idsBruts: [id] }, { env: ENV });

beforeEach(() => {
  reinitialiserDepots();
  OT.reinitialiserOppositionsTransmission();
});
afterEach(() => vi.restoreAllMocks());

describe("personneOpposeePartout : clés composites", () => {
  it("1) dossier ancien R (terminé) + R|a opposé : R est opposée (état)", async () => {
    const R = racineDe("ct_r");
    await Com.ecrireParametre(CONV, {
      [R]: conv("termine"),
      [`${R}|a`]: conv("oppose"),
    });
    expect(await verifier("ct_r")).toEqual({ opposee: true, source: "etat" });
  });

  it("2) seul R|a existe, opposition au registre sous R : opposée", async () => {
    const R = racineDe("ct_r");
    await Com.ecrireParametre(CONV, { [`${R}|a`]: conv("termine") });
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [ligne(R)]);
    expect(await verifier("ct_r")).toEqual({
      opposee: true,
      source: "registre",
    });
  });

  it("2 bis) seul R|a existe et porte un alias Z, opposition au registre sous Z : opposée", async () => {
    const R = racineDe("ct_r");
    const Z = racineDe("ct_z");
    await Com.ecrireParametre(CONV, {
      [`${R}|a`]: conv("termine", { alias: [Z] }),
    });
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [ligne(Z)]);
    expect(await verifier("ct_r")).toEqual({
      opposee: true,
      source: "registre",
    });
  });

  it("3) alias X -> R sans enregistrement R, R|a opposé : opposée via l'identifiant brut de X", async () => {
    const R = racineDe("ct_r");
    const X = racineDe("ct_x");
    await Com.ecrireParametre(CONV, { [`${R}|a`]: conv("oppose") });
    await Com.ecrireParametre(ALIAS, { [X]: R });
    expect(await verifier("ct_x")).toEqual({ opposee: true, source: "etat" });
  });

  it("5) un préfixe voisin R2|a n'est jamais touché", async () => {
    const R = racineDe("ct_r");
    await Com.ecrireParametre(CONV, {
      [`${R}2|a`]: conv("oppose"),
      [R]: conv("termine"),
    });
    const v = await verifier("ct_r");
    expect(v.opposee).toBe(false);
  });
});

describe("rattraperOppositions : dossier voisin", () => {
  it("4) R|a (adresse transmise) non opposé, R|b opposé : R|a est mis en file", async () => {
    const R = racineDe("ct_r");
    const a = conv("termine", {
      occurredAt: new Date(T0 - H).toISOString(),
      idMessageAdresse: "msg-adr-r",
    });
    await Com.ecrireParametre(CONV, {
      [`${R}|a`]: a,
      [`${R}|b`]: conv("oppose"),
    });
    expect(await OT.rattraperOppositions({ env: ENV, maintenantMs: T0 })).toBe(
      1,
    );
    expect(
      Object.keys(
        await Com.lireParametre<Record<string, unknown>>(
          OT.PARAM_OPPOSITIONS_FILE,
          {},
        ),
      ),
    ).toEqual([`${R}|a`]);
  });
});
