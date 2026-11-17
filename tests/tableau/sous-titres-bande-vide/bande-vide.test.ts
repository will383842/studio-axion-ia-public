/**
 * FIX-SOUS-TITRES-TABLEAU, lot D (17/11/2026, bouton « oui » de Williams) : la bande noire des sous-titres n'apparaît que
 * quand un sous-titre est écrit (plus de bande vide pendant les silences, la page de fin ni avant le premier mot).
 * Un pont garde la bande dans les petits blancs (< 0,6 s) ; fondu de 0,2 s sinon. Sans `bandeFond` (tous les autres
 * générateurs) : 0, et le calque ne dessine rien de plus.
 * `CalqueSousTitres.tsx` est lu en TEXTE (jamais importé : PIEGE-REMOTION-TSC.md).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BANDE_FOND_FONDU_SEC, BANDE_FOND_PONT_SEC, opaciteBandeFond, type DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { sortieV6616 } from "../sous-titres-dynamiques/chaine";

const LONG = 60_000;
const bandeFond = { couleur: "#101010", opacite: 0.85, xPx: 0, yPx: 1400, largeurPx: 1080, hauteurPx: 300, fonduPx: 40 };
const seg = (id: string, debutSec: number, finSec: number) => ({ id, debutSec, finSec, mots: [{ mot: id, debutSec, finSec }] });
const donnees = (segments: ReturnType<typeof seg>[], avecBande = true): DonneesCalque =>
  ({ largeur: 1080, hauteur: 1920, segments, bandeFond: avecBande ? bandeFond : undefined }) as unknown as DonneesCalque;

describe("a) bande seulement quand un sous-titre est écrit", () => {
  const d = donnees([seg("a", 0, 1), seg("b", 1.2, 2), seg("c", 4, 5)]);
  it("constantes de la fiche", () => {
    expect(BANDE_FOND_PONT_SEC).toBe(0.6);
    expect(BANDE_FOND_FONDU_SEC).toBe(0.2);
  });
  it("pendant un segment : 1 ; petit blanc : 1 (pont)", () => {
    expect(opaciteBandeFond(d, 0.5)).toBe(1);
    expect(opaciteBandeFond(d, 0)).toBe(1);
    expect(opaciteBandeFond(d, 1.1)).toBe(1);
  });
  it("après le dernier mot d'une suite : fondu de 1 à 0 en 0,2 s", () => {
    const o = opaciteBandeFond(d, 2.1);
    expect(o).toBeGreaterThan(0);
    expect(o).toBeLessThan(1);
    expect(o).toBeCloseTo(0.5, 5);
    expect(opaciteBandeFond(d, 2.2)).toBe(0);
  });
  it("long silence : 0 ; fondu d'entrée avant le suivant", () => {
    expect(opaciteBandeFond(d, 3)).toBe(0);
    const o = opaciteBandeFond(d, 3.9);
    expect(o).toBeGreaterThan(0);
    expect(o).toBeLessThan(1);
    expect(o).toBeCloseTo(0.5, 5);
  });
  it("après le dernier segment (page de fin) : 0 ; avant le premier : 0", () => {
    expect(opaciteBandeFond(d, 6)).toBe(0);
    expect(opaciteBandeFond(donnees([seg("a", 1, 2)]), 0.5)).toBe(0);
    expect(opaciteBandeFond(donnees([seg("a", 1, 2)]), 0.9)).toBeCloseTo(0.5, 5);
    expect(opaciteBandeFond(donnees([seg("a", 1, 2)]), -5)).toBe(0);
  });
  it("jamais hors de [0 ; 1], continue sans saut au bord du fondu", () => {
    for (let t = -1; t < 7; t += 0.01) {
      const o = opaciteBandeFond(d, t);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
    }
  });
  it("le temps de sortie d'un groupe compte comme « pendant le segment » (quand la sortie est active)", () => {
    // La sortie est éteinte par défaut (SORTIE_ACTIVE = false, C2-U19) : alors le champ ne change rien, comme la scène.
    const avec = { ...donnees([seg("a", 0, 1)]), sortie: { dureeSec: 0.2, glissementPx: 16, flouPx: 0 } } as DonneesCalque;
    expect(opaciteBandeFond(avec, 1.1)).toBe(opaciteBandeFond(donnees([seg("a", 0, 1)]), 1.1));
  });
});

describe("b) éteint = identique : sans bandeFond, 0 partout", () => {
  it("aucun instant n'a de bande sans `bandeFond`", () => {
    const d = donnees([seg("a", 0, 1), seg("b", 1.2, 2)], false);
    for (let t = -1; t < 4; t += 0.05) expect(opaciteBandeFond(d, t)).toBe(0);
  });
  it("sans segment : 0 même avec `bandeFond`", () => {
    expect(opaciteBandeFond(donnees([]), 1)).toBe(0);
  });
});

describe("c) segments réels du tableau (v-6616b3800357, paperboard, vertical)", () => {
  it("aucun sous-titre sans sa bande ; 0 après le dernier mot + 0,2 s", { timeout: LONG }, () => {
    const r = sortieV6616("paperboard", "vertical");
    const segs = r.calque.segments;
    expect(r.calque.bandeFond).toBeTruthy();
    expect(segs.length).toBeGreaterThan(3);
    for (const s of segs) {
      for (let t = s.debutSec; t < s.finSec; t += 0.05) expect(opaciteBandeFond(r.calque, t), `« ${s.id} » à ${t.toFixed(2)} s sans bande`).toBe(1);
    }
    const dernier = Math.max(...segs.map((s) => s.finSec));
    expect(opaciteBandeFond(r.calque, dernier + BANDE_FOND_FONDU_SEC)).toBe(0);
    expect(opaciteBandeFond(r.calque, dernier + 2.5)).toBe(0);
    expect(opaciteBandeFond(r.calque, 0)).toBeLessThanOrEqual(1);
  });
});

describe("d) le calque lit la fonction (lecture TEXTE)", () => {
  const texte = readFileSync(["studio-rendu", "compositions", "sous-titres", "CalqueSousTitres.tsx"].join("/"), "utf8");
  it("appelle opaciteBandeFond, n'a plus de bande « constante »", () => {
    expect(texte).toContain("opaciteBandeFond(");
    expect(texte).not.toContain("constante");
    expect(texte).toMatch(/opacity: ob/);
  });
});

describe("autres générateurs : aucune bande, aucun changement", () => {
  it("`bandeFond` n'est posé que par le tableau (src/moteurs/montage-tableau) et la composition qui le transmet", () => {
    const fichiers = ["src/moteurs/montage-tableau/sous-titres-tableau.ts", "src/briques/composition/parametres.ts", "src/briques/sous-titres/scene.ts"];
    for (const f of fichiers) expect(readFileSync(f, "utf8")).toContain("bandeFond");
    for (const g of ["montage-avocat", "montage-facecam", "montage-cas-concret", "montage-image-video"])
      for (const f of [`src/moteurs/${g}/index.ts`]) {
        try {
          expect(readFileSync(f, "utf8")).not.toContain("bandeFond");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      }
  });
  it("tous les fonds × formats du tableau : la bande suit toujours un segment", { timeout: LONG }, () => {
    const r = sortieV6616(STYLES_TABLEAU[0], IDS_FORMATS_SORTIE[0]);
    expect(opaciteBandeFond({ ...r.calque, bandeFond: undefined }, r.calque.segments[0].debutSec + 0.1)).toBe(0);
  });
});
