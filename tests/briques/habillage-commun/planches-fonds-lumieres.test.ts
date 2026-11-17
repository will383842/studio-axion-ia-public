import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IDS_FONDS_VIVANTS } from "../../../src/briques/motion/habillage-commun/fonds";

/** Planches des fonds vivants et des lumières (C6-H7b, AM-06) : lecture de texte, aucun rendu. */
const RACINE = join(__dirname, "../../../studio-rendu");
const HAB = join(RACINE, "compositions/commune/habillage");
const lire = (p: string) => readFileSync(p, "utf8");
const fonds = lire(join(HAB, "PlancheFonds.tsx"));
const lumieres = lire(join(HAB, "PlancheLumieres.tsx"));
const compos = lire(join(HAB, "Compositions.tsx"));
const script = lire(join(RACINE, "scripts/planche-habillage.ts"));

describe("planches fonds et lumières (C6-H7b)", () => {
  it("deux compositions neuves, identifiants uniques", () => {
    expect(compos.match(/id="HabillageFonds"/g)).toHaveLength(1);
    expect(compos.match(/id="HabillageLumieres"/g)).toHaveLength(1);
    expect(compos).toContain('id="HabillageTransitions"');
    expect(compos).toContain('id="HabillageMesure"');
  });

  it("chaque fond est joué en ivoire puis en noir, avec des sous-titres dessus", () => {
    expect(fonds).toContain("IDS_FONDS_VIVANTS");
    expect(fonds).toMatch(/fond="ivoire"/);
    expect(fonds).toMatch(/fond="noir"/);
    expect(fonds).toMatch(/FondVivant/);
    expect(fonds).toMatch(/sous-titres?/i);
    expect(IDS_FONDS_VIVANTS.length).toBeGreaterThan(0);
  });

  it("nombre d'images = nombre de tableaux × durée fixe", () => {
    expect(fonds).toMatch(/IMAGES_PLANCHE_FONDS\s*=\s*IDS_FONDS_VIVANTS\.length\s*\*\s*IMAGES_PAR_TABLEAU/);
    expect(lumieres).toMatch(/IMAGES_PLANCHE_LUMIERES\s*=\s*TABLEAUX_LUMIERES\.length\s*\*\s*IMAGES_PAR_TABLEAU/);
    expect(compos).toMatch(/durationInFrames=\{IMAGES_PLANCHE_FONDS\}/);
    expect(compos).toMatch(/durationInFrames=\{IMAGES_PLANCHE_LUMIERES\}/);
  });

  it("les lumières montrent les quatre effets sur ivoire et sur noir", () => {
    for (const n of ["FuiteLumiere", "RefletBalayage", "lueurTexte", "halo"]) expect(lumieres).toContain(n);
    expect(lumieres).toMatch(/fond="ivoire"/);
    expect(lumieres).toMatch(/fond="noir"/);
  });

  it("le script accepte --planche fonds|lumieres, comportement inchangé sans option", () => {
    expect(script).toContain("--planche");
    expect(script).toContain("HabillageFonds");
    expect(script).toContain("HabillageLumieres");
    expect(script).toContain("HabillageTransitions");
    expect(script).toContain("transitions.mp4");
  });

  it("aucun @/, hexadécimal, Montserrat ni littéral de courbe", () => {
    for (const s of [fonds, lumieres]) {
      expect(s).not.toMatch(/from\s+["']@\//);
      expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(s).not.toMatch(/Montserrat/);
      expect(s).not.toMatch(/cubic-bezier\(|Easing\.bezier\(|(damping|stiffness|mass)\s*:\s*\d/);
      expect(s).not.toMatch(/performance\.now|Date\.now/);
    }
  });
});
