/**
 * ESSAI RÉEL de la composition VisuelPage (M1-04) : rend 2 JPEG 1080 × 1350 avec le vrai Remotion (renderStill), sans Docker,
 * sans réseau extérieur, sans appel payant : une couverture T01 (variante A) et une page dense T02 (six cartes).
 * Le contenu est figé et inventé (`contenu-essai-visuel.ts`) et passe par le schéma Zod avant le rendu.
 * Usage (depuis `studio-rendu/`) : `npx tsx --tsconfig ../tsconfig.json scripts/essai-visuel.ts`
 * Sortie : `essais-visuels/*.jpg`. Navigateur : `STUDIO_RENDU_NAVIGATEUR` (chemin d'un Chromium local) si celui de Remotion
 * ne se télécharge pas ; réservé à CE script, jamais dans le code de production.
 */
import { mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { validerProprietesPage } from "../../src/visuels/proprietes-page.js";
import { ID_COMPOSITION_PAGE } from "../compositions/visuels/commun/constantes.js";
import { CONTENU_ESSAI, FICHIERS_ESSAI } from "./contenu-essai-visuel.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";

const sortie = resolve("essais-visuels");
mkdirSync(sortie, { recursive: true });

const { renderStill, selectComposition } = await import("@remotion/renderer");
const { paquetCompositions, REGLAGES_RENDU } = await import("../src/remotion.js");
const serveUrl = await paquetCompositions();
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
const options = navigateur ? { browserExecutable: navigateur } : {};

for (const [index, fichier] of FICHIERS_ESSAI.entries()) {
  // Le spec passe par le schéma Zod AVANT d'arriver à Remotion (aucune URL, aucune propriété libre).
  const proprietes = validerProprietesPage({ spec: CONTENU_ESSAI, index });
  const inputProps = proprietes as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: ID_COMPOSITION_PAGE, inputProps, ...options });
  const output = resolve(sortie, fichier);
  await renderStill({ ...REGLAGES_RENDU, composition, serveUrl, output, frame: 0, imageFormat: "jpeg", jpegQuality: 88, inputProps, ...options } as never);
  console.log(`${fichier} : ${composition.width}×${composition.height}, ${Math.round(statSync(output).size / 1024)} Ko`);
}
