/**
 * Banc des MAQUETTES de variété (jamais branché dans le moteur). Construit une entrée de prototypes (fichier .tsx qui
 * appelle `registerRoot`) avec Remotion, puis rend une image fixe JPEG par composition inscrite.
 *
 * Usage (depuis la racine du dépôt) :
 *   studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/prototypes/rendre.mts <entree.tsx> <dossier-sortie> [filtre]
 * Chaque composition = UNE image : on rend l'image `defaultProps.image` (0 par défaut). Fichier = <id>.jpg.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = resolve(import.meta.dirname, "../../../../..");
const MODULES = resolve(RACINE, "studio-rendu/node_modules");
const exiger = createRequire(resolve(RACINE, "studio-rendu/package.json"));
const { bundle } = exiger("@remotion/bundler");
const { getCompositions, renderStill } = exiger("@remotion/renderer");

const [entree, sortie, filtre] = process.argv.slice(2);
if (!entree || !sortie) throw new Error("Usage : rendre.mts <entree.tsx> <dossier-sortie> [filtre]");
mkdirSync(sortie, { recursive: true });
const serveUrl: string = await bundle({
  entryPoint: resolve(entree),
  webpackOverride: (c: any) => ({ ...c, resolve: { ...c.resolve, modules: [MODULES, "node_modules"] }, resolveLoader: { ...(c.resolveLoader ?? {}), modules: [MODULES, "node_modules"] } }),
});
const commun = { browserExecutable: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", chromiumOptions: { gl: "swangle" } };
const toutes = await getCompositions(serveUrl, commun);
for (const composition of toutes) {
  if (filtre && !composition.id.includes(filtre)) continue;
  const frame = Number(composition.defaultProps?.image ?? 0);
  const output = resolve(sortie, `${composition.id}.jpg`);
  await renderStill({ serveUrl, composition, inputProps: composition.defaultProps, frame, output, imageFormat: "jpeg", jpegQuality: 90, ...commun });
  console.log(`rendue : ${output}`);
}
