/**
 * MESURE DU TEMPS DE RENDU des calques image (lot M4, critère « temps de rendu local mesuré ») : rend 50 images
 * (2 s) de la composition « CompositionImage » en faisant varier ce qui coûte (webm transparent du double, liseré,
 * accessoire flou), pour savoir où passe le temps. Usage : `pnpm exec tsx outils/demo-m4/mesurer-rendu.mts [concurrence]`
 * (après `rendre-demo.mts`, qui laisse le webm du double d'essai dans le dossier temporaire).
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const ENTREES = join(tmpdir(), "studio-m4-demo", "entrees");
if (!existsSync(join(ENTREES, "double-essai.webm"))) throw new Error("Lancez d'abord outils/demo-m4/rendre-demo.mts");
const concurrence = Number(process.argv[2] ?? 4);

const { servirDossier } = await import("../../studio-rendu/src/composition/serveur-fichiers");
const { paquetCompositions } = await import("../../studio-rendu/src/remotion");
const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
const { renderMedia, selectComposition } = exiger("@remotion/renderer") as typeof import("../../studio-rendu/node_modules/@remotion/renderer");

const serveur = await servirDossier(ENTREES);
const serveUrl = await paquetCompositions();
const plans = [{ debutSec: 0, finSec: 2, type: "double", angle: "principal", cadrage: { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } }];
const base = {
  ratio: "9:16",
  largeur: 1080,
  hauteur: 1920,
  fps: 25,
  images: 50,
  decor: { image: `${serveur.base}/fond-1-halo-orange.jpg`, teinte: "#110A05", teinteLumiere: "#C65A2E", directionLumiere: "face", flouPx: 0, clair: false },
  doubles: { principal: { type: "video", url: `${serveur.base}/double-essai.webm`, transparent: true } },
  accessoire: { x: 0.95, y: 0.4, largeurPct: 22, flouPx: 8 },
  contour: { couleur: "#C65A2E", cote: "gauche" },
  plans,
};
const variantes: [string, Record<string, unknown>][] = [
  ["complet (webm alpha + liseré + micro flou)", base],
  ["sans liseré", { ...base, contour: undefined }],
  ["sans micro flou", { ...base, accessoire: undefined }],
  ["sans liseré ni micro (double webm seul)", { ...base, accessoire: undefined, contour: undefined }],
  ["double dessiné (sans webm)", { ...base, doubles: { principal: { type: "silhouette", tenue: "#1E2128", peau: "#C4967A" } } }],
  ["décor seul", { ...base, doubles: { principal: { type: "image", url: `${serveur.base}/illu-02.jpg` } }, accessoire: undefined, contour: undefined }],
];
for (const [nom, props] of variantes) {
  const c = await selectComposition({ serveUrl, id: "CompositionImage", inputProps: props });
  const t0 = Date.now();
  await renderMedia({ composition: c, serveUrl, codec: "h264", crf: 10, colorSpace: "bt709", imageFormat: "jpeg", jpegQuality: 95, muted: true, outputLocation: join(tmpdir(), "studio-m4-demo", "mesure.mp4"), inputProps: props, concurrency: concurrence, chromiumOptions: { gl: "swangle" } });
  const s = (Date.now() - t0) / 1000;
  console.log(`${nom} : ${s.toFixed(1)} s pour 50 images (${(50 / s).toFixed(2)} i/s), concurrence ${concurrence}`);
}
await serveur.fermer();
