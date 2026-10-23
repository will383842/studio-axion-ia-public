/**
 * PREUVE VISUELLE DU STYLE « reference/3 » : le témoin (vidéo v-f1739d6a4f51, redécoupée au gabarit par parties), calé
 * sur un minutage réaliste, mis en page dans les quatre sorties et rendu pour de vrai (Remotion, Chromium sans
 * affichage) : un DÉFILEMENT par sortie (une image toutes les 2,5 s, comme celui d'avant, et la dernière image avant
 * le fondu), et, avec `--videos`, trois courts MP4 (0-6 s, une page de solution, la fin).
 *
 * Usage (depuis la racine du dépôt, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/reference-3/apercus.mts [dossier] [--formats vertical,portrait,carre,horizontal] [--pas 2.5] [--videos] [--images-seules] [--script-v3] [--ecriture-a-l-heure] [--gabarit-cadre]
 * `--script-v3` : le script Formation v3 (`exemples-v3/01-formation.md`) au lieu du témoin ; défilements nommés
 * `defilement-<sortie>-script-v3.jpg`. `--ecriture-a-l-heure` : le témoin réel du 15/10 (v-d3e2a726cf0c, voix rapide).
 * `--gabarit-cadre` : l'exemple validé par Will le 15/10 (gabarit cadré des scripts), sur une voix posée de 16,5
 * caractères par seconde ; dossier par défaut `docs/formats/apercus-reference-3/gabarit-cadre/`.
 * Aucun appel payant.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { caleeEcritureALHeure, caleeFormationV3, caleeGabaritCadre, caleeTemoin3 } from "./fiches";

const RACINE = process.cwd();
const args = process.argv.slice(2);
const val = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const formats = (val("--formats") ?? "vertical,portrait,carre,horizontal").split(",") as IdFormatSortie[];
const pas = Number(val("--pas") ?? 2.5);
const videos = args.includes("--videos");
const imagesSeules = args.includes("--images-seules");
const scriptV3 = args.includes("--script-v3");
const ecritureALHeure = args.includes("--ecriture-a-l-heure");
const gabaritCadre = args.includes("--gabarit-cadre");
const libres = args.filter((a, i) => !a.startsWith("--") && !["--formats", "--pas"].includes(args[i - 1]));
const dossier = resolve(libres[0] ?? join(RACINE, gabaritCadre ? "docs/formats/apercus-reference-3/gabarit-cadre" : "docs/formats/apercus-reference-3/apres"));
const policeTitres = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
interface CompositionChoisie {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, renderMedia, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
  renderMedia: (o: { composition: CompositionChoisie; serveUrl: string; outputLocation: string; codec: "h264"; inputProps: Record<string, unknown>; crf: number } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });
mkdirSync(dossier, { recursive: true });

const { fiche, mots, elements } = gabaritCadre ? caleeGabaritCadre() : ecritureALHeure ? caleeEcritureALHeure() : scriptV3 ? caleeFormationV3() : caleeTemoin3();
const temps3 = tempsReference3(fiche, mots);

function proprietes(format: IdFormatSortie): ProprietesTableauScene[] {
  const mise = mettreEnPage(fiche, format === "vertical" ? {} : { format });
  return proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: elements, stylo: fiche.stylo, mots, temps3 });
}

/** Image à l'instant `t` (ms) d'une sortie, en JPEG de 640 px de haut. */
async function image(props: ProprietesTableauScene[], t: number, fichier: string) {
  const p = props.find((x) => t >= x.scene.debutMs && t < x.scene.finMs) ?? props.at(-1)!;
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((t - p.scene.debutMs) / 1000) * p.fps)));
  const png = `${fichier}.png`;
  await renderStill({ composition, serveUrl, output: png, frame, inputProps, imageFormat: "png", ...reglages });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", "scale=-2:640:flags=lanczos", "-q:v", "3", fichier]);
  rmSync(png, { force: true });
}

/** Planche : les images dans l'ordre, titrées de leur instant, `parRangee` par rangée. */
function planche(images: { fichier: string; titre: string }[], sortie: string, parRangee: number) {
  const pre = images.map((x, i) => `[${i}:v]pad=iw+8:ih+40:4:36:color=0x444444,drawtext=fontfile=${policeTitres}:text='${x.titre}':x=6:y=8:fontsize=20:fontcolor=white[i${i}]`);
  const rangees: string[] = [];
  for (let de = 0; de < images.length; de += parRangee) {
    const nb = Math.min(parRangee, images.length - de);
    const manque = parRangee - nb;
    if (manque) pre.push(`[${de}:v]pad=iw+8:ih+40:4:36:color=0x222222,drawbox=c=0x222222:t=fill,split=${manque}${Array.from({ length: manque }, (_, k) => `[v${de}_${k}]`).join("")}`);
    rangees.push(`${Array.from({ length: nb }, (_, j) => `[i${de + j}]`).join("")}${Array.from({ length: manque }, (_, k) => `[v${de}_${k}]`).join("")}hstack=inputs=${parRangee}[r${de}]`);
  }
  const noms = rangees.map((r) => r.slice(r.lastIndexOf("[")));
  const filtre = [...pre, ...rangees].join(";") + (noms.length > 1 ? `;${noms.join("")}vstack=inputs=${noms.length}` : "");
  execFileSync("ffmpeg", ["-v", "error", "-y", ...images.flatMap((x) => ["-i", x.fichier]), "-filter_complex", noms.length > 1 ? filtre : filtre.replace(/\[r0\]$/, ""), "-q:v", "4", sortie]);
}

if (!videos || !imagesSeules)
  for (const format of formats) {
    const props = proprietes(format);
    const fin = props.at(-1)!.scene.finMs;
    const instants: number[] = [];
    for (let t = 0; t < fin - 700; t += pas * 1000) instants.push(Math.round(t));
    instants.push(fin - 700);
    const images: { fichier: string; titre: string }[] = [];
    for (const t of instants) {
      const fichier = join(dossier, `.${format}-${t}.jpg`);
      await image(props, t, fichier);
      images.push({ fichier, titre: `${(t / 1000).toFixed(1).replace(".", ",")} s${t === instants.at(-1) ? " (fin)" : ""}` });
    }
    const sortie = join(dossier, `defilement-${format}${scriptV3 ? "-script-v3" : ""}.jpg`);
    planche(images, sortie, format === "horizontal" ? 5 : format === "carre" ? 6 : 8);
    for (const x of images) rmSync(x.fichier, { force: true });
    console.log("Défilement :", sortie);
  }

if (videos) {
  const props = proprietes("vertical");
  const fin = props.at(-1)!.scene.finMs;
  const solution = props.find((p) => p.styleReference?.parties && p.page.elements.some((e) => e.gabarit?.sorte === "code"))!;
  const extraits = [
    { nom: "extrait-0-6s.mp4", de: 0, a: 6000 },
    { nom: "extrait-solution.mp4", de: solution.scene.debutMs - 400, a: solution.scene.finMs + 300 },
    { nom: "extrait-fin.mp4", de: fin - 13000, a: fin },
  ];
  for (const x of extraits) {
    const tmp = mkdtempSync(join(tmpdir(), "reference-3-"));
    const morceaux: string[] = [];
    for (const p of props) {
      if (p.scene.finMs <= x.de || p.scene.debutMs >= x.a) continue;
      const inputProps = p as unknown as Record<string, unknown>;
      const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
      const f = join(tmp, `${p.scene.id}.mp4`);
      await renderMedia({ composition, serveUrl, outputLocation: f, codec: "h264", inputProps, crf: 18, ...reglages });
      morceaux.push(f);
    }
    const debut = (x.de - (props.find((p) => p.scene.finMs > x.de)?.scene.debutMs ?? 0)) / 1000;
    writeFileSync(join(tmp, "liste.txt"), morceaux.map((f) => `file '${f}'`).join("\n"));
    const sortie = join(dossier, x.nom);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(tmp, "liste.txt"), "-ss", String(Math.max(0, debut)), "-t", String((x.a - x.de) / 1000), "-vf", "scale=540:-2", "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", sortie]);
    rmSync(tmp, { recursive: true, force: true });
    console.log("Vidéo :", sortie);
  }
}
