/**
 * Script LOCAL (lancé à la main, jamais en CI) : empaquette l'entrée des planches et rend une image fixe par composition
 * dans un dossier local. Aucun envoi, aucun stockage distant. Usage : `npx tsx scripts/planche-petits-objets.ts [dossier-de-sortie]`.
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const sortie = resolve(process.argv[2] ?? resolve(ici, "..", "sortie-planches-petits-objets"));
const IDS = ["planche-traits-9x16-ivoire", "planche-traits-9x16-noir", "planche-traits-4x5-ivoire", "planche-traits-4x5-noir",
  "planche-etiquettes-9x16-ivoire", "planche-etiquettes-9x16-noir", "planche-etiquettes-4x5-ivoire", "planche-etiquettes-4x5-noir", "planche-ecrans-9x16-ivoire", "planche-ecrans-9x16-noir", "planche-ecrans-4x5-ivoire", "planche-ecrans-4x5-noir", "planche-manuscrit-9x16-ivoire", "planche-manuscrit-9x16-noir", "planche-manuscrit-4x5-ivoire", "planche-manuscrit-4x5-noir"];

async function main() {
  const { bundle } = await import("@remotion/bundler");
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  mkdirSync(sortie, { recursive: true });
  const serveUrl = await bundle({ entryPoint: resolve(ici, "..", "compositions", "petits-objets", "planche", "entree.ts") });
  for (const id of IDS) {
    const composition = await selectComposition({ serveUrl, id });
    const output = resolve(sortie, `${id}.png`);
    await renderStill({ composition, serveUrl, output, frame: 0 });
    console.log(output);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
