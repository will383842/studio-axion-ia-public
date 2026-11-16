import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { lireMemoiresB, lireMemoiresA, CLE_TIRAGES_CAS_CONCRET, CLE_STYLES_TABLEAU } = await import("@/services/bibliotheque-video-memoires");
const { ecrireParametre } = await import("@/services/_commun");
const { tirer } = await import("@/moteurs/montage-cas-concret/variete");
const { historiqueVarieteIV } = await import("@/moteurs/montage-image-video/fabrication");
const { historiqueTirages, CLE_HISTORIQUE_TIRAGES } = await import("@/services/cas-concret-variete");
const { historiqueStylesTableau, CLE_HISTORIQUE_STYLES } = await import("@/services/tableau-variete");
const { PROFONDEUR_MEMOIRE } = await import("@/briques/bibliotheque-video/profondeurs");
const { AXES_VARIETE, codeDe } = await import("@/briques/schema-motion/variete");

const FEN = { fenetreVideos: 50, portee: "globale" as const };
const FEN_FORMAT = { fenetreVideos: 50, portee: "format" as const };
const jour = (n: number) => `2026-11-${String(n).padStart(2, "0")}T10:00:00.000Z`;
const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

const tirage = tirer({ videoId: "fixture", canaux: ["facebook"], historique: [] });
const ligneCC = (n: number, canaux: string[]) => ({ videoId: `vid${n}`, le: jour(n), canaux, tirage });
const recette = (n: number) => ({ ouverture: `o${n}`, camera: `c${n}` });

const travailIV = (n: number, o: { etape?: string; variete?: boolean; video?: string; effective?: boolean } = {}) => ({
  id: `tr${n}`, cibleId: o.video ?? `vid${n}`, creeLe: jour(n), termineLe: jour(n),
  parametres: { imageVideo: { etape: o.etape ?? "prete", demande: { videoId: o.video ?? `vid${n}` }, ...(o.variete === false ? {} : { variete: { recette: recette(n), par: "tirage", historique: 0, ...(o.effective ? { effective: recette(n + 100) } : {}) } }) } },
}) as never;

beforeEach(() => { reinitialiserDepots(); });

describe("image→vidéo", () => {
  it("égale à historiqueVarieteIV du moteur : refusée, sans variété, vidéo en cours exclues, 10 au plus", async () => {
    for (let n = 1; n <= 12; n++) await depots().travaux.enregistrer(travailIV(n, { effective: n === 11 }));
    await depots().travaux.enregistrer(travailIV(13, { etape: "refusee" }));
    await depots().travaux.enregistrer(travailIV(14, { variete: false }));
    await depots().travaux.enregistrer(travailIV(15, { video: "enCours" }));
    const r = await lireMemoiresB({ formatId: "image-video", videoIdEnCours: "enCours", fenetre: FEN_FORMAT });
    const lus = r.horsCatalogue.filter((x) => x.source === "image-video-variete");
    expect(lus).toHaveLength(10);
    expect(r.profondeurs["image-video-variete"]).toBe(10);
    const travaux = (await depots().travaux.lister(() => true)).filter((t) => !!(t.parametres as { imageVideo?: { variete?: unknown } })?.imageVideo?.variete);
    travaux.sort((a, b) => (b.termineLe ?? b.creeLe).localeCompare(a.termineLe ?? a.creeLe));
    const attendu = historiqueVarieteIV(travaux.map((t) => (t.parametres as { imageVideo: never }).imageVideo), "enCours");
    const cle = (x: Record<string, unknown>) => `recette:${[...AXES_VARIETE].sort().map((a) => `${a}=${String(codeDe(x, a))}`).join(",")}`;
    expect(lus.map((x) => x.cle)).toEqual(attendu.map((x) => cle(x as never)));
    expect(lus.map((x) => x.rang)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(lus.some((x) => x.videoId === "enCours" || x.videoId === "vid13" || x.videoId === "vid14")).toBe(false);
    // recette effective préférée à la recette tirée
    expect(lus.find((x) => x.videoId === "vid11")?.cle).toContain("ouverture=o111");
  });
});

describe("cas concret", () => {
  it("une entrée par ligne, plus récente = rang 0, vidéo en cours exclue, égale à historiqueTirages()", async () => {
    await ecrireParametre(CLE_TIRAGES_CAS_CONCRET, [1, 2, 3, 4].map((n) => ligneCC(n, n === 4 ? ["x", "a"] : ["a"])));
    const r = await lireMemoiresB({ formatId: "cas-concret", videoIdEnCours: "vid2", fenetre: FEN_FORMAT });
    const lus = r.horsCatalogue.filter((x) => x.source === "cas-concret-tirages");
    expect(lus.map((x) => [x.videoId, x.rang])).toEqual([["vid4", 0], ["vid3", 1], ["vid1", 2]]);
    expect(lus[0]?.cle).toBe("tirage:a,x");
    expect(lus[1]?.cle).toBe("tirage:a");
    expect((await historiqueTirages()).length).toBe(4);
    const toutes = await lireMemoiresB({ formatId: "cas-concret", fenetre: FEN_FORMAT });
    expect(toutes.horsCatalogue).toHaveLength((await historiqueTirages()).length);
  });
  it("réglage illisible → vide sans exception", async () => {
    await ecrireParametre(CLE_TIRAGES_CAS_CONCRET, "n'importe quoi");
    const r = await lireMemoiresB({ formatId: "cas-concret", fenetre: FEN_FORMAT });
    expect(r.horsCatalogue).toEqual([]);
    expect(r.profondeurs["cas-concret-tirages"]).toBe(0);
  });
});

describe("tableau", () => {
  it("styles : rang, vidéo en cours exclue, égal à historiqueStylesTableau(), illisible → vide", async () => {
    await ecrireParametre(CLE_STYLES_TABLEAU, [{ videoId: "v1", style: "ardoise" }, { videoId: "v2", style: "x-inconnu" }, { videoId: "v3", style: "ardoise" }]);
    const attendu = await historiqueStylesTableau();
    const r = await lireMemoiresB({ formatId: "tableau-anime", fenetre: FEN_FORMAT });
    expect(r.horsCatalogue).toHaveLength(attendu.length);
    expect(r.horsCatalogue.map((x) => x.videoId)).toEqual([...attendu].reverse().map((x) => x.videoId));
    expect(r.horsCatalogue.every((x) => x.source === "tableau-styles" && x.cle.startsWith("style:"))).toBe(true);
    const sans = await lireMemoiresB({ formatId: "tableau-anime", videoIdEnCours: attendu[0]?.videoId, fenetre: FEN_FORMAT });
    expect(sans.horsCatalogue).toHaveLength(attendu.length - 1);
    await ecrireParametre(CLE_STYLES_TABLEAU, 42);
    expect((await lireMemoiresB({ formatId: "tableau-anime", fenetre: FEN_FORMAT })).horsCatalogue).toEqual([]);
  });
});

describe("portée", () => {
  it("format tableau-anime : ni cas concret ni image→vidéo lus", async () => {
    await ecrireParametre(CLE_TIRAGES_CAS_CONCRET, [ligneCC(1, ["a"])]);
    await depots().travaux.enregistrer(travailIV(1));
    const r = await lireMemoiresB({ formatId: "tableau-anime", fenetre: FEN_FORMAT });
    expect(Object.keys(r.profondeurs)).toEqual(["tableau-styles"]);
    expect(r.horsCatalogue).toEqual([]);
    const g = await lireMemoiresB({ formatId: "tableau-anime", fenetre: FEN });
    expect(Object.keys(g.profondeurs).sort()).toEqual(["cas-concret-tirages", "image-video-variete", "tableau-styles"]);
  });
  it("lireMemoiresA toujours utilisable à côté", async () => {
    const a = await lireMemoiresA({ formatId: "avocat", fenetre: FEN_FORMAT });
    expect(a.usages).toEqual([]);
  });
});

describe("constantes et profondeurs", () => {
  it("clés de réglage = constantes des services", () => {
    expect(CLE_TIRAGES_CAS_CONCRET).toBe(CLE_HISTORIQUE_TIRAGES);
    expect(CLE_STYLES_TABLEAU).toBe(CLE_HISTORIQUE_STYLES);
  });
  it("PROFONDEUR_MEMOIRE a les 8 sources", () => {
    const sources = ["bibliotheque-video", "avocat-cartes", "v4-familles", "v4-extraits", "cas-concret-tirages", "tableau-styles", "image-video-variete", "illustrations"];
    expect(Object.keys(PROFONDEUR_MEMOIRE).sort()).toEqual([...sources].sort());
    expect(PROFONDEUR_MEMOIRE["cas-concret-tirages"]?.videos).toBe(42);
    expect(PROFONDEUR_MEMOIRE["tableau-styles"]?.videos).toBe(42);
    expect(PROFONDEUR_MEMOIRE["image-video-variete"]?.videos).toBe(10);
  });
});

describe("lecture seule", () => {
  it("dépôts identiques avant/après", async () => {
    await ecrireParametre(CLE_TIRAGES_CAS_CONCRET, [ligneCC(1, ["a"])]);
    await depots().travaux.enregistrer(travailIV(1));
    const instantane = async () => JSON.stringify([await depots().travaux.lister(() => true), await depots().parametres.lister(() => true)]);
    const avant = await instantane();
    await lireMemoiresB({ formatId: "x", fenetre: FEN });
    expect(await instantane()).toBe(avant);
  });
  it("garde statique : imports exacts, aucune écriture", () => {
    const src = lire("src/services/bibliotheque-video-memoires.ts");
    const imports = src.match(/from\s+"[^"]+"/g) ?? [];
    expect(imports).not.toContain('from "@/services/image-video"');
    expect(imports).toContain('from "@/moteurs/montage-image-video/fabrication"');
    for (const m of imports) expect(m).not.toMatch(/fournisseurs|argent|plafond|services\/image-video|services\/cas-concret-variete|services\/tableau-variete/);
    for (const interdit of ["ecrireParametre", ".creer(", ".modifier(", ".supprimer("]) expect(src).not.toContain(interdit);
  });
});
