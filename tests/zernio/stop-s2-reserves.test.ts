/**
 * MG-STOP01 / S2 · réserves relevées sur #349 (données fictives) :
 * 1. un alias vers une conversation ABSENTE est ignoré, mais sa cible reste un candidat du registre ;
 * 2. une liste d'alias mal formée n'est jamais ignorée en silence : erreur FERMÉE.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  empreintePersonne,
  lireClesEmpreinte,
} from "@/domaine/guide-reseau/empreinte-personne";
import { ENV } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const Opp = await import("@/services/oppositions-mots");

const ID = "personne-fictive-900";
const PARAM_CONV = "parcours.conversations";
const k = () => {
  const c = lireClesEmpreinte(ENV);
  if (!c.ok) throw new Error("clés attendues");
  return c.courante;
};
const forme = (espace: "zernio-conversation" | "instagram", id = ID) =>
  empreintePersonne(k(), espace, id);
const verifier = () =>
  Opp.personneOpposeePartout({ idsBruts: [ID] }, { env: ENV });

beforeEach(() => reinitialiserDepots());

describe("alias vers une conversation absente", () => {
  it("la cible de l'alias reste un candidat : une opposition inscrite sous elle compte", async () => {
    const cibleAbsente = "p1.cible-absente-fictive";
    await Com.ecrireParametre(`${PARAM_CONV}.alias`, {
      [forme("zernio-conversation")]: cibleAbsente,
    });
    await Com.ecrireParametre(Opp.PARAM_OPPOSITIONS_MOTS, [
      { id: cibleAbsente, le: "2026-10-18T09:00:00.000Z", transmise: false },
    ]);
    await expect(verifier()).resolves.toMatchObject({
      opposee: true,
      source: "registre",
    });
  });
  it("sans opposition nulle part : non opposée (jeton émis)", async () => {
    await Com.ecrireParametre(`${PARAM_CONV}.alias`, {
      [forme("zernio-conversation")]: "p1.cible-absente-fictive",
    });
    await expect(verifier()).resolves.toMatchObject({ opposee: false });
  });
});

describe("liste d'alias mal formée : erreur fermée", () => {
  it("alias d'une conversation qui n'est pas une liste", async () => {
    await Com.ecrireParametre(PARAM_CONV, {
      [forme("zernio-conversation")]: {
        etat: "attente_email",
        alias: "pas-une-liste",
      },
    });
    await expect(verifier()).rejects.toThrow(/illisible/i);
  });
  it("alias contenant une valeur qui n'est pas du texte", async () => {
    await Com.ecrireParametre(PARAM_CONV, {
      [forme("zernio-conversation")]: {
        etat: "attente_email",
        alias: ["ok", 42],
      },
    });
    await expect(verifier()).rejects.toThrow(/illisible/i);
  });
  it("même pour la conversation d'une AUTRE personne : on ne peut pas conclure « non opposée »", async () => {
    await Com.ecrireParametre(PARAM_CONV, {
      "p1.autre-personne-fictive": { etat: "attente_email", alias: { x: 1 } },
    });
    await expect(verifier()).rejects.toThrow(/illisible/i);
  });
  it("table d'alias avec une cible qui n'est pas du texte (autre personne)", async () => {
    await Com.ecrireParametre(`${PARAM_CONV}.alias`, {
      "p1.autre-alias-fictif": 7,
    });
    await expect(verifier()).rejects.toThrow(/illisible/i);
  });
  it("liste absente ou bien formée : aucun changement", async () => {
    await Com.ecrireParametre(PARAM_CONV, {
      "p1.autre-personne-fictive": { etat: "attente_email" },
      "p1.autre-2": { etat: "attente_email", alias: ["p1.x"] },
    });
    await expect(verifier()).resolves.toMatchObject({ opposee: false });
  });
});
