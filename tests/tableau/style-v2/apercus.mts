/**
 * APERÇUS DU STYLE « blocs/2 » : rendu RÉEL (Remotion, Chromium sans affichage, FFmpeg) de la fiche témoin
 * « Formation » calée sur la voix modèle, dans les quatre formats de sortie. Images clés aux instants de la planche de
 * la vidéo modèle (vertical) et trois par autre format ; petites images JPEG et une planche par format.
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/style-v2/apercus.mts [dossier de sortie]   (défaut : docs/formats/apercus-style-v2)
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome   navigateur sans affichage (sinon celui de Playwright, s'il est là)
 * Aucun appel payant : la voix n'est pas lue (seulement son minutage `temps-formation.json`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { ficheFormationCalee, motsFormation } from "./temoin-formation";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, "docs/formats/apercus-style-v2"));
mkdirSync(sortie, { recursive: true });
const brut = join(sortie, ".png");
mkdirSync(brut, { recursive: true });
const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
interface CompositionChoisie {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };

/** Instants de la planche de la vidéo modèle (s), puis la fin. */
const INSTANTS_VERTICAL = [0, 3.4, 4.9, 7.2, 8.7, 10.6, 12.4, 14.2, 18.7, 22.4, 31.7, 34.3, 41.5, 42.5, 46.2, 52.0];
const INSTANTS_AUTRES = [3.4, 22.4, 52.0];

const calage = ficheFormationCalee();
const mots = motsFormation();
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });

for (const format of ["vertical", "portrait", "carre", "horizontal"] as IdFormatSortie[]) {
  const mise = mettreEnPage(calage.fiche, format === "vertical" ? {} : { format }) as unknown as MiseBrique;
  const props = proprietesScenes({ miseEnPage: mise, scenes: calage.fiche.scenes as SceneCalee[], heures: calage.elements, stylo: calage.fiche.stylo, mots });
  const instants = format === "vertical" ? INSTANTS_VERTICAL : INSTANTS_AUTRES;
  const images: string[] = [];
  for (const s of instants) {
    const ms = s * 1000;
    const p = props.find((x) => ms >= x.scene.debutMs && ms < x.scene.finMs) ?? props[props.length - 1];
    const frame = Math.min(Math.round(((ms - p.scene.debutMs) / 1000) * p.fps), Math.round(((p.scene.finMs - p.scene.debutMs) / 1000) * p.fps) - 1);
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
    const png = join(brut, `${format}-${s.toFixed(1)}.png`);
    await renderStill({ composition, serveUrl, output: png, frame, inputProps, imageFormat: "png", ...reglages });
    const jpg = join(sortie, `${format}-${String(s.toFixed(1)).replace(".", "_")}s.jpg`);
    // Petite image (largeur 360 ou 640) avec l'instant écrit en bas à gauche.
    const largeur = p.largeur > p.hauteur ? 640 : 360;
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `scale=${largeur}:-2:flags=lanczos`, "-q:v", "4", jpg]);
    images.push(jpg);
    console.log(`${format} ${s.toFixed(1)} s → ${jpg}`);
  }
  // Planche du format (images côte à côte, sur 8 colonnes au plus).
  const cols = Math.min(8, images.length);
  const lignes = Math.ceil(images.length / cols);
  const entrees = images.flatMap((f) => ["-i", f]);
  const filtre = `${images.map((_, i) => `[${i}:v]`).join("")}xstack=inputs=${images.length}:layout=${images.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, (_, j) => `w${j}`).join("+") : "0"}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, (_, j) => `h${j * cols}`).join("+") : "0"}`).join("|")}:fill=black`;
  if (images.length > 1) execFileSync("ffmpeg", ["-v", "error", "-y", ...entrees, "-filter_complex", filtre, "-q:v", "4", join(sortie, `planche-${format}.jpg`)]);
  void lignes;
}
rmSync(brut, { recursive: true, force: true });
console.log("Aperçus écrits dans", sortie);
