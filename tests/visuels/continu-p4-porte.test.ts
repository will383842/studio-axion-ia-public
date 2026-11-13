import { describe, expect, it } from "vitest";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { controlerToile, empreinteToile } from "../../src/domaine/controles-visuel/porte-continu";
import type { ContextePorte } from "../../src/domaine/visuels/contrats";
import { expressionsBannieDans } from "../../src/domaine/controles-visuel/texte";

const ctx: ContextePorte = { interditsDans: (t) => (/\bgaranti\b/i.test(t) ? ["garanti"] : []), faitsDisponibles: false };
const exemple = (type: string): Record<string, unknown> & { type: string } => ({ ...GABARITS.find((x) => x.type === type)!.exemple, type });
const toile = (pages = [exemple("X00"), exemple("X01"), exemple("X02")], format = "4:5") => ({ version: "toile/1", format, pages, raccords: [] as unknown[] });
const avecTitre = (titre: string) => toile([exemple("X00"), { ...exemple("X01"), titre }, exemple("X02")]);
const codes = (spec: unknown, c: ContextePorte = ctx) => [...new Set(controlerToile(spec, c).rapport.controles.map((x) => x.code))].sort();

describe("continu P4 : porte de la toile, textes", () => {
  it("rapport de version porte-carrousel/1", () => {
    expect(controlerToile(toile(), ctx).rapport.version).toBe("porte-carrousel/1");
  });
  it.each([
    ["Grenoble", "Venez à Grenoble", "EXPRESSION_BANNIE"],
    ["Aucun gain garanti", "Aucun gain garanti", "EXPRESSION_BANNIE"],
    ["J'aide", "J'aide les artisans", "J_AIDE"],
    ["tu", "Tu gagnes du temps", "TUTOIEMENT"],
    ["3 fois plus", "3 fois plus de devis", "CHIFFRE"],
    ["un interdit du contexte", "Résultat garanti", "INTERDIT"],
  ])("« %s » est rouge", (_, titre, code) => {
    const r = controlerToile(avecTitre(titre), ctx).rapport;
    expect(r.verdict).toBe("rouge");
    expect(r.controles.find((c) => c.code === code)).toMatchObject({ niveau: "rouge", page: 2 });
  });
  it("« www.x.fr » est rouge (lien refusé)", () => {
    const r = controlerToile(avecTitre("Lisez www.x.fr"), ctx).rapport;
    expect(r.verdict).toBe("rouge");
    expect(r.controles.some((c) => c.page === 2 && (c.code === "SCHEMA" || c.code === "SORTANT"))).toBe(true);
  });
  it("le format « 3:4 » et un type « PA1 » ne déclenchent pas CHIFFRE", () => {
    expect(codes(toile(undefined, "3:4"))).not.toContain("CHIFFRE");
    expect(codes(toile([exemple("X00"), { type: "PA1", alt: "Une étape", titre: "Une étape", texte: "Pas à pas." }, exemple("X02")]))).not.toContain("CHIFFRE");
  });
  it("les raccords ne sont jamais lus comme du texte (un raccord au texte interdit ne déclenche que SCHEMA)", () => {
    const t = { ...toile(), raccords: [{ type: "R01", couture: 1, y: 980, legende: "Venez à Grenoble, 3 fois plus, tu gagnes" }] };
    const r = controlerToile(t, ctx).rapport;
    expect(r.controles.filter((c) => c.code !== "GABARIT_ETEINT").map((c) => `${c.code}:${c.chemin}`)).toEqual(["SCHEMA:raccords.0"]);
  });
  it("schéma refusé : messages en français, rouge SCHEMA", () => {
    const r = controlerToile({ version: "toile/1", format: "4:5", pages: [], raccords: [] }, ctx).rapport;
    expect(r.verdict).toBe("rouge");
    expect(r.controles[0]).toMatchObject({ code: "SCHEMA", niveau: "rouge" });
    expect(r.controles[0].phrase).not.toMatch(/Invalid|Expected/);
  });
  it("vérifie que le registre de texte voit bien les expressions bannies", () => {
    expect(expressionsBannieDans("Grenoble")).toEqual(["Grenoble"]);
  });
});

describe("continu P4 : porte de la toile, structure et mémoire", () => {
  it("les gabarits d'essai (éteints) sont rouges à la porte", () => {
    expect(codes(toile())).toContain("GABARIT_ETEINT");
  });
  it("répétition d'un des 5 récents : orange", () => {
    const t = toile();
    const e = empreinteToile(t);
    const r = controlerToile(t, { ...ctx, recents: [{ suite: "autre", couverture: "autre" }, e] }).rapport;
    expect(r.controles.filter((c) => c.code === "REPETITION").map((c) => c.niveau)).toEqual(["orange", "orange"]);
    expect(controlerToile(t, { ...ctx, recents: [{ suite: "autre", couverture: "autre" }] }).rapport.controles.some((c) => c.code === "REPETITION")).toBe(false);
  });
  it("l'empreinte porte la suite des types (parcours compris) et la couverture", () => {
    const t = toile([exemple("X00"), exemple("PX1"), exemple("PX2"), exemple("PX3"), exemple("X02")]);
    expect(empreinteToile(t).suite).toContain("PX1 PX2 PX3");
    expect(empreinteToile(t).couverture).toMatch(/^X00/);
  });
});

describe("continu P4 : typographie corrigée", () => {
  it("espaces insécables ajoutées, toile corrigée encore valide, format intact", () => {
    const { rapport, specCorrige } = controlerToile(avecTitre("Prêt ? On commence"), ctx);
    expect(rapport.corrections.length).toBeGreaterThan(0);
    expect((specCorrige!.pages[1] as unknown as { titre: string }).titre).toBe("Prêt ? On commence");
    expect(specCorrige!.format).toBe("4:5");
  });
  it("aucune correction : pas de specCorrige", () => {
    const propre = toile([{ ...exemple("X00"), titre: "Par où commencer", alt: "Par où commencer" }, exemple("X01"), exemple("X02")]);
    expect(controlerToile(propre, ctx).specCorrige).toBeUndefined();
  });
});
