import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ICONES_BIBLIOTHEQUE } from "../../../src/briques/motion/bibliotheque-icones";

// Le tsc racine exclut studio-rendu (« remotion » y est absent) : le module est donc chargé à l'exécution, par un chemin
// calculé, et non par un import statique qui l'attirerait dans le programme racine (TS2307).
type MiseEnPage = { colonnes: number; caseTaille: number; rangees: number };
type Geometrie = {
  FAMILLES_ICONES: readonly string[];
  MARGE_BAS: number;
  MARGE_HAUT: number;
  nomsDeFamille: (famille: string) => string[];
  miseEnPageFamille: (nombre: number, largeur: number, hauteurMoitie: number) => MiseEnPage;
};
let FAMILLES_ICONES: Geometrie["FAMILLES_ICONES"], MARGE_BAS: number, MARGE_HAUT: number;
let nomsDeFamille: Geometrie["nomsDeFamille"], miseEnPageFamille: Geometrie["miseEnPageFamille"];
beforeAll(async () => {
  const chemin = ["..", "..", "..", "studio-rendu", "compositions", "commune", "habillage", "PlancheIcones"].join("/");
  ({ FAMILLES_ICONES, MARGE_BAS, MARGE_HAUT, nomsDeFamille, miseEnPageFamille } = (await import(/* @vite-ignore */ chemin)) as Geometrie);
});

// Seule la mise en page (fonctions pures) est importée : le moteur de rendu et le chargement de police sont neutralisés.
vi.mock("remotion", () => ({ AbsoluteFill: () => null, useCurrentFrame: () => 0 }));
vi.mock("../../../studio-rendu/compositions/plan-scenes/PlanDeScenes", () => ({ chargerManrope: () => undefined }));
vi.mock("../../../src/briques/motion/bibliotheque-icones/IconeAnimee", () => ({ IconeAnimee: () => null }));

/** Planches des icônes et des animations d'icônes (C6-H7c, AM-21) : lecture de texte, aucun rendu. */
const RACINE = join(__dirname, "../../../studio-rendu");
const HAB = join(RACINE, "compositions/commune/habillage");
const lire = (p: string) => readFileSync(p, "utf8");
const icones = lire(join(HAB, "PlancheIcones.tsx"));
const animations = lire(join(HAB, "PlancheAnimations.tsx"));
const compos = lire(join(HAB, "Compositions.tsx"));
const script = lire(join(RACINE, "scripts/planche-habillage.ts"));

describe("planches icônes et animations (C6-H7c)", () => {
  it("deux compositions neuves, identifiants uniques, anciens conservés", () => {
    expect(compos.match(/id="HabillageIcones"/g)).toHaveLength(1);
    expect(compos.match(/id="HabillageAnimations"/g)).toHaveLength(1);
    for (const id of ["HabillageTransitions", "HabillageMesure", "HabillageFonds", "HabillageLumieres"]) expect(compos).toContain(`id="${id}"`);
  });

  it("chaque famille de la bibliothèque est montrée, chaque icône sur ivoire et sur noir", () => {
    expect(icones).toContain("ICONES_BIBLIOTHEQUE");
    expect(icones).toMatch(/fond="ivoire"/);
    expect(icones).toMatch(/fond="noir"/);
    expect(icones).toMatch(/IconeAnimee/);
    expect(new Set(Object.values(ICONES_BIBLIOTHEQUE).map((i) => i.jeu)).size).toBeGreaterThan(1);
  });

  it("chaque icône tient dans sa moitié (1080×1920 → 960 px de haut) : rangées × case + marges ≤ hauteur", () => {
    const moitie = 1920 / 2;
    for (const famille of FAMILLES_ICONES) {
      const n = nomsDeFamille(famille).length;
      const { colonnes, caseTaille, rangees } = miseEnPageFamille(n, 1080, moitie);
      expect(colonnes * rangees).toBeGreaterThanOrEqual(n);
      expect(rangees * caseTaille + MARGE_HAUT + MARGE_BAS).toBeLessThanOrEqual(moitie);
      expect(colonnes * caseTaille).toBeLessThanOrEqual(1080);
    }
  });

  it("chaque nom de ICONES_BIBLIOTHEQUE est couvert par une famille", () => {
    const couverts = FAMILLES_ICONES.flatMap((f) => nomsDeFamille(f));
    expect(new Set(couverts)).toEqual(new Set(Object.keys(ICONES_BIBLIOTHEQUE)));
    expect(couverts).toHaveLength(Object.keys(ICONES_BIBLIOTHEQUE).length);
  });

  it("chaque geste d'IconeAnimee est montré sur ivoire et sur noir", () => {
    const source = lire(join(__dirname, "../../../src/briques/motion/bibliotheque-icones/IconeAnimee.tsx"));
    const type = /export type AnimationIcone =([^;]+);/.exec(source)?.[1] ?? "";
    const gestes = [...type.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    expect(gestes.length).toBeGreaterThan(0);
    for (const g of gestes) expect(animations).toContain(`"${g}"`);
    expect(animations).toMatch(/fond="ivoire"/);
    expect(animations).toMatch(/fond="noir"/);
  });

  it("nombre d'images = nombre de tableaux × durée fixe", () => {
    expect(icones).toMatch(/IMAGES_PLANCHE_ICONES\s*=\s*FAMILLES_ICONES\.length\s*\*\s*IMAGES_PAR_TABLEAU/);
    expect(animations).toMatch(/IMAGES_PLANCHE_ANIMATIONS\s*=\s*ANIMATIONS_ICONES\.length\s*\*\s*IMAGES_PAR_TABLEAU/);
    expect(compos).toMatch(/durationInFrames=\{IMAGES_PLANCHE_ICONES\}/);
    expect(compos).toMatch(/durationInFrames=\{IMAGES_PLANCHE_ANIMATIONS\}/);
  });

  it("le script accepte --planche icones|animations, comportement inchangé sans option", () => {
    expect(script).toContain("HabillageIcones");
    expect(script).toContain("HabillageAnimations");
    expect(script).toContain("HabillageTransitions");
    expect(script).toContain("transitions.mp4");
  });

  it("aucun @/, hexadécimal, Montserrat, courbe littérale, horloge ni Lottie", () => {
    for (const s of [icones, animations]) {
      expect(s).not.toMatch(/from\s+["']@\//);
      expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(s).not.toMatch(/Montserrat/);
      expect(s).not.toMatch(/cubic-bezier\(|Easing\.bezier\(|(damping|stiffness|mass)\s*:\s*\d/);
      expect(s).not.toMatch(/performance\.now|Date\.now/);
      expect(s).not.toMatch(/lottie/i);
    }
  });
});
