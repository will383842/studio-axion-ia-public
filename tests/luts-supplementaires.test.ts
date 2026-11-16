/**
 * C6-H8 — les 3 LUT Axion supplémentaires : même contrôle que `tests/luts.test.ts` (en-tête, 65 points, gris monotone,
 * cassure < 0,02 = valeurs de `outils/lut/qc.py`), noir < 4 % et blanc > 94 %, copie d'aperçu 33³ présente et égale,
 * et empreinte figée des 4 `.cube` existants (inchangés). Ajout pur : `LUTS_AXION` n'a pas bougé.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { encoderLutApercu, lireCube } from "@/lib/lut3d";
import { CASSURE_MAX, controlerLut, validerCube } from "@/lib/qc-lut";
import { LUTS_AXION } from "@/donnees/luts-axion";
import { LUTS_AXION_SUPPLEMENTAIRES } from "@/donnees/luts-axion-supplementaires";

/** Valeurs de `outils/lut/qc.py` sur les fichiers livrés (15/11/2026). */
const QC_PY: Record<string, number> = { "axion-terracotta-chaud.cube": 0.0154, "axion-ivoire-doux-contraste.cube": 0.0169, "axion-encre-froid-neutre.cube": 0.0109 };

const sha = (b: Buffer | Uint8Array | string) => createHash("sha256").update(b).digest("hex");

describe("les 3 LUT supplémentaires (public/luts/)", () => {
  it("trois entrées, identifiants et fichiers distincts de LUTS_AXION, aucune par défaut d'un format", () => {
    expect(LUTS_AXION_SUPPLEMENTAIRES).toHaveLength(3);
    const ids = new Set(LUTS_AXION.map((l) => l.id));
    const fichiers = new Set(LUTS_AXION.map((l) => l.fichier));
    for (const d of LUTS_AXION_SUPPLEMENTAIRES) {
      expect(ids.has(d.id)).toBe(false);
      expect(fichiers.has(d.fichier)).toBe(false);
      expect(d.formats).toEqual([]);
      expect(d.intensiteParDefaut).toBeGreaterThanOrEqual(60);
      expect(d.intensiteParDefaut).toBeLessThanOrEqual(70);
    }
    expect(LUTS_AXION).toHaveLength(4);
  });

  for (const def of LUTS_AXION_SUPPLEMENTAIRES) {
    it(`${def.fichier} : en-tête valide, 65 points, gris monotone, cassure < 0,02, noir < 4 %, blanc > 94 %, copie 33³ égale`, () => {
      const texte = readFileSync(join("public", "luts", def.fichier), "utf8");
      expect(texte.split("\n").slice(0, 4).join("\n")).toMatch(/^TITLE "Axion - .+"\nLUT_3D_SIZE 65\nDOMAIN_MIN 0\.0 0\.0 0\.0\nDOMAIN_MAX 1\.0 1\.0 1\.0$/);
      const lut = lireCube(texte);
      expect(lut.taille).toBe(65);
      const r = controlerLut(lut);
      expect(r.grisMonotone).toBe(true);
      expect(r.cassureMax).toBeLessThan(CASSURE_MAX);
      expect(r.cassureMax).toBeCloseTo(QC_PY[def.fichier], 3);
      expect(Math.max(...r.noir)).toBeLessThan(0.04);
      expect(Math.min(...r.blanc)).toBeGreaterThan(0.94);
      expect(validerCube(texte)).toMatchObject({ ok: true, taille: 65 });
      const copie = readFileSync(join("public", "luts", "apercu", def.fichier.replace(/\.cube$/, ".33.bin")));
      expect(sha(copie)).toBe(sha(encoderLutApercu(lut)));
    }, 60_000);
  }
});

describe("les 4 LUT existantes sont intactes (empreintes figées)", () => {
  const CUBES: Record<string, string> = {
    "axion-buffer-clair-obscur.cube": "f490bd7c17f81c468eafa48f49704864c6562b07b81abd81d1c0102c75109144",
    "axion-buffer-doux.cube": "d8443564c704d2f6c4e3ca336b104897aea8079e0ea14ba3b3429d8b72957e4a",
    "axion-buffer-naturel.cube": "5019b3de461374575da3baa111eef01b3263e3c0a9d88c00576ab8f58d1afad7",
    "axion-buffer-nuit.cube": "ed0747212d234afc9bbdd177ec1ef540dc6b647a683ab5734bb6f0adbb4fdf90",
  };
  for (const [nom, empreinte] of Object.entries(CUBES)) {
    it(`${nom} : sha256 inchangé`, () => {
      expect(sha(readFileSync(join("public", "luts", nom)))).toBe(empreinte);
    });
  }
});
