/** RC-32 : ajout de plusieurs scripts d'un coup au stock. Pur, données fictives, aucun appel réel. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { creerEntreeStock, type MessageStock } from "@/domaine/stock-messages";
import { decouperEnBlocs, preparerAjoutEnLot, signatureBloc } from "@/domaine/stock-messages-lot";
import { AjoutStockEnLot } from "@/components/ecrire/AjoutStockEnLot";

const base = { reseaux: ["linkedin" as const], priorite: "normale" as const, creeLe: "2026-11-30T08:00:00Z" };
const idDe = (i: number) => `lot-${i}`;
const cinq = ["Bloc un", "Bloc deux\nsur deux lignes", "Bloc trois", "Bloc quatre", "Bloc cinq"].join("\n\n");
const existante = (id: string, texte: string): MessageStock => creerEntreeStock({ id, texte, reseaux: ["tiktok"], priorite: "haute" }, "2026-11-01T08:00:00Z");

describe("RC-32 découpage", () => {
  it("5 blocs séparés par une ligne vide donnent 5 blocs", () => {
    expect(decouperEnBlocs(cinq)).toHaveLength(5);
  });
  it("une ligne de tirets sépare aussi, et les fins de ligne Windows sont acceptées", () => {
    expect(decouperEnBlocs("A\r\n---\r\nB\r\n\r\nC\n-----\nD")).toEqual(["A", "B", "C", "D"]);
  });
  it("vide, espaces et séparateurs seuls : aucun bloc", () => {
    expect(decouperEnBlocs("")).toEqual([]);
    expect(decouperEnBlocs("  \n\n \n")).toEqual([]);
    expect(decouperEnBlocs("---\n\n---")).toEqual([]);
  });
  it("un tiret dans une phrase ne sépare pas ; un seul retour à la ligne ne sépare pas", () => {
    expect(decouperEnBlocs("Un - deux\nsuite")).toEqual(["Un - deux\nsuite"]);
  });
  it("signature identique pour un même texte aux espaces près, différente sinon", () => {
    expect(signatureBloc("Bonjour  le monde ")).toBe(signatureBloc("Bonjour le monde"));
    expect(signatureBloc("Bonjour")).not.toBe(signatureBloc("bonjour"));
    expect(signatureBloc("Bonjour")).not.toContain("Bonjour");
  });
});

describe("RC-32 préparation de l'ajout", () => {
  it("5 blocs créent 5 entrées en stock avec réseau et priorité par défaut", () => {
    const r = preparerAjoutEnLot({ texte: cinq, existantes: [], idDe, ...base, priorite: "haute" });
    expect(r.erreur).toBeNull();
    expect(r.aCreer).toHaveLength(5);
    expect(r.doublons).toEqual([]);
    expect(r.aCreer[0]).toMatchObject({ id: "lot-0", texte: "Bloc un", reseaux: ["linkedin"], priorite: "haute", etat: "en-stock", creeLe: base.creeLe });
  });
  it("un bloc identique à une entrée existante est signalé et non dupliqué", () => {
    const ex = existante("e1", "Bloc trois");
    const r = preparerAjoutEnLot({ texte: cinq, existantes: [ex], idDe, ...base });
    expect(r.aCreer).toHaveLength(4);
    expect(r.aCreer.map((m) => m.texte)).not.toContain("Bloc trois");
    expect(r.doublons).toEqual([{ position: 3, texte: "Bloc trois", avec: "e1" }]);
  });
  it("une entrée archivée compte aussi comme existante (rien n'est écrasé)", () => {
    const ex = { ...existante("e1", "Bloc un"), archiveLe: "2026-11-05T08:00:00Z" };
    const r = preparerAjoutEnLot({ texte: "Bloc un", existantes: [ex], idDe, ...base });
    expect(r.aCreer).toEqual([]);
    expect(r.doublons[0].avec).toBe("e1");
  });
  it("un doublon à l'intérieur du collage est signalé, le premier est gardé", () => {
    const r = preparerAjoutEnLot({ texte: "A\n\nB\n\nA", existantes: [], idDe, ...base });
    expect(r.aCreer.map((m) => m.texte)).toEqual(["A", "B"]);
    expect(r.doublons).toEqual([{ position: 3, texte: "A", avec: "saisie:1" }]);
  });
  it("ids stables et uniques ; les entrées existantes ne sont pas modifiées", () => {
    const ex = existante("e1", "Autre");
    const avant = JSON.stringify(ex);
    const r = preparerAjoutEnLot({ texte: cinq, existantes: [ex], idDe, ...base });
    expect(new Set(r.aCreer.map((m) => m.id)).size).toBe(5);
    expect(JSON.stringify(ex)).toBe(avant);
  });
  it("refuse texte vide, réseau absent ou inconnu, priorité inconnue, sans rien créer", () => {
    const v = (o: object) => preparerAjoutEnLot({ texte: cinq, existantes: [], idDe, ...base, ...o });
    expect(preparerAjoutEnLot({ texte: " \n\n", existantes: [], idDe, ...base })).toMatchObject({ aCreer: [], erreur: "Collez au moins un message." });
    expect(v({ reseaux: [] }).erreur).toBe("Choisissez au moins un réseau.");
    expect(v({ reseaux: ["inconnu"] }).erreur).toBe("Réseau inconnu.");
    expect(v({ priorite: "toString" }).erreur).toBe("Choisissez une priorité.");
    expect(v({ reseaux: [] }).aCreer).toEqual([]);
  });
  it("tous les blocs déjà présents : rien à créer, pas d'erreur", () => {
    const r = preparerAjoutEnLot({ texte: "X\n\nY", existantes: [existante("a", "X"), existante("b", "Y")], idDe, ...base });
    expect(r).toMatchObject({ aCreer: [], erreur: null });
    expect(r.doublons).toHaveLength(2);
  });
  it("rejeu : relancer sur le stock déjà complété ne crée plus rien", () => {
    const un = preparerAjoutEnLot({ texte: cinq, existantes: [], idDe, ...base });
    const deux = preparerAjoutEnLot({ texte: cinq, existantes: un.aCreer, idDe, ...base });
    expect(deux.aCreer).toEqual([]);
    expect(deux.doublons).toHaveLength(5);
  });
});

describe("RC-32 composant", () => {
  it("affiche la zone de collage et le bouton d'ajout, en vouvoiement", () => {
    const html = renderToStaticMarkup(createElement(AjoutStockEnLot, { existantes: [], onAjouter: async () => {} }));
    expect(html).toContain("<textarea");
    expect(html).toContain("Ajouter au stock");
    expect(html).toContain("ligne vide");
  });
});
