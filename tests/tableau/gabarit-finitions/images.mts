/**
 * VRAIES IMAGES du témoin réel (`temoins/gabarit-essai-reel-2026-10-14.json`) : ses deux sorties verticales (Reels,
 * TikTok et Shorts), calées sur leurs vraies voix, rendues pour de vrai (Remotion, Chromium sans affichage) : une image
 * toutes les 2 s, plus la dernière image (avant le fondu de fin), et une planche par sortie ; avec `--pages`, la page
 * finie (dernière image de la dernière scène de chaque page) à la place.
 *
 * Usage (depuis la racine du dépôt, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/gabarit-finitions/images.mts [dossier] [--pas 2] [--pages] [--garder]
 * Sans `--garder`, seules les planches restent (`planche-<sortie>.jpg`, `planche-pages-<sortie>.jpg`). Aucun appel payant.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { sortiesTemoin } from "./temoin";

const RACINE = process.cwd();
const args = process.argv.slice(2);
const iPas = args.indexOf("--pas");
const pas = iPas >= 0 ? Number(args[iPas + 1]) : 2;
const garder = args.includes("--garder");
const parPage = args.includes("--pages");
const libres = args.filter((a, i) => !a.startsWith("--") && (iPas < 0 || i !== iPas + 1));
const dossier = resolve(libres[0] ?? join(RACINE, "docs/formats/apercus-reference-2/finitions"));
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

for (const s of sortiesTemoin()) {
  const mise = mettreEnPage(s.fiche, s.options);
  const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: s.fiche.scenes as SceneCalee[], heures: s.elements, stylo: s.fiche.stylo, mots: s.mots });
  const fin = props.at(-1)!.scene.finMs;
  const instants: number[] = [];
  if (parPage) for (const p of mise.pages) instants.push(Math.max(...props.filter((x) => x.scene.page === p.page).map((x) => x.scene.finMs)) - (p === mise.pages.at(-1) ? 700 : 40));
  else {
    for (let t = 0; t < fin - 700; t += pas * 1000) instants.push(t);
    instants.push(fin - 700);
  }
  const images: { fichier: string; titre: string }[] = [];
  for (const t of instants) {
    const p = props.find((x) => t >= x.scene.debutMs && t < x.scene.finMs) ?? props.at(-1)!;
    const nom = parPage ? `page-${p.scene.page}` : String(Math.round(t / 100)).padStart(4, "0");
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
    const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((t - p.scene.debutMs) / 1000) * p.fps)));
    const png = join(dossier, `.${s.id}.png`);
    await renderStill({ composition, serveUrl, output: png, frame, inputProps, imageFormat: "png", ...reglages });
    const jpg = join(dossier, `${s.id}-${nom}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", "scale=-2:640:flags=lanczos", "-q:v", "3", jpg]);
    rmSync(png, { force: true });
    images.push({ fichier: jpg, titre: parPage ? `page ${p.scene.page} finie` : `${(t / 1000).toFixed(1).replace(".", ",")} s${t === instants.at(-1) ? " (fin)" : ""}` });
    console.log(jpg);
  }
  // Planche : les images dans l'ordre, titrées de leur instant, 8 par rangée.
  const parRangee = 8;
  const pre = images.map((x, i) => `[${i}:v]pad=iw+8:ih+40:4:36:color=0x444444,drawtext=fontfile=${police}:text='${x.titre}':x=6:y=8:fontsize=20:fontcolor=white[i${i}]`);
  const rangees: string[] = [];
  for (let de = 0; de < images.length; de += parRangee) {
    const nb = Math.min(parRangee, images.length - de);
    const manque = parRangee - nb;
    if (manque) pre.push(`[${de}:v]pad=iw+8:ih+40:4:36:color=0x222222,drawbox=c=0x222222:t=fill,split=${manque}${Array.from({ length: manque }, (_, k) => `[v${de}_${k}]`).join("")}`);
    rangees.push(`${Array.from({ length: nb }, (_, j) => `[i${de + j}]`).join("")}${Array.from({ length: manque }, (_, k) => `[v${de}_${k}]`).join("")}hstack=inputs=${parRangee}[r${de}]`);
  }
  const noms = rangees.map((r) => r.slice(r.lastIndexOf("[")));
  const filtre = [...pre, ...rangees].join(";") + (noms.length > 1 ? `;${noms.join("")}vstack=inputs=${noms.length}` : "");
  const sortie = join(dossier, `planche-${parPage ? "pages-" : ""}${s.id}.jpg`);
  execFileSync("ffmpeg", ["-v", "error", "-y", ...images.flatMap((x) => ["-i", x.fichier]), "-filter_complex", noms.length > 1 ? filtre : filtre.replace(/\[r0\]$/, ""), "-q:v", "4", sortie]);
  if (!garder) for (const x of images) rmSync(x.fichier, { force: true });
  console.log("Planche :", sortie);
}
