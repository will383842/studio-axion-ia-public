/**
 * G4-10a · composition « TableauDeBordVideo » et durée pure (studio-rendu/compositions/donnees), NON inscrite dans Racine.tsx.
 * PIÈGE (PIEGE-REMOTION-TSC.md) : les fichiers de `studio-rendu/compositions/**` sont chargés par un chemin CALCULÉ
 * (jamais littéral : le tsc racine suivrait l'import et échouerait sur « remotion »). `remotion` est simulé (seulement ce qui sert).
 * Aucun rendu vidéo, aucun réseau, aucun appel à Claude.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { planDepuisDonnees } from "../../../src/briques/donnees-video/plan-depuis-donnees";
import type { TableauDeBord } from "../../../src/briques/donnees-video/types";
import { COMPOSITION_DONNEES, dureeImagesDonnees } from "../../../src/moteurs/montage-donnees/proprietes";

vi.mock("remotion", () => {
  const boite = (p: { children?: ReactNode }) => createElement("div", null, p.children);
  return {
    AbsoluteFill: boite,
    Sequence: boite,
    Audio: (p: { src: string }) => createElement("audio", { src: p.src }),
    Img: (p: { src: string }) => createElement("img", { src: String(p.src) }),
    useCurrentFrame: () => 10,
    useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 100 }),
    interpolate: (v: number, a: number[], b: number[]) => (v <= a[0] ? b[0] : v >= a[a.length - 1] ? b[b.length - 1] : b[0]),
    Easing: { bezier: () => (t: number) => t },
    delayRender: () => 1,
    continueRender: () => undefined,
    staticFile: (s: string) => s,
  };
});

const DOSSIER = ["studio-rendu", "compositions", "donnees"];
const CHEMIN_COMPOSANT = ["..", "..", "..", ...DOSSIER, "TableauDeBordVideo"].join("/");
const CHEMIN_DUREE = ["..", "..", "..", ...DOSSIER, "duree"].join("/");
type Plan = { dureeMs: number; format: { largeur: number; hauteur: number; fps: number } };
type ModuleComposant = {
  TableauDeBordVideo: (p: { plan: Plan; audio?: string }) => unknown;
  metaTableauDeBordVideo: (a: { props: { plan: Plan } }) => { durationInFrames: number; fps: number; width: number; height: number };
  COMPOSITION_DONNEES_RENDU: string;
};
type ModuleDuree = { DUREE_CARTE_FIN_MS: number; dureeImagesScenes(p: Plan): number; dureeImagesCarteFin(fps: number, ms?: number): number; dureeImagesTableauDeBord(p: Plan, ms?: number): number };
const chargerComposant = async () => (await import(/* @vite-ignore */ CHEMIN_COMPOSANT)) as ModuleComposant;
const chargerDuree = async () => (await import(/* @vite-ignore */ CHEMIN_DUREE)) as ModuleDuree;
const lire = (c: string) => readFileSync(c, "utf8");
const TEXTE_COMPOSANT = lire(join(...DOSSIER, "TableauDeBordVideo.tsx"));

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const donnee: TableauDeBord = {
  version: "tableau-de-bord.v1",
  titre: "Bilan fictif du trimestre",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "Premier trimestre (exemple)" },
  source: "Outil exemple",
  indicateurs: [
    { id: "visites-fev", libelle: "Visites février", valeur: 1000, unite: "visites", precision: 0, sens: "hausse-bonne" },
    { id: "visites-mars", libelle: "Visites mars", valeur: 1240, unite: "visites", precision: 0, sens: "hausse-bonne" },
  ],
  series: [{ id: "visites", libelle: "Visites par semaine", unite: "visites", points: Array.from({ length: 8 }, (_, k) => ({ x: `S${k + 1}`, valeur: 300 + k * 10 })) }],
  comparaisons: [{ avant: "visites-fev", apres: "visites-mars" }],
  alertes: [],
  calculs: [],
};
const plan = () => planDepuisDonnees(donnee, { format: FORMAT, dureeMs: 20000 }).resultat.plan as unknown as Plan & { scenes: { debutMs: number; finMs: number }[] };

function fichiers(d: string): string[] {
  return readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : [join(d, n)]));
}

describe("G4-10a · durée pure", () => {
  it("durée = scènes + carte de fin, et scènes = dureeImagesDonnees du moteur", async () => {
    const d = await chargerDuree();
    const p = plan();
    expect(p.scenes.length).toBeGreaterThan(0);
    expect(d.dureeImagesScenes(p)).toBe(dureeImagesDonnees({ plan: p as never }));
    expect(d.dureeImagesCarteFin(25)).toBe(63);
    expect(d.dureeImagesTableauDeBord(p)).toBe(d.dureeImagesScenes(p) + 63);
    expect(d.dureeImagesTableauDeBord({ dureeMs: 0.001, format: FORMAT })).toBe(1 + 63);
    expect(d.DUREE_CARTE_FIN_MS).toBe(2500);
  });
  it("le fichier de durée n'importe rien", () => {
    expect(lire(join(...DOSSIER, "duree.ts"))).not.toMatch(/^\s*import\s/m);
  });
});

describe("G4-10a · composition", () => {
  it("rend statiquement sans erreur : plan, carte de fin, voix seulement si fournie", async () => {
    const { TableauDeBordVideo } = await chargerComposant();
    const p = plan();
    const muet = renderToStaticMarkup(createElement(TableauDeBordVideo as never, { plan: p }));
    expect(muet).toContain("axion-ia.com");
    expect(muet).not.toContain("<audio");
    const voix = renderToStaticMarkup(createElement(TableauDeBordVideo as never, { plan: p, audio: "https://exemple.invalid/voix.mp3" }));
    expect(voix).toContain("<audio");
  });
  it("les métadonnées suivent le format et la durée pure", async () => {
    const { metaTableauDeBordVideo } = await chargerComposant();
    const d = await chargerDuree();
    const p = plan();
    expect(metaTableauDeBordVideo({ props: { plan: p } })).toEqual({ durationInFrames: d.dureeImagesTableauDeBord(p), fps: 25, width: 1080, height: 1920 });
  });
  it("le nom est cohérent avec COMPOSITION_DONNEES", async () => {
    expect((await chargerComposant()).COMPOSITION_DONNEES_RENDU).toBe(COMPOSITION_DONNEES);
    expect(TEXTE_COMPOSANT).toMatch(/export function TableauDeBordVideo\(/);
    expect(TEXTE_COMPOSANT).toContain(`"${COMPOSITION_DONNEES}"`);
  });
  it("le type de propriétés recopié est identique, champ par champ, à celui du moteur", () => {
    const champs = (t: string, nom: string) => {
      const m = t.match(new RegExp(`export type ${nom} = \\{([\\s\\S]*?)\\n\\};`));
      expect(m).not.toBeNull();
      return (m?.[1] ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("/**") && !l.startsWith("*") && !l.startsWith("//"));
    };
    const moteur = champs(lire("src/moteurs/montage-donnees/proprietes.ts"), "ProprietesMontageDonnees");
    expect(moteur).toEqual(["plan: PlanValide;", "audio?: string;", "sousTitres?: DonneesCalque;"]);
    expect(champs(TEXTE_COMPOSANT, "ProprietesTableauDeBordVideo")).toEqual(moteur);
  });
});

describe("G4-10a · périmètre", () => {
  it("aucun fichier de studio-rendu n'importe « @/ »", () => {
    for (const f of fichiers("studio-rendu").filter((n) => /\.tsx?$/.test(n) && !n.includes("node_modules"))) {
      expect(lire(f), f).not.toMatch(/from\s+["']@\//);
    }
  });
  it("Racine.tsx cite TableauDeBordVideo exactement une fois (1 import, 1 Composition id=\"MontageDonnees\") et les fichiers neufs n'importent pas src/ (hors types déjà copiés)", () => {
    const racine = lire("studio-rendu/compositions/Racine.tsx");
    expect(racine.match(/^import .*donnees\/TableauDeBordVideo"/gm)).toHaveLength(1);
    expect(racine.match(/<Composition id="MontageDonnees" component=\{TableauDeBordVideo\}/g)).toHaveLength(1);
    const imports = [...TEXTE_COMPOSANT.matchAll(/^import (type )?.*from "(\.\.\/\.\.\/\.\.\/src\/[^"]+)"/gm)];
    expect(imports.every((m) => m[1] === "type " && /briques\/(plan-scenes|sous-titres)\//.test(m[2]))).toBe(true);
  });
  it("le texte affiché ne contient pas d'apostrophe droite non échappée et aucun son neuf", () => {
    expect(TEXTE_COMPOSANT).not.toMatch(/>[^<{]*'[^<{]*</);
    expect(TEXTE_COMPOSANT).not.toMatch(/\.(mp3|wav|ogg)/);
  });
});
