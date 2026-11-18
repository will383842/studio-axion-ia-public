import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import { STYLES_TABLEAU, type StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { graineStyle, styleDuDecoupage } from "@/moteurs/montage-tableau/tirage-style";

type Ligne = Record<string, unknown>;
const etat = vi.hoisted(() => ({ publications: [] as Ligne[], versions: [] as Ligne[], parametres: {} as Record<string, unknown>, appelsPublications: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("@/services/_commun", () => {
  const vide = { lister: async () => [] as Ligne[], creer: async () => undefined, modifier: async () => undefined, supprimer: async () => undefined };
  return {
    depots: () => ({
      publications: { ...vide, lister: async (f?: (x: Ligne) => boolean) => (etat.appelsPublications++, etat.publications.filter((x) => (f ? f(x) : true))) },
      videos: vide,
      versions: { ...vide, lister: async (f?: (x: Ligne) => boolean) => etat.versions.filter((x) => (f ? f(x) : true)) },
      travaux: vide,
    }),
    lireParametre: async (cle: string, defaut: unknown) => (cle in etat.parametres ? etat.parametres[cle] : defaut),
    ecrireParametre: async () => undefined,
  };
});

import { gardeHabillageTableau, RANGS_HABILLAGE_TABLEAU, stylesTableauAEviterCommun } from "@/services/variete-commune/styles-tableau-commun";
import type { GardeCommune } from "@/services/variete-commune/refus";

const LE = "2026-11-18T10:00:00.000Z";
const allume = async (c: string) => (c === "varieteCommune" ? true : undefined);
const pub = (videoId: string, date: string) => ({ id: `p-${videoId}`, videoId, reseau: "linkedin", statut: "publiee", via: "buffer", date });
const version = (videoId: string) => ({ id: `ver-${videoId}`, videoId, statut: "prete", numero: 1, creeLe: "2026-11-10T00:00:00Z", commande: { moteurId: "montage-tableau", formatId: "tableau-anime" }, projetMontage: {} });
/** Pose des voisines LinkedIn, de la plus récente à la plus ancienne, avec leur style noté à l'historique. */
function poser(styles: StyleTableau[]) {
  styles.forEach((style, k) => {
    const id = `voisine-${k}`;
    etat.publications.push(pub(id, `2026-11-${String(17 - k).padStart(2, "0")}`));
    etat.versions.push(version(id));
  });
  etat.parametres["tableau.historiqueStyles"] = styles.map((style, k) => ({ videoId: `voisine-${k}`, style }));
}
const demande = (extra: Record<string, unknown> = {}) => ({ videoId: "en-cours", reseaux: ["linkedin"], le: LE, lire: allume, ...extra });

beforeEach(() => {
  etat.publications = []; etat.versions = []; etat.parametres = {}; etat.appelsPublications = 0;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("a) chemin réel : la voisine publiée en ardoise est évitée", () => {
  it("1 voisine LinkedIn en ardoise → [\"ardoise\"] (master : [])", async () => {
    poser(["ardoise"]);
    expect(await stylesTableauAEviterCommun(demande())).toEqual(["ardoise"]);
  });
});

describe("b) rang des voisines", () => {
  it("rangs 0 et 1 comptent, dans l'ordre de STYLES_TABLEAU", async () => {
    poser(["ardoise", "paperboard"]);
    expect(await stylesTableauAEviterCommun(demande())).toEqual(["ardoise", "paperboard"]);
  });
  it("ardoise au rang 2 seulement : non évitée", async () => {
    poser(["tableau-blanc", "tableau-blanc", "ardoise"]);
    const liste = await stylesTableauAEviterCommun(demande());
    expect(liste).toEqual(["tableau-blanc"]);
    expect(liste).not.toContain("ardoise");
  });
});

describe("c) éteint", () => {
  it.each([["absent", undefined], ["false", false], ['"true"', "true"]])("réglage %s → undefined, publications non lues", async (_n, v) => {
    poser(["ardoise"]);
    expect(await stylesTableauAEviterCommun(demande({ lire: async (c: string) => (c === "varieteCommune" ? v : undefined) }))).toBeUndefined();
    expect(etat.appelsPublications).toBe(0);
  });
});

describe("d) gardeHabillageTableau pure", () => {
  const emp = (videoId: string, formatId: string, habillage?: string[]): EmpreinteVideo => ({ version: "1", videoId, formatId, le: LE, axes: habillage ? { habillage } : {} });
  const ardoise = versCommun("tableau", "habillage", "ardoise");
  const voisine = (e: EmpreinteVideo, rang: number) => ({ empreinte: e, reseau: "linkedin", rang });
  const candidat = emp("c", "tableau", [ardoise]);
  const garde = (c: EmpreinteVideo, v: ReturnType<typeof voisine>[]) => gardeHabillageTableau(c, v, { seuil: 0.5 });

  it("rang 0 → refus, avec la voisine et la phrase", () => {
    expect(garde(candidat, [voisine(emp("v0", "tableau", [ardoise]), 0)])).toEqual({ ok: false, score: 1, voisine: "v0", axesCommuns: ["habillage"], phrase: "même décor que v0" });
  });
  it("rang 1 → refus", () => {
    expect(garde(candidat, [voisine(emp("v0", "tableau", []), 0), voisine(emp("v1", "tableau", [ardoise]), 1)]).ok).toBe(false);
  });
  it("rang 2 → accepté", () => {
    expect(RANGS_HABILLAGE_TABLEAU).toBe(2);
    expect(garde(candidat, [voisine(emp("v2", "tableau", [ardoise]), 2)])).toEqual({ ok: true, score: null, axesCommuns: [], phrase: "" });
  });
  it("candidat ou voisine sans habillage → accepté", () => {
    expect(garde(emp("c", "tableau"), [voisine(emp("v0", "tableau", [ardoise]), 0)]).ok).toBe(true);
    expect(garde(candidat, [voisine(emp("v0", "tableau"), 0)]).ok).toBe(true);
  });
  it("voisine d'un autre générateur portant le même habillage commun → refus pareil", () => {
    expect(garde(candidat, [voisine(emp("iv", "image-video", [ardoise]), 0)]).ok).toBe(false);
  });
});

describe("e) le découpage reçoit la liste (chemin réel styleDuDecoupage)", () => {
  const sans = (id: string) => styleDuDecoupage({ videoId: id, serie: {}, tirage: { historique: [] } });
  // Relevé (graineStyle, 40 identifiants « v-0 »…) : v-4, v-5, v-7 tirent ardoise ; v-0, v-1, v-2, v-3, v-6 non (écrits en dur).
  const huit = ["v-4", "v-5", "v-7", "v-0", "v-1", "v-2", "v-3", "v-6"];

  it("8 identifiants dont ≥ 3 tirent ardoise sans eviter ; avec eviter [ardoise] : jamais ardoise", () => {
    expect(huit.filter((id) => sans(id) === "ardoise")).toEqual(["v-4", "v-5", "v-7"]);
    for (const id of huit) expect(styleDuDecoupage({ videoId: id, serie: {}, tirage: { historique: [], eviter: ["ardoise"] } })).not.toBe("ardoise");
  });
  it("tout évité → même style que sans eviter (règle d'aujourd'hui)", () => {
    for (const id of huit) expect(styleDuDecoupage({ videoId: id, serie: {}, tirage: { historique: [], eviter: [...STYLES_TABLEAU] } })).toBe(sans(id));
  });
  it("sans eviter : identique au tirage par graine (comportement de master)", () => {
    for (const id of huit) expect(sans(id)).toBe(STYLES_TABLEAU[graineStyle(id) % STYLES_TABLEAU.length]);
  });
});

describe("f) garde explicite prioritaire", () => {
  it("la garde injectée est utilisée à la place de celle du tableau", async () => {
    poser(["ardoise"]);
    const garde = vi.fn<GardeCommune>(() => ({ ok: true, score: 0, axesCommuns: [], phrase: "" }));
    expect(await stylesTableauAEviterCommun(demande({ garde }))).toEqual([]);
    expect(garde).toHaveBeenCalled();
  });
});
