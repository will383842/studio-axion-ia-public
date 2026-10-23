/**
 * Lot M4b — capture du micro dessiné seul (composition « CompositionAccessoire ») sur un fond gris, pour le vérifier à
 * l'œil sans rendre toute la vidéo. Usage : `pnpm exec tsx outils/demo-m4/essai-micro.mts [sortie.png]`.
 */
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const sortie = process.argv[2] ?? join(tmpdir(), "micro-essai.png");
const { paquetCompositions } = await import("../../studio-rendu/src/remotion");
const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
const { renderStill, selectComposition } = exiger("@remotion/renderer") as typeof import("../../studio-rendu/node_modules/@remotion/renderer");
const serveUrl = await paquetCompositions();
for (const flouPx of [0, 6]) {
  const props = { accessoire: { x: 0.79, y: 0.3, largeurPct: 20, flouPx }, lumiere: "#C65A2E" };
  const c = await selectComposition({ serveUrl, id: "CompositionAccessoire", inputProps: props });
  const png = join(tmpdir(), `micro-${flouPx}.png`);
  await renderStill({ composition: c, serveUrl, output: png, imageFormat: "png", inputProps: props, chromiumOptions: { gl: "swangle" } });
  console.log(`flou ${flouPx} : ${c.width}×${c.height} → ${png}`);
}
spawnSync("ffmpeg", ["-v", "error", "-y", "-i", join(tmpdir(), "micro-0.png"), "-i", join(tmpdir(), "micro-6.png"), "-filter_complex", "color=c=0x6B4A3A:s=600x800[f];[0:v]crop=iw:600:0:0[a];[1:v]crop=iw:600:0:0[b];[a][b]hstack[h];[f][h]overlay=(W-w)/2:100:shortest=1", "-frames:v", "1", sortie]);
console.log(`→ ${sortie}`);
