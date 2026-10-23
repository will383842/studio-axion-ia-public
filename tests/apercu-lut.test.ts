/**
 * APERÇU RAPIDE (02/10) — l'aperçu du plateau lit une copie 33³ binaire de chaque LUT livrée, le rendu final garde
 * le `.cube` 65³ intact. Mesure avant / après : `docs/captures/apercu-lut-avant.json`, `apercu-lut-apres.json`.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LUTS_AXION } from "@/donnees/luts-axion";
import { donneesTexture3D, encoderLutApercu, lireCube, lireLutApercu, reduireLut, urlApercuLut } from "@/lib/lut3d";

const copie = (fichier: string) => join("public", "luts", "apercu", fichier.replace(/\.cube$/, ".33.bin"));

describe("copies d'aperçu des LUT livrées", () => {
  for (const def of LUTS_AXION) {
    it(`${def.fichier} : copie 33³ présente, à jour, légère ; le .cube 65³ du rendu est intact`, () => {
      const texte = readFileSync(join("public", "luts", def.fichier), "utf8");
      const lut = lireCube(texte);
      expect(lut.taille).toBe(65); // le rendu final garde 65 points
      expect(statSync(join("public", "luts", def.fichier)).size).toBeGreaterThan(7_000_000);
      const octets = readFileSync(copie(def.fichier));
      expect(octets.length).toBeLessThan(120_000);
      // À jour : la copie est exactement ce que l'outil fabriquerait aujourd'hui.
      expect(createHash("sha256").update(octets).digest("hex")).toBe(createHash("sha256").update(encoderLutApercu(lut)).digest("hex"));
      // Même texture WebGL2 que l'ancien chemin (.cube lu puis réduit à 33³ dans le navigateur) : aucun écart visible.
      const ancien = donneesTexture3D(reduireLut(lut));
      const nouveau = donneesTexture3D(lireLutApercu(octets));
      let ecartMax = 0;
      for (let i = 0; i < ancien.length; i++) ecartMax = Math.max(ecartMax, Math.abs(ancien[i] - nouveau[i]));
      expect(ecartMax).toBe(0);
    });
  }
});

describe("lecture et adresse de la copie d'aperçu", () => {
  it("adresse : seulement pour une LUT servie par le studio", () => {
    expect(urlApercuLut("/luts/axion-buffer-clair-obscur.cube")).toBe("/luts/apercu/axion-buffer-clair-obscur.33.bin");
    expect(urlApercuLut("/luts/axion-buffer-nuit.cube?v=2")).toBe("/luts/apercu/axion-buffer-nuit.33.bin");
    expect(urlApercuLut("https://compte.r2.cloudflarestorage.com/studio/prod/lut/x/f-1.cube?X-Amz-Signature=a")).toBeNull();
    expect(urlApercuLut(null)).toBeNull();
  });
  it("une copie cassée est refusée (l'aperçu retombe alors sur le .cube)", () => {
    expect(() => lireLutApercu(new Uint8Array([1, 2, 3]))).toThrow(/copie d'aperçu/);
    const bonne = readFileSync(copie(LUTS_AXION[0].fichier));
    expect(() => lireLutApercu(new Uint8Array(bonne.subarray(0, 5000)))).toThrow(/incomplète/);
  });
});
