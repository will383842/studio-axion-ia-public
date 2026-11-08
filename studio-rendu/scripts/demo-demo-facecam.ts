/**
 * ESSAI LOCAL DE LA COMPOSITION « DemoFacecam » (lot J) : deux vidéos d'essai fabriquées par FFmpeg (une « facecam »
 * avec un son, un « écran »), un plan de scènes simple, un zoom, un clic, une légende, des sous-titres fictifs, la
 * carte de fin Axion. Aucun appel à un LLM ni au studio-aligneur.
 * Usage (depuis `studio-rendu/`) : `STUDIO_RENDU_NAVIGATEUR=/chemin/chrome npx tsx scripts/demo-demo-facecam.ts [--images]`
 * Sortie : `../out/demo-facecam-essai.mp4` (+ trois images fixes avec `--images`).
 */
import { execFileSync } from "node:child_process";
import { createReadStream, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { planDeRepli, validerPlan } from "../../src/briques/plan-scenes/validateur";
import { DUREE_CARTE_FIN_MS, miseEnPageDemo, recadrage } from "../../src/moteurs/montage-demo-facecam/mise-en-page";
import { pistesEcran, planPourCalque } from "../../src/moteurs/montage-demo-facecam/pistes";
import type { ProprietesDemoFacecam } from "../../src/moteurs/montage-demo-facecam/proprietes";

const racine = resolve(import.meta.dirname, "..");
const sortie = resolve(racine, "../out");
mkdirSync(sortie, { recursive: true });
const DUREE = 6;
const fabriquer = (nom: string, source: string, son: boolean) => {
  const f = resolve(sortie, nom);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `${source}=size=1920x1080:rate=25:duration=${DUREE}`, ...(son ? ["-f", "lavfi", "-i", `sine=frequency=220:duration=${DUREE}`, "-c:a", "aac"] : []), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", f]);
  return f;
};
const fichiers = { "/facecam.mp4": fabriquer("essai-facecam.mp4", "testsrc2", true), "/ecran.mp4": fabriquer("essai-ecran.mp4", "smptebars", false) };
const serveur = createServer((req, res) => {
  const f = fichiers[req.url as keyof typeof fichiers];
  if (!f) return void res.writeHead(404).end();
  res.writeHead(200, { "content-type": "video/mp4", "content-length": statSync(f).size, "access-control-allow-origin": "*" });
  createReadStream(f).pipe(res);
}).listen(0);
const port = (serveur.address() as { port: number }).port;

const texte = "Je clique ici sur nouveau devis puis je choisis le client et voilà";
const mots = texte.split(" ").map((t, i) => ({ texte: t, debutMs: 300 + i * 420, finMs: 300 + i * 420 + 360 }));
const m = miseEnPageDemo("4:5");
const format = { largeur: m.ecran.largeur, hauteur: m.ecran.hauteur, fps: 25 as const };
const { plan } = validerPlan(planDeRepli({ mots, format, facecam: false, dureeMs: DUREE * 1000 }), { mots, format, facecam: false, dureeMs: DUREE * 1000 });
const pistes = pistesEcran(plan, [
  { type: "zoom", debutMs: 1500, finMs: 3500, x: 70, y: 35, facteur: 1.8 },
  { type: "clic", ms: 2500, x: 70, y: 35 },
  { type: "legende", debutMs: 400, finMs: 2000, texte: "Nouveau devis" },
]);
const props: ProprietesDemoFacecam = {
  largeur: m.largeur,
  hauteur: m.hauteur,
  fps: 25,
  images: Math.ceil(((DUREE * 1000 + DUREE_CARTE_FIN_MS) * 25) / 1000),
  dureeParoleMs: DUREE * 1000,
  miseEnPage: m,
  facecam: `http://127.0.0.1:${port}/facecam.mp4`,
  ecran: `http://127.0.0.1:${port}/ecran.mp4`,
  recadrageFacecam: recadrage({ largeur: 1920, hauteur: 1080 }, "entier", m.facecam, { x: 0.5, y: 0.42 }),
  recadrageEcran: recadrage({ largeur: 1920, hauteur: 1080 }, "entier", m.ecran),
  sourceFacecam: { largeur: 1920, hauteur: 1080 },
  sourceEcran: { largeur: 1920, hauteur: 1080 },
  decalageEcranSec: 0,
  ...pistes,
  plan: planPourCalque(plan),
  sousTitres: [0, 4, 8].map((d) => ({ debutMs: mots[d].debutMs, finMs: (mots[d + 4] ?? mots.at(-1)!).finMs, mots: mots.slice(d, d + 4) })),
  carteFin: { titre: "Axion IA", sousTitre: "axion-ia.com" },
};

const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (!navigateur) await ensureBrowser();
const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const } };
const inputProps = props as unknown as Record<string, unknown>;
const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
const composition = await selectComposition({ serveUrl, id: "DemoFacecam", inputProps, ...reglages });
console.log(`composition : ${composition.width} × ${composition.height}, ${composition.durationInFrames} images`);
if (process.argv.includes("--images")) {
  for (const image of [20, 62, 190]) await renderStill({ composition, serveUrl, frame: image, output: resolve(sortie, `demo-facecam-essai-${image}.png`), inputProps, ...reglages });
}
await renderMedia({ composition, serveUrl, codec: "h264", crf: 20, outputLocation: resolve(sortie, "demo-facecam-essai.mp4"), inputProps, concurrency: 2, ...reglages });
console.log("vidéo :", resolve(sortie, "demo-facecam-essai.mp4"));
serveur.close();
