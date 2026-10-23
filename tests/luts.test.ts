/**
 * LOT M4 — les 4 LUT « Axion Buffer » livrées (décision de Will, `luts/A-INTEGRER-DANS-LE-STUDIO.md`) :
 * chaque `.cube` livré a un en-tête valide, 65 points, un gris monotone et une cassure < 0,02 (même calcul que
 * `outils/lut/qc.py`) ; contrôle à l'import (refus clair si cassée, avertissement au-delà de 0,02) ; mélange à
 * l'intensité ; migration au démarrage (étape 10) idempotente, sans toucher aux LUT d'exemple.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { echantillonner, lireCube, lutIdentite } from "@/lib/lut3d";
import { CASSURE_MAX, controlerLut, ecrireCube, melangerAvecIdentite, validerCube } from "@/lib/qc-lut";
import { elementsLutsAxion, fichiersLutsAxion, LUTS_AXION } from "@/donnees/luts-axion";
import { validerCubeLocal } from "@/components/bibliotheque/outils";
import type { ElementBibliotheque } from "@/domaine/types";

const { reinitialiserDepots, DepotMemoire } = await import("@/donnees/memoire");
const { migrerDonnees } = await import("@/services/migrations");
const { obtenirFormat } = await import("@/formats");

/** Valeurs de `outils/lut/qc.py` sur les fichiers livrés (01/10/2026). */
const QC_PY: Record<string, number> = { "axion-buffer-clair-obscur.cube": 0.0166, "axion-buffer-doux.cube": 0.0145, "axion-buffer-naturel.cube": 0.0126, "axion-buffer-nuit.cube": 0.0184 };

describe("chaque .cube livré (public/luts/)", () => {
  for (const def of LUTS_AXION) {
    it(`${def.fichier} : en-tête valide, 65 points, gris monotone, cassure < 0,02`, () => {
      const texte = readFileSync(join("public", "luts", def.fichier), "utf8");
      expect(texte.split("\n").slice(0, 4).join("\n")).toMatch(/^TITLE "Axion - .+"\nLUT_3D_SIZE 65\nDOMAIN_MIN 0\.0 0\.0 0\.0\nDOMAIN_MAX 1\.0 1\.0 1\.0$/);
      const lut = lireCube(texte);
      expect(lut.taille).toBe(65);
      const r = controlerLut(lut);
      expect(r.grisMonotone).toBe(true);
      expect(r.cassureMax).toBeLessThan(CASSURE_MAX);
      expect(r.cassureMax).toBeCloseTo(QC_PY[def.fichier], 3);
      // Noir légèrement relevé et chaud (Buffer), jamais plus clair que 4 % ; blanc gardé.
      expect(Math.max(...r.noir)).toBeLessThan(0.04);
      expect(Math.min(...r.blanc)).toBeGreaterThan(0.94);
      expect(validerCube(texte)).toMatchObject({ ok: true, taille: 65 });
      expect(validerCubeLocal(texte)).toEqual({ ok: true, taille: 65, avertissement: undefined });
      // 7,4 Mo lus et contrôlés trois fois : jusqu'à quelques secondes sur une machine chargée.
    }, 60_000);
  }
});

describe("contrôle qc à l'import (B.7)", () => {
  const n = 5;
  const identite = ecrireCube(lutIdentite(n), "Identité");

  it("une LUT saine passe ; une taille non prise en charge, une LUT 1D ou incomplète sont refusées clairement", () => {
    expect(validerCube(ecrireCube(lutIdentite(17)))).toMatchObject({ ok: true, taille: 17 });
    expect(validerCube(identite)).toEqual({ ok: false, erreur: expect.stringMatching(/5 points par côté/) });
    expect(validerCube("LUT_1D_SIZE 1024\n0 0 0\n")).toEqual({ ok: false, erreur: expect.stringMatching(/trois dimensions/) });
    expect(validerCube("LUT_3D_SIZE 17\n0 0 0\n")).toEqual({ ok: false, erreur: expect.stringMatching(/annonce 4913 couleurs mais en contient 1/) });
    expect(validerCube("bonjour")).toMatchObject({ ok: false });
  });

  it("gris qui s'inverse : refus (LUT cassée) ; transitions dures : acceptée avec un avertissement", () => {
    const base = lutIdentite(17);
    const inverse = { ...base, donnees: Float32Array.from(base.donnees) };
    const k = (8 + 8 * 17 + 8 * 17 * 17) * 3;
    inverse.donnees[k] = 0.1; // le gris du milieu devient plus sombre que ses voisins
    expect(validerCube(ecrireCube(inverse))).toEqual({ ok: false, erreur: expect.stringMatching(/abîmé/) });
    const dure = { ...base, donnees: Float32Array.from(base.donnees) };
    // Une marche nette sur le rouge à mi-parcours (hors diagonale) : cassure forte, gris intact.
    for (let b = 0; b < 17; b++) for (let g = 0; g < 17; g++) if (g !== 9 || b !== 9) dure.donnees[(9 + g * 17 + b * 17 * 17) * 3] += 0.5;
    const v = validerCube(ecrireCube(dure));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.rapport.cassureMax).toBeGreaterThan(CASSURE_MAX);
      expect(v.avertissement).toMatch(/transitions dures/);
    }
  });

  it("l'intensité mélange la LUT à l'identité, point par point (0 = rien, 1 = toute la LUT)", () => {
    const lut = lireCube(readFileSync(join("public", "luts", "axion-buffer-clair-obscur.cube"), "utf8"));
    const zero = melangerAvecIdentite(lut, 0);
    const pleine = melangerAvecIdentite(lut, 1);
    const moitie = melangerAvecIdentite(lut, 0.7);
    for (const [r, g, b] of [[0.2, 0.3, 0.6], [0.8, 0.5, 0.3], [0.05, 0.05, 0.05]]) {
      const id = echantillonner(zero, r, g, b);
      expect(id[0]).toBeCloseTo(r, 4);
      expect(id[2]).toBeCloseTo(b, 4);
      const l = echantillonner(lut, r, g, b);
      expect(echantillonner(pleine, r, g, b)[1]).toBeCloseTo(l[1], 5);
      expect(echantillonner(moitie, r, g, b)[0]).toBeCloseTo(r * 0.3 + l[0] * 0.7, 4);
    }
    // Écriture puis relecture : même table (6 décimales).
    const relue = lireCube(ecrireCube(moitie, "Essai"));
    expect(relue.taille).toBe(65);
    expect(relue.donnees[12345]).toBeCloseTo(moitie.donnees[12345], 5);
  }, 60_000);
});

describe("LUT dans la Bibliothèque et migration (étape 10)", () => {
  it("une LUT par usage : Clair-obscur pour l'avocat (`lut-avocat-v1`), Naturel pour le selfie ; versionnées", () => {
    const els = elementsLutsAxion("2026-10-02T00:00:00.000Z");
    expect(els.map((e) => e.id)).toEqual(["lut-avocat-v1", "lut-axion-naturel", "lut-axion-doux", "lut-axion-nuit"]);
    expect(els.every((e) => e.version === 1 && e.valeur.type === "lut" && e.valeur.tailleCube === 65 && !!e.fichierId)).toBe(true);
    expect(obtenirFormat("avocat").stylesParDefaut.lut).toBe("lut-avocat-v1");
    expect(obtenirFormat("selfie").stylesParDefaut.lut).toBe("lut-axion-naturel");
    expect(fichiersLutsAxion("x").find((f) => f.id === els[0].fichierId)?.cleStockage).toBe("/luts/axion-buffer-clair-obscur.cube");
  });

  it("pose le .cube sur `lut-avocat-v1`, ajoute les 3 autres, ne touche pas aux LUT d'exemple ; rejouable sans effet", async () => {
    const d = reinitialiserDepots();
    // Base « en ligne » d'avant M4 : lut-avocat-v1 posée par l'étape 2, sans fichier ; les 3 autres absentes.
    const nouvelles = ["lut-axion-naturel", "lut-axion-doux", "lut-axion-nuit"];
    const liste = (await d.elements.lister())
      .filter((e) => !nouvelles.includes(e.id))
      .map((e) => (e.id === "lut-avocat-v1" ? { ...e, fichierId: undefined, valeur: { type: "lut" as const, formatFichier: "cube" as const, tailleCube: 65, intensiteParDefaut: 70 } } : e));
    (d as unknown as Record<string, unknown>).elements = new DepotMemoire<ElementBibliotheque>(liste);
    const exemple = await d.elements.obtenir("lut-cinema");
    const r = await migrerDonnees(d, "2026-10-02T09:00:00.000Z");
    expect([...(r.lutsInstallees ?? [])].sort()).toEqual(["lut-avocat-v1", ...nouvelles].sort());
    const apres = (await d.elements.obtenir("lut-avocat-v1"))!;
    expect(apres.fichierId).toBe("f-luts-axion-buffer-clair-obscur");
    expect((await d.fichiers.obtenir("f-luts-axion-buffer-clair-obscur"))?.cleStockage).toBe("/luts/axion-buffer-clair-obscur.cube");
    expect(await d.elements.obtenir("lut-cinema")).toEqual(exemple);
    const second = await migrerDonnees(d, "2026-10-02T10:00:00.000Z");
    expect(second.lutsInstallees ?? []).toEqual([]);
  });
});
