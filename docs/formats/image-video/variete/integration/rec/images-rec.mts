/**
 * Banc du lot REC : le banc commun (`scripts/image-video/variete/images-fixes.mts`) sur la fiche simulée de la carte C
 * ÉCRITE selon le récit demandé (`FICHES_SIMULEES_RECIT`), car le déroulé vit dans le script. Le banc commun lit
 * toujours la fiche de base `essai-c` (fichier du socle, non modifiable ici) : cette enveloppe en remplace le contenu
 * en mémoire, pour ce processus seulement, puis lance le banc tel quel (mêmes options). Aucun appel payant.
 *
 * Usage (depuis la racine du dépôt) :
 *   studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/integration/rec/images-rec.mts --code REC-B --format 9:16 --sortie /tmp/rec-b
 */
import { FICHES_SIMULEES, FICHES_SIMULEES_RECIT } from "../../../../../../src/moteurs/montage-image-video/ecriture.simulation";
import type { CodeRecit } from "../../../../../../src/moteurs/montage-image-video/recettes";

const i = process.argv.indexOf("--recette") >= 0 ? process.argv.indexOf("--recette") : process.argv.indexOf("--code");
const recit = (process.argv[i + 1] ?? "").split(",").find((c) => c.startsWith("REC-")) as CodeRecit | undefined;
const fiche = recit ? FICHES_SIMULEES_RECIT["essai-c"]?.[recit] : undefined;
// Le registre est gelé, pas les fiches : on remplace le CONTENU de la fiche de base par celui de la fiche du récit.
if (fiche) Object.assign(FICHES_SIMULEES["essai-c"]!, structuredClone(fiche));
console.log(`fiche : ${fiche ? `essai-c écrite en ${recit}` : "essai-c (base)"}`);
// Chemin calculé : le banc commun est un script `.mts`, lancé tel quel (pas un module typé à importer).
await import(new URL("../../../../../../scripts/image-video/variete/images-fixes.mts", import.meta.url).href);
