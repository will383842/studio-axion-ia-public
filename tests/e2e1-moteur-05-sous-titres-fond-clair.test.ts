/**
 * E2E-1 n° 5 (MAJEUR, 03/10) — les mots « à venir » restent lisibles sur le rabat blanc de la robe : ils ne sont plus
 * dessinés à 45 % d'opacité (ce qui pâlissait aussi le contour), mais dans une couleur PLEINE fondue vers le contour,
 * contour entier. Sur fond sombre, même teinte qu'avant.
 */
import { describe, expect, it } from "vitest";
import type { SegmentSousTitres } from "@/domaine/types";
import { donneesCalque } from "@/briques/sous-titres";
import { couleurAVenir, cssElement, sceneAuTemps } from "@/briques/sous-titres/scene";

const COULEURS = { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" };
const mot = (m: string, d: number, f: number) => ({ mot: m, debutSec: d, finSec: f });
const seg = (mots: ReturnType<typeof mot>[]): SegmentSousTitres => ({ id: "s", debutSec: mots[0].debutSec, finSec: mots.at(-1)!.finSec, mots, style: "base", importance: 0, souligne: null, position: "auto", inclinaison: 0 }) as SegmentSousTitres;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Couleur vue d'un mot dessiné à `opacite` sur un fond `fond`. */
const vue = (c: number[], fond: number[], opacite: number) => c.map((v, i) => Math.round(v * opacite + fond[i] * (1 - opacite)));

describe("E2E-1 n° 5 · sous-titres lisibles sur fond clair", () => {
  const d = donneesCalque({ segments: [seg([mot("Écrivez", 0, 0.4), mot("une", 0.4, 0.6), mot("facture", 0.6, 1)])], base: "karaoke", couleurs: COULEURS, reseaux: ["tiktok"] });

  it("mot à venir : couleur pleine (opacité 1), fondue vers le contour, contour entier", () => {
    const el = sceneAuTemps(d, 0.1)!;
    const aVenir = el.mots[2];
    expect(aVenir.opacite).toBe(1);
    expect(aVenir.couleur).toBe(couleurAVenir(COULEURS.texte, COULEURS.contour, 0.45));
    const css = cssElement(el, d, "Poppins");
    expect(css.mot(2).opacity).toBe(1);
    expect(String(css.ligne.WebkitTextStroke)).toContain(COULEURS.contour);
  });

  it("sur le rabat blanc, le mot à venir se détache (contraste ≥ 3:1, contre ≈ 1,1:1 avant)", () => {
    const blanc = [255, 255, 255];
    const avant = contraste(vue(rgb(COULEURS.texte), blanc, 0.45), blanc);
    const apres = contraste(rgb(couleurAVenir(COULEURS.texte, COULEURS.contour, 0.45)), blanc);
    expect(avant).toBeLessThan(1.2);
    expect(apres).toBeGreaterThanOrEqual(3);
  });

  it("sur fond sombre, la teinte reste celle d'avant (écart ≤ 2 niveaux par canal)", () => {
    const sombre = rgb(COULEURS.contour);
    const avant = vue(rgb(COULEURS.texte), sombre, 0.45);
    const apres = rgb(couleurAVenir(COULEURS.texte, COULEURS.contour, 0.45));
    for (let i = 0; i < 3; i++) expect(Math.abs(avant[i] - apres[i])).toBeLessThanOrEqual(2);
  });
});
