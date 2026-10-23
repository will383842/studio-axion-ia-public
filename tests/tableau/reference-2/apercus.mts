/**
 * PLANCHES DU STYLE « reference/2 » (gabarit de page clair) : les quatre fiches réelles réécrites au gabarit et la
 * fiche « réponses types » (7 pages), calées sur un minutage
 * régulier, mises en page et rendues pour de vrai (Remotion, Chromium sans affichage) : une image par PAGE, la page
 * finie (dernière image de sa dernière scène), gardée, et une planche par fiche et par format.
 *
 * Usage (depuis la racine du dépôt, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/reference-2/apercus.mts [dossier] [--formats vertical,portrait] [fiche…]
 * Aucun appel payant.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { FICHES_REFERENCE_2, caleeReguliere, ficheReference2 } from "./fiches";

const RACINE = process.cwd();
const args = process.argv.slice(2);
const iFormats = args.indexOf("--formats");
const formats = (iFormats >= 0 ? args[iFormats + 1] : "vertical").split(",") as IdFormatSortie[];
const libres = args.filter((a, i) => !a.startsWith("--") && (iFormats < 0 || i !== iFormats + 1));
const dossier = resolve(libres[0] ?? join(RACINE, "docs/formats/apercus-reference-2"));
const voulues = libres.slice(1);
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

const aRendre = FICHES_REFERENCE_2.map((nom) => ({ nom: nom as string, fiche: () => ficheReference2(nom) }));
for (const reelle of aRendre) {
  if (voulues.length && !voulues.includes(reelle.nom)) continue;
  const { fiche, mots, elements } = caleeReguliere(reelle.fiche(), reelle.nom);
  for (const format of formats) {
    const prefixe = `${reelle.nom}-${format}`;
    const mise = mettreEnPage(fiche, format === "vertical" ? {} : { format });
    const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: elements, stylo: fiche.stylo, mots });
    const images: string[] = [];
    for (const page of mise.pages) {
      const p = props.filter((x) => x.scene.page === page.page).at(-1)!;
      const inputProps = p as unknown as Record<string, unknown>;
      const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
      // Page finie : la dernière image de sa dernière scène (avant le fondu de la fin de la vidéo).
      const fin = p.scene.finMs - (p.styleReference?.derniere ? 700 : 40);
      const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((fin - p.scene.debutMs) / 1000) * p.fps)));
      const png = join(dossier, `.${prefixe}.png`);
      await renderStill({ composition, serveUrl, output: png, frame, inputProps, imageFormat: "png", ...reglages });
      const jpg = join(dossier, `${prefixe}-page-${page.page}.jpg`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", `scale=-2:${format === "horizontal" ? 540 : 800}:flags=lanczos`, "-q:v", "3", jpg]);
      rmSync(png, { force: true });
      images.push(jpg);
      console.log(jpg);
    }
    // Planche : les pages dans l'ordre, titrées, sur une rangée (deux en horizontal).
    const parRangee = format === "horizontal" ? 3 : 4;
    const pre = images.map((f, i) => `[${i}:v]pad=iw+8:ih+44:4:40:color=0x444444,drawtext=fontfile=${police}:text='page ${i + 1}':x=6:y=10:fontsize=20:fontcolor=white[i${i}]`);
    const rangees: string[] = [];
    for (let de = 0; de < images.length; de += parRangee) {
      const nb = Math.min(parRangee, images.length - de);
      const manque = parRangee - nb;
      if (manque) pre.push(`[${de}:v]pad=iw+8:ih+44:4:40:color=0x222222,drawbox=c=0x222222:t=fill,split=${manque}${Array.from({ length: manque }, (_, k) => `[v${de}_${k}]`).join("")}`);
      rangees.push(`${Array.from({ length: nb }, (_, j) => `[i${de + j}]`).join("")}${Array.from({ length: manque }, (_, k) => `[v${de}_${k}]`).join("")}hstack=inputs=${parRangee}[r${de}]`);
    }
    const noms = rangees.map((r) => r.slice(r.lastIndexOf("[")));
    const filtre = [...pre, ...rangees].join(";") + (noms.length > 1 ? `;${noms.join("")}vstack=inputs=${noms.length}` : "");
    const sortie = join(dossier, `planche-${prefixe}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", ...images.flatMap((f) => ["-i", f]), "-filter_complex", noms.length > 1 ? filtre : filtre.replace(/\[r0\]$/, ""), "-q:v", "4", sortie]);
    console.log("Planche :", sortie);
  }
}
