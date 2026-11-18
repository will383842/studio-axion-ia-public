/** Pioche commune (T-EXT-32) : archive + scènes gardées. Dépôts en mémoire, scènes fictives, aucun réseau, 0 €. */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { plagesDisponibles } from "@/briques/archive-extraits/choix";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import type { ElementBibliotheque, IdReseau, Licence } from "@/domaine/types";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { BesoinPioche, EntreeSceneLue } from "@/services/pioche-commune";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const P = await import("@/services/pioche-commune");

const NOW = new Date("2026-11-16T12:00:00Z");
const ISO = NOW.toISOString();
const lic = (p: Partial<Licence> = {}): Licence => ({ type: "propriete", usageCommercial: true, reseaux: [], ...p });
const plage = (id: string, p: Partial<PlageExtrait> = {}): PlageExtrait => ({
  id, debutSec: 0, finSec: 12, texte: "Une facture claire", motsCles: ["facture"],
  avecVisage: false, texteIncruste: false, etat: "utilisable", usages: ["ecran"], ...p,
});
interface Opt { videoId: string; licence: Licence; famille: string[]; plages: PlageExtrait[] }
const el = (id: string, o: Partial<Opt> = {}): ElementBibliotheque =>
  ({
    id, type: "source-extraits", nom: id, motsCles: [], formatsParDefaut: [], marqueId: "m", licence: o.licence ?? lic(),
    creeLe: ISO, modifieLe: ISO,
    valeur: {
      type: "source-extraits",
      fiche: {
        videoId: o.videoId ?? `v-${id}`, versionId: "ver", sortieId: "s", ratio: "4:5", licence: o.licence ?? lic(),
        famille: o.famille ?? [], plages: o.plages ?? [plage("p1")], rangee: false, sourcePreferee: false,
      },
    },
  }) as unknown as ElementBibliotheque;

type Scene = EntreeSceneLue;
const scene = (videoId: string, sceneId: string, o: Partial<Scene> = {}): Scene => ({
  cle: `scene:${videoId}:${sceneId}:v1`, videoId, sceneId, version: 1, role: "ecran", sujet: null,
  morceau: { scenes: [] } as unknown as PlanValide, dureeMs: 6000, licence: lic(), famille: [videoId], etat: "validee", ...o,
});
const besoin = (o: Partial<BesoinPioche> = {}): BesoinPioche => ({
  capacite: "ecran.telephone-extrait", usage: "ecran", sujet: null, sources: ["archive", "scene"],
  videoDemandeuse: "nouvelle", reseaux: ["linkedin"] as IdReseau[], dejaUtilisees: [], graine: "g1",
  maintenant: NOW, accepteTexteIncruste: true, ...o,
});
const cles = (r: { cle: string }[]) => r.map((x) => x.cle);
const allumer = (v: unknown = true) => depots().parametres.enregistrer({ id: P.PARAM_PIOCHE_COMMUNE, valeur: v, creeLe: ISO, modifieLe: ISO });

beforeEach(() => { reinitialiserDepots(); vi.restoreAllMocks(); });

describe("archive", () => {
  it("mêmes plages que plagesDisponibles seul (clés égales) et visage/note/sujet recopiés", () => {
    const els = [el("a"), el("b", { plages: [plage("p1", { note: 80, sujet: "factures", avecVisage: true })] }), el("c", { famille: ["nouvelle"] })];
    const b = besoin();
    const attendu = plagesDisponibles(els, { videoId: "nouvelle", capacite: b.capacite, reseaux: b.reseaux, dejaUtilisees: [], maintenant: NOW });
    const r = P.candidatsArchive(els, b);
    expect(cles(r)).toEqual(attendu.map((x) => x.cle));
    expect(r[1].visage).toBe("williams");
    expect(r[1].note).toBe(80);
  });
  it("une plage notée est choisie avant une non notée", () => {
    const els = [el("a"), el("b", { plages: [plage("p1", { note: 70 })] })];
    expect(P.piocher(P.candidatsArchive(els, besoin()), besoin())?.cle).toBe("extrait:b:p1");
  });
});

describe("scènes", () => {
  const index = {
    entrees: [
      scene("v-1", "s1"), scene("v-2", "s1"), scene("v-3", "s1"),
      scene("v-4", "s1", { etat: "brouillon" }), scene("v-5", "s1", { etat: "brouillon" }), scene("v-6", "s1", { etat: "retiree" }),
    ],
  };
  it("seules les validées", () => {
    expect(cles(P.candidatsScenes(index, besoin()))).toEqual(["scene:v-1:s1:v1", "scene:v-2:s1:v1", "scene:v-3:s1:v1"]);
  });
  it("licence copiée expirée → exclue ; réseaux non couverts → exclue", () => {
    const i = { entrees: [scene("v-1", "s1", { licence: lic({ expireLe: "2026-11-01" }) }), scene("v-2", "s1", { licence: lic({ reseaux: ["linkedin"] }) })] };
    expect(cles(P.candidatsScenes(i, besoin({ reseaux: ["linkedin", "instagram"] })))).toEqual([]);
    expect(cles(P.candidatsScenes(i, besoin()))).toEqual(["scene:v-2:s1:v1"]);
  });
  it("vidéo demandeuse = source, ou dans la famille → exclue", () => {
    expect(cles(P.candidatsScenes(index, besoin({ videoDemandeuse: "v-1" })))).not.toContain("scene:v-1:s1:v1");
    const i = { entrees: [scene("v-1", "s1", { famille: ["v-1", "nouvelle"] })] };
    expect(P.candidatsScenes(i, besoin())).toEqual([]);
  });
  it("une scène déjà utilisée exclut toutes les scènes de sa vidéo", () => {
    const i = { entrees: [scene("v-1", "s1"), scene("v-1", "s2"), scene("v-2", "s1")] };
    expect(cles(P.candidatsScenes(i, besoin({ dejaUtilisees: ["scene:v-1:s2:v1"] })))).toEqual(["scene:v-2:s1:v1"]);
  });
  it("accepteTexteIncruste absent → aucune scène", () => {
    expect(P.candidatsScenes(index, besoin({ accepteTexteIncruste: undefined }))).toEqual([]);
  });
  it("ratio : 16:9 exclu, 9:16 et 1:1 repris tels que demandés ; rôle et durées filtrent", () => {
    expect(P.candidatsScenes(index, besoin({ ratio: "16:9" }))).toEqual([]);
    expect(P.candidatsScenes(index, besoin({ ratio: "9:16" }))[0].ratio).toBe("9:16");
    expect(P.candidatsScenes(index, besoin({ role: "autre" }))).toEqual([]);
    expect(P.candidatsScenes(index, besoin({ dureeMinSec: 7 }))).toEqual([]);
    expect(P.candidatsScenes(index, besoin({ dureeMaxSec: 5 }))).toEqual([]);
  });
});

describe("parité de droit archive / scène", () => {
  const cas: { nom: string; licence?: Licence; famille?: string[]; reseaux?: IdReseau[]; dejaPrefixe?: string; exclue: boolean }[] = [
    { nom: "ouverte", exclue: false },
    { nom: "expirée", licence: lic({ expireLe: "2026-01-01" }), exclue: true },
    { nom: "non commerciale", licence: lic({ usageCommercial: false }), exclue: true },
    { nom: "à vérifier", licence: lic({ type: "a-verifier" }), exclue: true },
    { nom: "réseau non couvert", licence: lic({ reseaux: ["linkedin"] }), reseaux: ["linkedin", "instagram"], exclue: true },
    { nom: "dans la famille", famille: ["nouvelle"], exclue: true },
  ];
  it.each(cas)("$nom : mêmes exclusions des deux côtés", (c) => {
    const b = besoin({ reseaux: c.reseaux ?? ["linkedin"] });
    const a = P.candidatsArchive([el("x", { licence: c.licence, famille: c.famille })], b);
    const s = P.candidatsScenes({ entrees: [scene("v-x", "s1", { licence: c.licence ?? lic(), famille: ["v-x", ...(c.famille ?? [])] })] }, b);
    expect(a.length === 0).toBe(c.exclue);
    expect(s.length === 0).toBe(c.exclue);
  });
  it("une source par vidéo : déjà-utilisée exclut la source des deux côtés", () => {
    const a = P.candidatsArchive([el("x", { plages: [plage("p1"), plage("p2")] })], besoin({ dejaUtilisees: ["extrait:x:p1"] }));
    const s = P.candidatsScenes({ entrees: [scene("v-x", "s1"), scene("v-x", "s2")] }, besoin({ dejaUtilisees: ["scene:v-x:s1:v1"] }));
    expect(a).toEqual([]);
    expect(s).toEqual([]);
  });
});

describe("mélange", () => {
  const els = [el("a", { plages: [plage("p1"), plage("p2")] }), el("b")];
  const i = { entrees: [scene("v-1", "s1"), scene("v-2", "s1")] };
  const tous = (b: BesoinPioche) => [...P.candidatsArchive(els, b), ...P.candidatsScenes(i, b)];
  it("même graine = même choix (10 répétitions)", () => {
    const b = besoin();
    const premier = P.piocher(tous(b), b)?.cle;
    expect(premier).toBeDefined();
    for (let n = 0; n < 10; n++) expect(P.piocher(tous(b), b)?.cle).toBe(premier);
  });
  it("une clé extrait: ET une clé scene: dans dejaUtilisees : les deux exclues", () => {
    const b = besoin({ dejaUtilisees: ["extrait:b:p1", "scene:v-2:s1:v1"] });
    const toutes = tous(besoin()); // candidats sans filtre de déjà-utilisées
    const r = P.piocher(toutes, b);
    expect(r?.cle).not.toBe("extrait:b:p1");
    expect(r?.cle).not.toBe("scene:v-2:s1:v1");
    const seuls = toutes.filter((c) => ["extrait:b:p1", "scene:v-2:s1:v1"].includes(c.cle));
    expect(P.piocher(seuls, b)).toBeNull();
  });
  it("un extrait noté passe avant une scène non notée, quel que soit le score (ordre de choisirExtrait)", () => {
    const e = [el("n", { plages: [plage("p1", { note: 50 })] })];
    const b = besoin();
    const r = P.piocher([...P.candidatsScenes(i, b), ...P.candidatsArchive(e, b)], b);
    expect(r?.source).toBe("archive");
  });
  it("graine différente : l'ordre ne change qu'à égalité (même score, même statut noté, même ancienneté)", () => {
    const b = besoin();
    const deux = P.candidatsScenes({ entrees: [scene("v-1", "s1"), scene("v-2", "s1")] }, b);
    const choix = new Set(Array.from({ length: 30 }, (_, k) => P.piocher(deux, { ...b, graine: `g${k}` })?.cle));
    expect(choix.size).toBe(2); // à égalité stricte, deux graines peuvent donner deux choix
    const entrees = [scene("v-1", "s1"), scene("v-2", "s1", { sujet: "factures" as never })];
    const cands = P.candidatsScenes({ entrees }, besoin({ sujet: "factures" as never }));
    for (let k = 0; k < 30; k++) {
      expect(P.piocher(cands, besoin({ sujet: "factures" as never, graine: `g${k}` }))?.cle).toBe("scene:v-2:s1:v1");
    }
  });
  it("usage absent : rien", () => {
    const b = besoin({ usage: "fond" });
    expect(P.piocher(tous(besoin()), b)).toBeNull();
  });
});

describe("piocherCommun : éteint par défaut", () => {
  const ports = (lecteur = vi.fn(async () => ({ entrees: [scene("v-1", "s1")] }))) => ({ depots, scenes: lecteur });
  it.each([[undefined], ["true"], [1], [null]])("réglage %s → null, aucun dépôt lu", async (v) => {
    if (v !== undefined) await allumer(v);
    const espion = vi.spyOn(depots().elements, "lister");
    const scenes = vi.fn(async () => ({ entrees: [scene("v-1", "s1")] }));
    expect(await P.piocherCommun(besoin(), ports(scenes))).toBeNull();
    expect(espion).not.toHaveBeenCalled();
    expect(scenes).not.toHaveBeenCalled();
  });
  it("lecture du réglage qui lève → null, sans lever", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("boum"));
    expect(await P.piocherCommun(besoin(), ports())).toBeNull();
  });
  it("allumé (true exact) : pioche dans les deux stockages", async () => {
    await allumer(true);
    await depots().elements.enregistrer(el("a"));
    const r = await P.piocherCommun(besoin({ sources: ["scene"] }), ports());
    expect(r?.cle).toBe("scene:v-1:s1:v1");
    const r2 = await P.piocherCommun(besoin({ sources: ["archive"] }), ports());
    expect(r2?.cle).toBe("extrait:a:p1");
  });
  it("lecture des éléments qui lève (allumé) → null", async () => {
    await allumer(true);
    vi.spyOn(depots().elements, "lister").mockRejectedValue(new Error("boum"));
    expect(await P.piocherCommun(besoin(), ports())).toBeNull();
  });
});

describe("garde statique", () => {
  const src = readFileSync("src/services/pioche-commune.ts", "utf8");
  it("n'importe ni extraits-maison-v4, ni telephone-extrait-v4, ni fournisseurs, ni credits, ni depense-claude", () => {
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*from\b/.test(l)).join("\n");
    expect(imports).not.toMatch(/extraits-maison-v4|telephone-extrait-v4|@\/fournisseurs|credits|depense-claude/);
  });
  it("aucun fichier de src/ n'importe pioche-commune", () => {
    const sortie = execSync("grep -rln 'pioche-commune' src || true", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
    expect(sortie).toEqual(["src/services/pioche-commune.ts"]);
  });
});
