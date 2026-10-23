/**
 * ESSAI RÉEL des types de pages M3a (T01B, T01C, T06, T08, T10, T20, T21) et de la planche des éléments décoratifs E01–E15 :
 * rend les JPEG 1080 × 1350 de `essais-visuels/m3a/` avec le vrai Remotion, puis CONTRÔLE chaque type du registre au contenu
 * MAXIMAL du schéma (aucun débordement) et au contenu MINIMAL (aucune zone vide de plus de 15 % de la hauteur).
 * Sort en erreur si un contrôle échoue. Usage (depuis `studio-rendu/`) :
 *   npx tsx --tsconfig ../tsconfig.json scripts/essai-visuel-m3a.ts [--sans-controle]
 * Navigateur : `STUDIO_RENDU_NAVIGATEUR` ; sans variable, l'installation locale de Playwright si elle existe.
 */
import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { casMax, CONTENU_ESSAI_M3A, CONTENU_ESSAI_M3A_C, FICHIER_COUVERTURE_C_M3A, FICHIER_DECORS_M3A, FICHIER_T08_MAX_M3A, FICHIERS_ESSAI_M3A, specAutour } from "./contenu-essai-visuel.js";
import { controlerMax, controlerMin, PART_ZONE_VIDE_MAX, TYPES_CONTROLES } from "./controle-pages.js";
import { ouvrirRendeur } from "./rendu-visuel.js";

const sortie = resolve("essais-visuels", "m3a");
mkdirSync(sortie, { recursive: true });
const rendeur = await ouvrirRendeur();

for (const [index, fichier] of FICHIERS_ESSAI_M3A.entries()) {
  const chemin = resolve(sortie, fichier);
  await rendeur.page(CONTENU_ESSAI_M3A, index, chemin);
  console.log(`${fichier} : ${Math.round(statSync(chemin).size / 1024)} Ko`);
}
// Couverture C (carrousel à part : une couverture n'est admise qu'en première page) et T08 au contenu MAXIMAL.
const couvertureC = resolve(sortie, FICHIER_COUVERTURE_C_M3A);
await rendeur.page(CONTENU_ESSAI_M3A_C, 0, couvertureC);
console.log(`${FICHIER_COUVERTURE_C_M3A} : ${Math.round(statSync(couvertureC).size / 1024)} Ko`);
const { spec: specT08, index: indexT08 } = specAutour(casMax("T08")[0].page as Record<string, unknown>);
const t08Max = resolve(sortie, FICHIER_T08_MAX_M3A);
await rendeur.page(specT08, indexT08, t08Max);
console.log(`${FICHIER_T08_MAX_M3A} : ${Math.round(statSync(t08Max).size / 1024)} Ko`);
const decors = resolve(sortie, FICHIER_DECORS_M3A);
await rendeur.decors(decors);
console.log(`${FICHIER_DECORS_M3A} : ${Math.round(statSync(decors).size / 1024)} Ko`);

if (!process.argv.includes("--sans-controle")) {
  let echec = false;
  for (const type of TYPES_CONTROLES) {
    for (const r of await controlerMax(rendeur, type)) {
      console.log(`${type} MAX ${r.nom} : ${r.erreur ? `ÉCHEC ${r.erreur}` : "0 débordement"}`);
      echec ||= r.erreur !== null;
    }
    // La couverture A (T01, validée en M1-04) est volontairement minimaliste : pas de contrôle de zone vide.
    for (const r of type === "T01" ? [] : await controlerMin(rendeur, type)) {
      const ok = r.part <= PART_ZONE_VIDE_MAX;
      console.log(`${type} MIN ${r.nom} : plus haute zone vide ${r.hauteurVidePx} px (${Math.round(r.part * 100)} %, en x=${r.x} y=${r.y}) ${ok ? "ok" : "TROP VIDE"}`);
      echec ||= !ok;
    }
  }
  process.exit(echec ? 1 : 0);
}
