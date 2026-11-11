import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrasteWcag, PALETTE } from "../src/briques/charte/axion-2026";
import { MELANGES } from "../studio-rendu/compositions/interface-claire/variantes/premium-1";

const DOSSIER = "studio-rendu/compositions/interface-claire/variantes";
/** Mélanges de l'ancienne palette, recalculés sur la palette 2026 : ils ne doivent plus apparaître nulle part. */
const MELANGES_ANCIENS = ["DECFB9", "DEC0A8", "D4C2AA", "CBBFAD", "BC6441", "94806A", "934122", "45392D"];
/** Couleurs de l'ancienne charte (ivoire, orange, encre, sable) : elles viennent maintenant de COULEURS. */
const COULEURS_ANCIENNES = ["E9DCC8", "B44F29", "110A05", "BFA88B"];

const lire = (n: number) => readFileSync(`${DOSSIER}/premium-${n}.tsx`, "utf8");
const compte = (src: string, hex: string) => (src.match(new RegExp(`#${hex}`, "gi")) ?? []).length;

describe("palette des variantes premium : une seule définition, palette 2026", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    it(`premium-${n} ne contient aucun ancien hex ni ancien rgba`, () => {
      const src = lire(n);
      for (const h of [...MELANGES_ANCIENS, ...COULEURS_ANCIENNES]) expect(compte(src, h), h).toBe(0);
      expect(src).not.toMatch(/rgba\(\s*(17,\s*10,\s*5|233,\s*220,\s*200)\s*,/);
      expect(src).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    });
  }
  for (const n of [2, 3, 4, 5]) {
    it(`premium-${n} importe MELANGES de premium-1 et ne le redéfinit pas`, () => {
      expect(lire(n)).toMatch(/from "\.\/premium-1"/);
      expect(lire(n)).not.toMatch(/melange\(/);
      expect(lire(n)).not.toMatch(/MELANGES\s*=/);
    });
  }
  it("premium-1 calcule les mélanges sur PALETTE (encreDouce = noir) ; l'orange #D97757 seulement sous orangeSurNoir, jamais le survol #8F3412", () => {
    const src = lire(1);
    expect(src).toMatch(/encreDouce: PALETTE\.noir,/);
    expect(src).toMatch(/ivoireCreux: melange\(PALETTE\.ivoire, PALETTE\.gris, /);
    expect(src).not.toMatch(/PALETTE\.survol\b/);
    expect([...src.matchAll(/PALETTE\.orange\b/g)].length).toBe(1);
    expect(src).toMatch(/orangeSurNoir: PALETTE\.orange,/);
  });
});

const canal = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);

describe("MELANGES : valeurs, contrastes et ordre des tons (palette 2026)", () => {
  const valeurs = Object.entries(MELANGES);
  it("aucune valeur n'est le survol (D5 ouverte) ni l'orange, hors orangeSurNoir", () => {
    for (const [nom, v] of valeurs) {
      expect(v, nom).not.toBe(PALETTE.survol);
      if (nom !== "orangeSurNoir") expect(v, nom).not.toBe(PALETTE.orange);
    }
  });
  it("orangeProfond n'est pas le survol et s'en écarte de plus de 16 par canal (contournement de D5)", () => {
    expect(MELANGES.orangeProfond).not.toBe(PALETTE.survol);
    const ecart = Math.max(...[1, 3, 5].map((i) => Math.abs(canal(MELANGES.orangeProfond, i) - canal(PALETTE.survol, i))));
    expect(ecart).toBeGreaterThan(16);
  });
  it("orangeSurNoir = orange de la palette, ≥ 4,5 sur noir ; aucun rôle terracotta (orange, chaud, profond) sur noir", () => {
    expect(MELANGES.orangeSurNoir).toBe(PALETTE.orange);
    expect(contrasteWcag(MELANGES.orangeSurNoir, PALETTE.noir)).toBeGreaterThanOrEqual(4.5);
    for (const v of [PALETTE.terracotta, MELANGES.orangeChaud, MELANGES.orangeProfond]) expect(contrasteWcag(v, PALETTE.noir)).toBeLessThan(4.5);
  });
  it("ivoire sur terracotta, orangeChaud et orangeProfond ≥ 4,5", () => {
    for (const fond of [PALETTE.terracotta, MELANGES.orangeChaud, MELANGES.orangeProfond]) expect(contrasteWcag(PALETTE.ivoire, fond), fond).toBeGreaterThanOrEqual(4.5);
  });
  it("texte secondaire (sableProfond) ≥ 4,5 sur ivoire, ivoireCreux, sableClair et gris", () => {
    expect(MELANGES.sableProfond).toBe(PALETTE.texteSecondaire);
    for (const fond of [PALETTE.ivoire, MELANGES.ivoireCreux, MELANGES.sableClair, PALETTE.gris]) expect(contrasteWcag(MELANGES.sableProfond, fond), fond).toBeGreaterThanOrEqual(4.5);
  });
  it("ordre de luminance : ivoire > ivoireCreux > sableClair > sable > filet > sableProfond", () => {
    const ordre = [PALETTE.ivoire, MELANGES.ivoireCreux, MELANGES.sableClair, PALETTE.gris, MELANGES.filet, MELANGES.sableProfond];
    const l = ordre.map((c) => contrasteWcag(c, "#000000"));
    for (let i = 1; i < l.length; i++) expect(l[i], `rang ${i}`).toBeLessThan(l[i - 1]);
  });
});
