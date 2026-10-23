#!/usr/bin/env node
/**
 * IMPORT DES LUT « AXION BUFFER » dans le dépôt (lot M4 ; `luts/A-INTEGRER-DANS-LE-STUDIO.md`).
 * Copie les 4 fichiers `.cube` de 65 points (Clair-obscur = défaut avocat, Naturel = selfie, Doux, Nuit) depuis le
 * dossier du plan vers `public/luts/`, après le même contrôle que `outils/lut/qc.py` et `tests/luts.test.ts`
 * (en-tête valide, taille 65, gris monotone, cassure < 0,02). Un fichier cassé n'est JAMAIS copié.
 * Les éléments de la Bibliothèque (`lut-avocat-v1` versionné et les 3 autres) sont posés au démarrage par la
 * migration de données (étape 10), pas par ce script.
 *
 * Usage : node scripts/importer-luts.mjs [dossier-source]
 *   (défaut : ../Axion-IA/<dossier-de-plan-prive>/luts)
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SOURCE = resolve(process.argv[2] ?? "../Axion-IA/<dossier-de-plan-prive>/luts");
const CIBLE = resolve("public/luts");
const LUTS = [
  ["Axion-Buffer-Clair-obscur.cube", "axion-buffer-clair-obscur.cube"],
  ["Axion-Buffer-Naturel.cube", "axion-buffer-naturel.cube"],
  ["Axion-Buffer-Doux.cube", "axion-buffer-doux.cube"],
  ["Axion-Buffer-Nuit.cube", "axion-buffer-nuit.cube"],
];

/** Même calcul que outils/lut/qc.py (cassure ramenée au pas d'une LUT de 65 points). */
function controler(texte) {
  const lignes = texte.split(/\r?\n/);
  const taille = Number(lignes.find((l) => l.startsWith("LUT_3D_SIZE"))?.split(/\s+/)[1]);
  if (!/^TITLE /.test(lignes[0]) || taille !== 65) return { ok: false, raison: "en-tête invalide ou taille ≠ 65" };
  const v = lignes.filter((l) => /^-?\d/.test(l)).map((l) => l.trim().split(/\s+/).map(Number));
  if (v.length !== taille ** 3) return { ok: false, raison: "LUT incomplète" };
  const p = (r, g, b) => v[r + g * taille + b * taille * taille];
  for (let i = 1; i < taille; i++) for (let c = 0; c < 3; c++) if (p(i, i, i)[c] - p(i - 1, i - 1, i - 1)[c] < -1e-6) return { ok: false, raison: "gris non monotone" };
  let cassure = 0;
  for (let b = 0; b < taille; b++)
    for (let g = 0; g < taille; g++)
      for (let r = 0; r < taille; r++)
        for (let c = 0; c < 3; c++) {
          const x = p(r, g, b)[c];
          if (r >= 2) cassure = Math.max(cassure, Math.abs(x - 2 * p(r - 1, g, b)[c] + p(r - 2, g, b)[c]));
          if (g >= 2) cassure = Math.max(cassure, Math.abs(x - 2 * p(r, g - 1, b)[c] + p(r, g - 2, b)[c]));
          if (b >= 2) cassure = Math.max(cassure, Math.abs(x - 2 * p(r, g, b - 1)[c] + p(r, g, b - 2)[c]));
        }
  cassure *= (taille - 1) ** 2 / 64 ** 2;
  return cassure < 0.02 ? { ok: true, cassure } : { ok: false, raison: `cassure ${cassure.toFixed(4)} ≥ 0,02` };
}

let erreurs = 0;
for (const [source, cible] of LUTS) {
  const chemin = join(SOURCE, source);
  if (!existsSync(chemin)) {
    console.error(`absent : ${chemin}`);
    erreurs++;
    continue;
  }
  const r = controler(readFileSync(chemin, "utf8"));
  if (!r.ok) {
    console.error(`refusé : ${source} (${r.raison})`);
    erreurs++;
    continue;
  }
  copyFileSync(chemin, join(CIBLE, cible));
  console.log(`importé : ${source} → public/luts/${cible} (cassure ${r.cassure.toFixed(4)})`);
}
process.exit(erreurs ? 1 : 0);
