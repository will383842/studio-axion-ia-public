/**
 * Variété « Image → vidéo » · axe 14, en-tête (ENT-A à ENT-D) : l'habillage du titre reste dans la zone de l'en-tête
 * d'aujourd'hui (9:16 et 4:5), loin des sous-titres, et le titre reste lisible (contraste ≥ 4,5:1).
 */
import { describe, expect, it } from "vitest";
import { CADRES_IV, VARIANTES_GARDEES, tirablesDe } from "@/briques/schema-motion/variete";
import { geometrieEntete, type CodeEntete } from "../../../studio-rendu/compositions/image-video/variete/entete/geometrie";

const CODES: CodeEntete[] = ["ENT-A", "ENT-B", "ENT-C", "ENT-D"];
const TITRES = ["Vos relances partent seules", "Un devis envoyé en deux minutes chrono", "BON DE COMMANDE MARTIN", "Gagnez du temps"];

function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("axe entete", () => {
  it("variantes gardées B, C, D ; tirables avec la référence", () => {
    expect(VARIANTES_GARDEES.entete).toEqual(["ENT-B", "ENT-C", "ENT-D"]);
    expect(tirablesDe("entete")).toEqual(["ENT-A", "ENT-B", "ENT-C", "ENT-D"]);
  });
  for (const format of ["9:16", "4:5"] as const) {
    for (const code of CODES) {
      for (const fond of ["ivoire", "sombre"] as const) {
        it(`${code} · ${format} · ${fond} : boîtes dans la zone d'aujourd'hui, hors sous-titres, contraste ≥ 4,5`, () => {
          for (const titre of TITRES) {
            const g = geometrieEntete(code, titre, format, fond);
            const z = g.zone;
            for (const b of [g.boite, g.texte]) {
              if (!b) continue;
              expect(b.x).toBeGreaterThanOrEqual(0);
              expect(b.x + b.largeur).toBeLessThanOrEqual(1080 + 1e-6);
              expect(b.y).toBeGreaterThanOrEqual(z.y - 1e-6);
              expect(b.y + b.hauteur).toBeLessThanOrEqual(z.y + z.hauteur + 1e-6);
              expect(b.y + b.hauteur).toBeLessThan(CADRES_IV[format].sousTitres.haut);
            }
            expect(contraste(g.couleurTitre, g.fondDuTitre)).toBeGreaterThanOrEqual(4.5);
            expect(contraste(g.couleurAccent, g.fondDuTitre)).toBeGreaterThanOrEqual(4.5 - (code === "ENT-A" || code === "ENT-C" ? 1.5 : 0));
          }
        });
      }
    }
  }
  it("ENT-A : aucun habillage", () => {
    expect(geometrieEntete("ENT-A", "Gagnez du temps", "9:16").boite).toBeNull();
  });
});
