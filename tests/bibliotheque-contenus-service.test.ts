/** L2-08 : service de lecture « Mes contenus ». Dépôt en mémoire et lecteur de vidéos factice : aucun appel réel. */
import { describe, expect, it } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import type { IdReseau } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { VueVideoCarte } from "@/services/vues";
import { lireBibliotheque, type DependancesBibliotheque } from "@/services/bibliotheque-contenus";
import { filtrerContenus, paginerContenus, type ContenuBibliotheque } from "@/domaine/filtres-contenus";

const T = (n: number) => new Date(Date.parse("2026-11-01T10:00:00.000Z") + n * 60_000).toISOString();

async function monter() {
  const depot = new DepotMemoire<Visuel>();
  const visuel = (id: string, famille: Visuel["famille"], reseaux: Visuel["reseaux"], n: number, extra: Partial<Visuel> = {}): Visuel => ({
    id, famille, titre: `Visuel ${id}`, entree: { type: "sujet", sujet: "Sujet inventé" }, statut: "valide", modeTexte: "simulation",
    pourquoi: [], versionSpec: 1, coutCentimes: 0, creeLe: T(n), modifieLe: T(n), ...(reseaux ? { reseaux } : {}), ...extra,
  });
  await depot.enregistrer(visuel("c1", "carrousel", ["linkedin"], 1));
  await depot.enregistrer(visuel("c2", "carrousel", ["linkedin", "instagram"], 2));
  await depot.enregistrer(visuel("c3", "carrousel-continu", ["instagram"], 3));
  await depot.enregistrer(visuel("c4", "carrousel", undefined, 4));
  await depot.enregistrer(visuel("i1", "infographie", ["linkedin"], 5));
  await depot.enregistrer(visuel("i2", "infographie", ["facebook"], 6));
  await depot.enregistrer(visuel("c5", "carrousel", ["linkedin"], 7, { corbeilleLe: T(8) }));
  const video = (id: string, reseaux: IdReseau[], n: number, extra: Partial<VueVideoCarte> = {}) =>
    ({ id, titre: `Vidéo ${id}`, statut: "prete", reseaux, modifieLe: T(n), creeLe: T(n), ...extra }) as unknown as VueVideoCarte;
  const videos = [video("v1", ["linkedin"], 10, { format: { id: "avocat" } as never }), video("v2", ["tiktok"], 11, { format: { id: "podcast" } as never }), video("v3", ["youtube"], 12, { format: { id: "avocat" } as never }), video("v4", ["linkedin"], 13, { corbeilleLe: T(14) })];
  const deps: DependancesBibliotheque = {
    depot,
    urlLecture: async (cle) => `https://stockage.invente/${cle}`,
    allume: async () => true,
    maintenant: () => T(20),
    listerVideos: async () => videos,
  };
  return deps;
}

describe("lireBibliotheque", () => {
  it("3 vidéos, 4 carrousels, 2 infographies ; corbeille exclue", async () => {
    const r = await lireBibliotheque({}, await monter());
    expect(r.total).toBe(9);
    const par = (t: string) => r.elements.filter((e) => e.type === t).length;
    expect([par("video"), par("carrousel"), par("image")]).toEqual([3, 4, 2]);
    expect(r.elements.map((e) => e.id)).not.toContain("c5");
    expect(r.elements.map((e) => e.id)).not.toContain("v4");
  });
  it("filtre LinkedIn + carrousel exact", async () => {
    const r = await lireBibliotheque({ reseau: "linkedin", type: "carrousel" }, await monter());
    expect(r.elements.map((e) => e.id).sort()).toEqual(["c1", "c2"]);
  });
  it("sans réseau : « non précisé », jamais perdu", async () => {
    const r = await lireBibliotheque({ reseau: "non-precise" }, await monter());
    expect(r.elements.map((e) => e.id)).toEqual(["c4"]);
  });
  it("pagination stable : pages disjointes, ordre récent d'abord, sans trou", async () => {
    const deps = await monter();
    const p1 = await lireBibliotheque({ page: 1, parPage: 4 }, deps);
    const p2 = await lireBibliotheque({ page: 2, parPage: 4 }, deps);
    const p3 = await lireBibliotheque({ page: 3, parPage: 4 }, deps);
    const ids = [...p1.elements, ...p2.elements, ...p3.elements].map((e) => e.id);
    expect(new Set(ids).size).toBe(9);
    expect(ids).toHaveLength(9);
    expect(p1.pages).toBe(3);
    expect(p1.elements[0].id).toBe("v3");
    expect((await lireBibliotheque({ page: 1, parPage: 4 }, deps)).elements.map((e) => e.id)).toEqual(p1.elements.map((e) => e.id));
  });
  it("n'écrit rien dans le dépôt", async () => {
    const deps = await monter();
    const avant = JSON.stringify(await deps.depot.lister(() => true));
    await lireBibliotheque({}, deps);
    expect(JSON.stringify(await deps.depot.lister(() => true))).toBe(avant);
  });
});

describe("filtres purs", () => {
  const a = (id: string, modifieLe: string): ContenuBibliotheque => ({ id, type: "video", titre: id, statut: "pret", reseaux: [], modifieLe });
  it("égalité de date : départage par identifiant", () => {
    const r = paginerContenus([a("b", T(1)), a("a", T(1)), a("c", T(1))], 1, 10);
    expect(r.elements.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
  it("page hors bornes : bornée, jamais d'erreur", () => {
    expect(paginerContenus([a("a", T(1))], 99, 10).page).toBe(1);
    expect(paginerContenus([], 1, 10)).toMatchObject({ total: 0, pages: 1, elements: [] });
  });
  it("filtre par statut commun", () => {
    expect(filtrerContenus([a("a", T(1)), { ...a("b", T(2)), statut: "brouillon" }], { statut: "brouillon" }).map((e) => e.id)).toEqual(["b"]);
  });
});

describe("lireBibliotheque : format (REF-R5)", () => {
  it("le format d'une vidéo filtre ; images et carrousels n'ont pas de champ format", async () => {
    const deps = await monter();
    const r = await lireBibliotheque({ format: "podcast" }, deps);
    expect(r.elements.map((e) => e.id)).toEqual(["v2"]);
    expect(r.elements[0].format).toBe("podcast");
    const tous = await lireBibliotheque({}, deps);
    for (const e of tous.elements.filter((x) => x.type !== "video")) expect("format" in e).toBe(false);
  });
});
