import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ICONES_BIBLIOTHEQUE } from "../../../src/briques/motion/bibliotheque-icones";

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
