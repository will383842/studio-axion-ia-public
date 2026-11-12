/**
 * DÉMO DU TUTORIEL D'OUTIL (lot I) : le plan de démo du lot C, validé, mis au format maître 4:5 (1080 × 1350), rendu par
 * la composition `TutorielOutil` (plan plein écran + carte de fin Axion). Muet, sans sous-titres (la voix et les
 * sous-titres arrivent par la demande de rendu du moteur). Aucun appel à un LLM ni à HeyGen.
 * Usage (depuis `studio-rendu/`) : `STUDIO_RENDU_NAVIGATEUR=/chemin/chrome npx tsx scripts/demo-tutoriel-outil.ts [--images]`
 * Sortie : `../out/tutoriel-outil-demo.mp4` (+ deux images fixes avec `--images`).
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { PLAN_DEMO } from "../../src/briques/plan-scenes/demo";
import { validerPlan } from "../../src/briques/plan-scenes/validateur";
import { CARTE_FIN_AXION, DUREE_CARTE_FIN_MS, formatDuRatio } from "../../src/moteurs/montage-tutoriel-outil/proprietes";

const racine = resolve(import.meta.dirname, "..");
const sortie = resolve(racine, "../out");
mkdirSync(sortie, { recursive: true });

const format = formatDuRatio("4:5");
const { plan, remarques } = validerPlan({ ...PLAN_DEMO, format }, { format, facecam: false });
console.log("remarques du validateur :", remarques.length ? JSON.stringify(remarques) : "aucune");

const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (!navigateur) await ensureBrowser();
const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const } };
const inputProps = { plan, fin: { ...CARTE_FIN_AXION }, finMs: DUREE_CARTE_FIN_MS } as unknown as Record<string, unknown>;
const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
const composition = await selectComposition({ serveUrl, id: "TutorielOutil", inputProps, ...reglages });
console.log(`composition : ${composition.width} × ${composition.height}, ${composition.durationInFrames} images à ${composition.fps} i/s`);

if (process.argv.includes("--images")) {
  for (const image of [190, composition.durationInFrames - 20]) {
    await renderStill({ composition, serveUrl, frame: image, output: resolve(sortie, `tutoriel-outil-demo-${image}.png`), inputProps, ...reglages });
  }
}
await renderMedia({ composition, serveUrl, codec: "h264", crf: 20, outputLocation: resolve(sortie, "tutoriel-outil-demo.mp4"), inputProps, muted: true, concurrency: 2, ...reglages });
console.log("vidéo :", resolve(sortie, "tutoriel-outil-demo.mp4"));
