/**
 * LOT 1 DES VIGNETTES — les 3 rendus réels de contrôle (étape 7). Léger, sans navigateur : les fichiers produits par
 * `studio-rendu/scripts/essai-vignettes.ts` existent, ont les bonnes dimensions (en-tête JPEG) et pèsent 2 Mo au plus.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = "docs/vignettes/lot1-rendus";
const RENDUS = [
  { fichier: "1-16x9-encre-m1-repli.jpg", largeur: 1280, hauteur: 720 },
  { fichier: "2-9x16-ivoire-m2-sujet.jpg", largeur: 1080, hauteur: 1920 },
  { fichier: "3-9x16-encre-instagram.jpg", largeur: 1080, hauteur: 1920 },
];

/** Dimensions lues dans l'en-tête JPEG (marqueur SOF0 à SOF15 hors DHT, DAC, RSTn). */
function dimensionsJpeg(b: Buffer): { largeur: number; hauteur: number } {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error("JPEG invalide");
    const marqueur = b[i + 1];
    const longueur = b.readUInt16BE(i + 2);
    if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) return { hauteur: b.readUInt16BE(i + 5), largeur: b.readUInt16BE(i + 7) };
    i += 2 + longueur;
  }
  throw new Error("JPEG sans dimensions");
}

describe("vignettes lot 1 · rendus réels de contrôle", () => {
  for (const r of RENDUS) {
    it(`${r.fichier} : présent, ${r.largeur}×${r.hauteur}, ≤ 2 Mo`, () => {
      const chemin = join(DOSSIER, r.fichier);
      expect(existsSync(chemin)).toBe(true);
      const octets = readFileSync(chemin);
      expect(octets.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(dimensionsJpeg(octets)).toEqual({ largeur: r.largeur, hauteur: r.hauteur });
      expect(statSync(chemin).size).toBeLessThanOrEqual(2_000_000);
    });
  }
  it("le rapport existe", () => expect(existsSync(join(DOSSIER, "RAPPORT.md"))).toBe(true));
});
