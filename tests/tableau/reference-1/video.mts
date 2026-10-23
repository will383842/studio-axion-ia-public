/**
 * QUELQUES SECONDES DE VRAIE ANIMATION du style « reference/1 » : les premières scènes d'une fiche réelle, calées sur un
 * minutage régulier (0,3 s par mot, aucune voix lue), rendues pour de vrai (Remotion) puis mises bout à bout (ffmpeg),
 * sans son. Usage : npx tsx tests/tableau/reference-1/video.mts [fichier.mp4] [fiche] [secondes]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { caleeReguliere, ficheReference, type NomFicheReelle } from "./fiches";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, "docs/formats/apercus-reference-1/animation-6s.mp4"));
const nom = (process.argv[3] ?? "relances") as NomFicheReelle;
const secondes = Number(process.argv[4] ?? 6);
const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderMedia, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<unknown>;
  renderMedia: (o: { composition: unknown; serveUrl: string; outputLocation: string; codec: "h264"; inputProps: Record<string, unknown>; crf: number } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });

const { fiche, mots, elements } = caleeReguliere(ficheReference(nom), nom);
const mise = mettreEnPage(fiche, {});
const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: elements, stylo: fiche.stylo, mots });
const dossier = mkdtempSync(join(tmpdir(), "reference-1-"));
const morceaux: string[] = [];
for (const p of props) {
  if (p.scene.debutMs >= secondes * 1000) break;
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const f = join(dossier, `${p.scene.id}.mp4`);
  await renderMedia({ composition, serveUrl, outputLocation: f, codec: "h264", inputProps, crf: 16, ...reglages });
  morceaux.push(f);
  console.log(f);
}
writeFileSync(join(dossier, "liste.txt"), morceaux.map((f) => `file '${f}'`).join("\n"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dossier, "liste.txt"), "-t", String(secondes), "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", sortie]);
rmSync(dossier, { recursive: true, force: true });
console.log("Vidéo :", sortie);
