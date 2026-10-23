/**
 * Mesure, au VRAI rendu, la longueur du plus long MOT d'un titre de carte de la page dense (T02) selon le nombre de cartes :
 * un titre d'un seul mot (mots réels de 12 à 15 lettres, mots de lettres larges). Sert à fixer `capaciteMotCarte` (porte qualité). Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/headless_shell npx tsx --tsconfig ../tsconfig.json scripts/essai-mot-long-carte.ts
 */
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerVisuelPage, rendreAvecRemotion } from "../src/operations/visuel-page.js";
import { MINIS_ESSAI, MOTS_LONGS, specAutour, texteInvente } from "./contenu-essai-visuel.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const travail = mkdtempSync(join(tmpdir(), "mot-long-"));
const op = creerVisuelPage({
  rendre: rendreAvecRemotion({ navigateur: process.env.STUDIO_RENDU_NAVIGATEUR }),
  deposer: async (cible, chemin) => void copyFileSync(chemin, cible),
});

async function tient(n: number, mot: string): Promise<boolean> {
  const k = mot.length;
  const page = { type: "T02", titre: texteInvente(21), cartes: Array.from({ length: n }, (_, i) => ({ titre: mot.charAt(0).toUpperCase() + mot.slice(1), corps: texteInvente(36, i), mini: MINIS_ESSAI[i % MINIS_ESSAI.length] })) };
  const { spec, index } = specAutour(page);
  try {
    const r = await op(
      { idRendu: `m${n}-${k}`, operation: "visuel-page", file: "courte", entrees: {}, sortie: { urlDepot: join(travail, `m${n}-${k}.jpg`), cle: "essai" }, parametres: { proprietes: { spec, index }, scale: 1, jpegQuality: 88 } },
      { progression: () => {}, dossier: mkdtempSync(join(travail, "p-")), signal: new AbortController().signal },
    );
    return ((r.mesures ?? {}) as Record<string, number>).debordements === 0;
  } catch {
    return false;
  }
}

// Mots français RÉELS (les plus larges : m, w, é…) de 10 à 16 lettres, plus un mot de lettres larges.
const MOTS = [...MOTS_LONGS, "mmmmmmmmmmmm", "mmmmmmmmmmmmm", "mmmmmmmmmmmmmm", "mmmmmmmmmmmmmmm"].sort((a, b) => a.length - b.length);
for (const n of [2, 3, 4, 5, 6]) {
  const echecs: string[] = [];
  for (const mot of MOTS) if (!(await tient(n, mot))) echecs.push(`${mot}(${mot.length})`);
  console.log(`MESURE T02 ${n} cartes : échecs = ${echecs.join(", ") || "aucun"}`);
}
process.exit(0);
