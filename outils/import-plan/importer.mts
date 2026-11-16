/**
 * L4-10 — Import du plan LinkedIn, À BLANC uniquement (l'écriture reste refusée tant que le relevé RC-24 n'est pas fait).
 *   pnpm exec tsx outils/import-plan/importer.mts --csv <calendrier.csv> --md <posts.md>
 * Aucun appel réseau, aucune écriture. Les fichiers du plan restent HORS du dépôt.
 */
import { readFileSync } from "node:fs";
import { planifierImport } from "../../src/services/import-plan/importer-plan";

const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const csv = valeur("--csv");
const md = valeur("--md");
if (!csv || !md) {
  console.error("Usage : importer.mts --csv <calendrier.csv> --md <posts.md>");
  process.exit(2);
}
if (args.includes("--executer")) {
  console.error("Refusé : aucune écriture avant le relevé RC-24 (posts possiblement déjà chez le diffuseur).");
  process.exit(3);
}
const r = planifierImport({ csv: readFileSync(csv, "utf8"), markdown: readFileSync(md, "utf8"), horloge: () => new Date(), clesExistantes: new Set() });
console.log(`À blanc : ${r.entrees.length} entrées, ${r.passeInconnu} passe_inconnu, ${r.alertesTu} alertes « tu », ${r.refondusIgnores} REFONDU ignorées, ${r.sansTexte.length} sans texte.`);
