/**
 * ESSAI RÉEL du lot L10 / L11 : T29 « relance » (contenu ordinaire, mots longs, budgets maximaux) et la variante « étapes à mini-maquettes »
 * de T20 (3, 4 et 5 étapes), plus l'ancienne page étapes (sans la clé `variante`) pour la preuve d'empreinte. Chaque rendu passe par le vrai
 * Remotion et sa MESURE (débordements, textes en zone réservée, chevauchements, plus petit corps, vide). Sans réseau extérieur, sans appel payant.
 * Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome-headless-shell npx tsx --tsconfig ../tsconfig.json scripts/essai-l10-l11.ts <dossier de sortie> [préfixes…]
 * Sortie : un JPEG par cas et `mesures.json` dans le dossier donné, hors dépôt.
 */
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { creerVisuelPage, rendreAvecRemotion } from "../src/operations/visuel-page.js";
import { CAS_L10_L11 } from "./contenu-essai-l10-l11.js";
import { specAutour } from "./contenu-essai-visuel.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (!navigateur) throw new Error("STUDIO_RENDU_NAVIGATEUR doit désigner un Chrome Headless Shell.");

const sortie = resolve(process.argv[2] ?? mkdtempSync(join(tmpdir(), "essai-l10-l11-")));
mkdirSync(sortie, { recursive: true });
const filtre = process.argv.slice(3).map((a) => a.toLowerCase());
const travail = mkdtempSync(join(tmpdir(), "essai-l10-l11-travail-"));
const op = creerVisuelPage({ rendre: rendreAvecRemotion({ navigateur }), deposer: async (cible, chemin) => void copyFileSync(chemin, cible) });

const resultats: Record<string, unknown> = {};
const echecs: string[] = [];
for (const e of CAS_L10_L11.filter((c) => filtre.length === 0 || filtre.some((f) => c.nom.startsWith(f)))) {
  const { spec, index } = specAutour(e.page);
  const cible = join(travail, `${e.nom}.jpg`);
  try {
    const r = await op(
      { idRendu: e.nom, operation: "visuel-page", file: "courte", entrees: {}, sortie: { urlDepot: cible, cle: "essai" }, parametres: { proprietes: { spec, index }, scale: 1, jpegQuality: 90 } },
      { progression: () => {}, dossier: mkdtempSync(join(travail, "p-")), signal: new AbortController().signal },
    );
    copyFileSync(cible, join(sortie, `${e.nom}.jpg`));
    resultats[e.nom] = r;
    console.log(e.nom, JSON.stringify(r));
  } catch (err) {
    echecs.push(`${e.nom} : ${err instanceof Error ? err.message : String(err)}`);
    console.log(e.nom, "ÉCHEC", err instanceof Error ? err.message : String(err));
  }
}
writeFileSync(join(sortie, "mesures.json"), JSON.stringify(resultats, null, 2));
if (echecs.length > 0) {
  console.error(echecs.join("\n"));
  process.exit(1);
}
