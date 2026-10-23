/**
 * PLANCHES DES QUATRE FICHES RÉELLES (`temoins/fiche-*-prod.json`), remises en forme comme en production
 * (`remettreEnForme` : mots forts, formes, rythme), calées sur un minutage régulier (0,3 s par mot, aucune voix lue)
 * puis rendues pour de vrai (Remotion, Chromium sans affichage) : la fin de CHAQUE écran, dans le format où la vidéo
 * a été fabriquée et en vertical : une planche par fiche et par format, chaque écran titré de son nom.
 *
 * Usage (depuis la racine du dépôt, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/dessin-4/apercus.mts <dossier> [fiche…]
 * Aucun appel payant.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { FICHES_REELLES, ficheReelleCalee } from "./fiches-reelles";

const RACINE = process.cwd();
const dossier = resolve(process.argv[2] ?? join(RACINE, "docs/formats/apercus-dessin-4/apres"));
const voulues = process.argv.slice(3);
const police = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

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
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });
mkdirSync(dossier, { recursive: true });

for (const reelle of FICHES_REELLES) {
  if (voulues.length && !voulues.includes(reelle.nom)) continue;
  const { fiche, mots, elements, appel } = ficheReelleCalee(reelle.nom);
  const formats: IdFormatSortie[] = reelle.format === "vertical" ? ["vertical"] : [reelle.format, "vertical"];
  for (const format of formats) {
    const prefixe = `${reelle.nom}-${format}`;
    for (const f of readdirSync(dossier)) if (f.startsWith(`${prefixe}-`)) rmSync(join(dossier, f));
    const mise = mettreEnPage(fiche, { appel, ...(format === "vertical" ? {} : { format }) });
    const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: elements, stylo: fiche.stylo, mots, fps: 30 });
    const images: string[] = [];
    for (const p of props) {
      const inputProps = p as unknown as Record<string, unknown>;
      const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
      const v = p.v2!;
      for (const [j, e] of v.ecrans.entries()) {
        if (e.sceneId !== p.scene.id) continue;
        // Fin de la dernière scène : avant le fondu de l'image (0,4 s).
        const fin = j + 1 < v.ecrans.length ? v.temps[v.ecrans[j + 1].id].debutMs - 60 : p.scene.finMs - 40 - (p === props.at(-1) ? 600 : 0);
        const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((fin - p.scene.debutMs) / 1000) * p.fps)));
        const png = join(dossier, `.${prefixe}.png`);
        await renderStill({ composition, serveUrl, output: png, frame, inputProps, imageFormat: "png", ...reglages });
        const jpg = join(dossier, `${prefixe}-${String(images.length).padStart(2, "0")}-${e.id.replace(/~/g, "-")}-${e.gabarit}.jpg`);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", "scale=-2:640:flags=lanczos", "-q:v", "3", jpg]);
        rmSync(png, { force: true });
        images.push(jpg);
        console.log(jpg);
      }
    }
    // Planche : les écrans dans l'ordre, titrés, par rangées de 6 (4 en horizontal).
    const parRangee = format === "horizontal" ? 3 : 6;
    const etiq = (f: string) => f.split("/").pop()!.replace(/\.jpg$/, "").replace(`${prefixe}-`, "").replace(/'/g, "");
    const pre = images.map((f, i) => `[${i}:v]pad=iw+8:ih+44:4:40:color=0x444444,drawtext=fontfile=${police}:text='${etiq(f)}':x=6:y=10:fontsize=18:fontcolor=white[i${i}]`);
    const rangees: string[] = [];
    for (let de = 0; de < images.length; de += parRangee) {
      const nb = Math.min(parRangee, images.length - de);
      const manque = parRangee - nb;
      const vides = Array.from({ length: manque }, (_, k) => `[i${de}]drawbox=c=0x222222:t=fill[v${de}_${k}]`);
      // Une image vide pour compléter la dernière rangée.
      if (manque) pre.push(`[${de}:v]pad=iw+8:ih+44:4:40:color=0x222222,drawbox=c=0x222222:t=fill,split=${manque}${Array.from({ length: manque }, (_, k) => `[v${de}_${k}]`).join("")}`);
      void vides;
      rangees.push(`${Array.from({ length: nb }, (_, j) => `[i${de + j}]`).join("")}${Array.from({ length: manque }, (_, k) => `[v${de}_${k}]`).join("")}hstack=inputs=${parRangee}[r${de}]`);
    }
    const noms = rangees.map((r) => r.slice(r.lastIndexOf("[")));
    const filtre = [...pre, ...rangees].join(";") + (noms.length > 1 ? `;${noms.join("")}vstack=inputs=${noms.length}` : "");
    const entrees = images.flatMap((f) => ["-i", f]);
    const sortie = join(dossier, `planche-${prefixe}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", ...entrees, "-filter_complex", noms.length > 1 ? filtre : filtre.replace(/\[r0\]$/, ""), "-q:v", "4", sortie]);
    // Seule la planche est gardée (chaque écran y est titré).
    for (const f of images) rmSync(f, { force: true });
    console.log("Planche :", sortie);
  }
}
