import { describe, expect, it } from "vitest";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { noterToile, PLAFOND_ELIMINATOIRE, POLICES_CONTINU, SEUIL_PRESENTE, SEUIL_RETOUCHE, type MesuresNoteToile } from "../../src/domaine/controles-visuel/note-continu";

const exemple = (type: string) => ({ ...GABARITS.find((x) => x.type === type)!.exemple });
const toile = (pages = [exemple("X00"), exemple("X01"), exemple("X02")]) => ({ version: "toile/1", format: "4:5", pages, raccords: [] });
/** Registre où les essais ont des familles distinctes (les vrais registres arrivent avec P3). */
const FAMILLES: Record<string, "couverture" | "liste" | "appel"> = { X00: "couverture", X01: "liste", X02: "appel" };
const REGISTRE = GABARITS.map((g) => (FAMILLES[g.type] ? { ...g, famille: FAMILLES[g.type] } : g));
const ctxVert = { interditsDans: () => [], faitsDisponibles: false } as const;
/** Mesures parfaites (rendu P2 + mesures attendues des lots suivants). */
const parfaites: MesuresNoteToile = {
  debordements: 0, taillePoliceMin: 30, textesSurCouture: 0, textesHorsMarge: 0, textesCoinReserve: 0, intrusionsMetaP1: 0, chevauchements: 0, debordCouture1: 1, traitsFinsSurCouture: 0,
  textesPresCouture: 0, contrasteMin: 7, orangeHorsTitres: 0, polices: ["Axion Bricolage", "Axion Inter"], textePostConforme: true,
};

describe("continu P4 : note de la toile", () => {
  it("seuils et polices exportés", () => {
    expect(SEUIL_PRESENTE).toBe(90);
    expect(SEUIL_RETOUCHE).toBe(85);
    expect(POLICES_CONTINU).toEqual(["Axion Bricolage", "Axion Instrument Serif", "Axion Inter", "Axion JetBrains Mono"]);
  });
  it("la grille compte 11 critères et 100 points", () => {
    const n = noterToile(toile(), parfaites);
    expect(n.criteres).toHaveLength(11);
    expect(n.criteres.reduce((s, c) => s + c.max, 0)).toBe(100);
  });
  it("mesures parfaites, porte verte (registre de production simulé par une porte forcée) : 100", () => {
    const n = noterToile(toile(), parfaites, { verdictPorte: "vert", gabarits: REGISTRE });
    expect(n.bloquants).toEqual([]);
    expect(n.total).toBe(100);
  });
  it("textesSurCouture = 1 : critère à 0, bloquant, somme 88 ramenée au plafond", () => {
    const n = noterToile(toile(), { ...parfaites, textesSurCouture: 1 }, { verdictPorte: "vert", gabarits: REGISTRE });
    expect(n.criteres.find((c) => c.id === 2)!.points).toBe(0);
    expect(n.criteres.reduce((s, c) => s + c.points, 0)).toBe(88);
    expect(n.bloquants.length).toBe(1);
    expect(n.total).toBe(PLAFOND_ELIMINATOIRE);
    expect(n.total).toBeLessThan(SEUIL_RETOUCHE);
  });
  it("texte < 26 px mesuré : bloquant, somme 88 ramenée au plafond", () => {
    const n = noterToile(toile(), { ...parfaites, taillePoliceMin: 24 }, { verdictPorte: "vert", gabarits: REGISTRE });
    expect(n.criteres.find((c) => c.id === 3)!.points).toBe(0);
    expect(n.criteres.reduce((s, c) => s + c.points, 0)).toBe(88);
    expect(n.bloquants.length).toBe(1);
    expect(n.total).toBe(PLAFOND_ELIMINATOIRE);
  });
  it("porte rouge : charte à 0, bloquant (les gabarits d'essai sont éteints)", () => {
    const n = noterToile(toile(), parfaites, { ctx: ctxVert });
    expect(n.criteres.find((c) => c.id === 6)!.points).toBe(0);
    expect(n.bloquants.some((b) => /Charte/.test(b))).toBe(true);
  });
  it("mesures absentes : les critères qui en dépendent valent 0", () => {
    const n = noterToile(toile(), undefined, { verdictPorte: "vert" });
    for (const id of [2, 3, 4, 5, 8, 9]) expect(n.criteres.find((c) => c.id === id)!.points, `critère ${id}`).toBe(0);
    expect(n.criteres.find((c) => c.id === 1)!.points).toBeLessThan(15);
  });
  it("texte à moins de 100 px d'une couture : zone sûre à 7/10", () => {
    expect(noterToile(toile(), { ...parfaites, textesPresCouture: 2 }, { verdictPorte: "vert" }).criteres.find((c) => c.id === 5)!.points).toBe(7);
  });
  it("textesPresCouture absente : zone sûre à 7/10, non mesurée, raison nommée", () => {
    const { textesPresCouture: _, ...sansPres } = parfaites;
    const c5 = noterToile(toile(), sansPres, { verdictPorte: "vert" }).criteres.find((c) => c.id === 5)!;
    expect(c5).toMatchObject({ points: 7, nonMesure: true });
    expect(c5.raison).toMatch(/textesPresCouture/);
  });
  it("polices absentes ou mal formées : signalées, sans planter", () => {
    const { polices: _, ...sansPolices } = parfaites;
    const c6 = noterToile(toile(), sansPolices, { verdictPorte: "vert" }).criteres.find((c) => c.id === 6)!;
    expect(c6).toMatchObject({ points: 15, nonMesure: true });
    expect(c6.raison).toMatch(/polices/);
    const malFormees = { ...parfaites, polices: "Axion Inter" } as unknown as MesuresNoteToile;
    expect(() => noterToile(toile(), malFormees, { verdictPorte: "vert" })).not.toThrow();
    const melange = { ...parfaites, polices: ["Axion Inter", 3, null] } as unknown as MesuresNoteToile;
    expect(noterToile(toile(), melange, { verdictPorte: "vert" }).criteres.find((c) => c.id === 6)).toMatchObject({ points: 15, nonMesure: false });
  });
  it("police hors liste : charte à 0", () => {
    expect(noterToile(toile(), { ...parfaites, polices: ["Comic Sans"] }, { verdictPorte: "vert" }).criteres.find((c) => c.id === 6)!.points).toBe(0);
  });
  it("page 1 au titre de plus de 10 mots : critère 1 incomplet", () => {
    const long = { ...exemple("X00"), titre: "Un titre beaucoup trop long pour une page qui doit tenir seule" };
    expect(noterToile(toile([long, exemple("X01"), exemple("X02")]), parfaites, { verdictPorte: "vert" }).criteres.find((c) => c.id === 1)!.points).toBeLessThan(15);
  });
  it("un alt vide ou un appel absent en dernière page coûte ses points", () => {
    const sansAppel = toile([exemple("X00"), exemple("X01"), exemple("X03")]);
    expect(noterToile(sansAppel, parfaites, { verdictPorte: "vert" }).criteres.find((c) => c.id === 10)!.points).toBe(0);
    const sansAlt = toile([exemple("X00"), { ...exemple("X01"), alt: " " }, exemple("X02")]);
    expect(noterToile(sansAlt, parfaites, { verdictPorte: "vert" }).criteres.find((c) => c.id === 11)!.points).toBe(0);
  });
});
