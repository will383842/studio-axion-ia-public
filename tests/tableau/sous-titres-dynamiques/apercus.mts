/**
 * APERÇUS RÉELS des sous-titres DYNAMIQUES du tableau (17/10/2026) sur la fiche réelle v-6616b3800357 : ardoise,
 * tableau blanc, paperboard × 9:16 et 4:5, quatre instants chacun (accroche en Impact, chiffre, phrase clé en Bandeau,
 * groupe courant au style de base), puis une vidéo test de 10 s (ardoise 9:16) et sa planche. Tout est rendu par le
 * moteur (Remotion, Chromium sans affichage : `TableauScene` pour la page, `SousTitres` pour le calque), par la chaîne de
 * la fabrication (`segmentsSousTitresTableau`, voir `chaine.ts`). Rien n'est redessiné à la main. Aucun appel payant.
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) : npx tsx tests/tableau/sous-titres-dynamiques/apercus.mts
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { SegmentSousTitres } from "../../../src/domaine/types";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { sortieV6616, type SortieSousTitres } from "./chaine";

const RACINE = process.cwd();
const dossier = resolve(join(RACINE, "docs/formats/apercus-sous-titres-dynamiques"));
const python = process.env.PYTHON ?? "python3";
const POLICES = join(RACINE, "studio-rendu/compositions/commune/polices");
const FORMATS: IdFormatSortie[] = ["vertical", "portrait"];
const VIDEO = { debutSec: 36.5, finSec: 46.5, fps: 12, planches: [2.3, 7.6] };

const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
interface CompositionChoisie {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" }; puppeteerInstance?: unknown };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const R = (await import(exiger.resolve("@remotion/renderer"))) as {
  openBrowser: (b: string, o: { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } }) => Promise<{ close: (o?: unknown) => Promise<void> }>;
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const base = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" as const } };
const instance = await R.openBrowser("chrome", base);
const reglages: Reglages = { ...base, puppeteerInstance: instance };
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });
mkdirSync(dossier, { recursive: true });

/** Page à l'instant t (ms), puis le calque des sous-titres posé dessus. */
async function image(pr: SortieSousTitres, t: number, png: string): Promise<void> {
  const p = pr.props.find((x) => t >= x.scene.debutMs && t < x.scene.finMs) ?? pr.props.at(-1)!;
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await R.selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((t - p.scene.debutMs) / 1000) * p.fps)));
  const fond = `${png}.scene.png`;
  await R.renderStill({ composition, serveUrl, output: fond, frame, inputProps, imageFormat: "png", ...reglages });
  const propsCalque = { donnees: pr.calque, instantSec: t / 1000 } as unknown as Record<string, unknown>;
  const cc = await R.selectComposition({ serveUrl, id: "SousTitres", inputProps: propsCalque, ...reglages });
  const c = `${png}.calque.png`;
  await R.renderStill({ composition: { ...cc, width: pr.largeur, height: pr.hauteur }, serveUrl, output: c, frame: 0, inputProps: propsCalque, imageFormat: "png", ...reglages });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fond, "-i", c, "-filter_complex", "[0:v][1:v]overlay=0:0", png]);
  rmSync(fond, { force: true });
  rmSync(c, { force: true });
}

// Pixels hors charte (vert, bleu, violet : teinte 70°-290°, saturée, visible) dans la BANDE ; et pixels de la couleur
// des accents (pastille orange, bandeau ivoire) AU-DESSUS de la bande (un accent qui monterait sur la page).
const codePixels = `
import sys
import numpy as np
from PIL import Image
f, y0, y1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
a = np.asarray(Image.open(f).convert("RGB")).astype(np.float32) / 255
b = a[y0:y1]
r, g, bl = b[..., 0], b[..., 1], b[..., 2]
mx, mn = b.max(-1), b.min(-1)
d = mx - mn
s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
h = np.zeros_like(mx)
m = d > 1e-6
rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
h[rr] = (60 * ((g[rr] - bl[rr]) / d[rr])) % 360
h[gg] = 60 * ((bl[gg] - r[gg]) / d[gg]) + 120
h[bb] = 60 * ((r[bb] - g[bb]) / d[bb]) + 240
print(int(((h > 70) & (h < 290) & (s > 0.12) & (mx > 0.12)).sum()))
`;

const versJpg = (png: string) => {
  const jpg = png.replace(/\.png$/, ".jpg");
  execFileSync(python, ["-c", "import sys, os\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=88, subsampling=0)\nos.remove(sys.argv[1])", png, jpg]);
  return jpg;
};
const fin = (s: SegmentSousTitres) => Math.round(Math.min(s.finSec - 0.02, Math.max(s.debutSec + 0.3, s.mots.at(-1)!.debutSec + 0.05)) * 1000);
const texte = (s: SegmentSousTitres) => s.mots.map((m) => m.mot).join(" ");

const resume: Record<string, unknown>[] = [];
for (const format of FORMATS) {
  const cellules: { ligne: string; fond: string; fichier: string }[] = [];
  for (const fond of STYLES_TABLEAU) {
    const pr = sortieV6616(fond, format);
    const segs = pr.calque.segments;
    const choisis: [string, SegmentSousTitres][] = [
      ["accroche", segs.find((s) => s.debutSec < 2 && s.style === "impact")!],
      ["chiffre", segs.find((s) => /\bdix\b/i.test(texte(s)) && s.mots.some((m) => m.enValeur))!],
      ["bandeau", segs.find((s) => s.style === "bandeau")!],
      ["base", segs.find((s) => s.style === "base" && s.debutSec > 20 && (s.importance ?? 0) < 3)!],
    ];
    const bande = { y0: Math.floor(pr.bande.y * (pr.hauteur / pr.calque.hauteur)), y1: Math.ceil((pr.bande.y + pr.bande.hauteur) * (pr.hauteur / pr.calque.hauteur)) };
    for (const [quoi, s] of choisis) {
      const t = fin(s);
      const png = join(dossier, `${quoi}-${fond}-${format}.png`);
      await image(pr, t, png);
      const hors = Number(execFileSync(python, ["-c", codePixels, png, String(bande.y0), String(bande.y1)]).toString().trim());
      const jpg = versJpg(png);
      cellules.push({ ligne: quoi, fond, fichier: jpg });
      resume.push({ quoi, fond, format, groupe: texte(s), style: s.style, importance: s.importance, inclinaison: s.inclinaison, souligne: s.souligne ?? null, instantSec: t / 1000, bande, pixelsHorsCharteBande: hors, image: jpg.split("/").at(-1) });
      console.log(format, fond, quoi, `« ${texte(s)} »`, s.style, s.importance, s.inclinaison, hors, "pixels hors charte");
    }
  }
  const code = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
cellules, sortie, polices = json.loads(sys.argv[1]), sys.argv[2], sys.argv[3]
F = ImageFont.truetype(polices + "/Inter-SemiBold.ttf", 28)
lignes, fonds = [], []
for c in cellules:
    if c["ligne"] not in lignes: lignes.append(c["ligne"])
    if c["fond"] not in fonds: fonds.append(c["fond"])
w = 420
im0 = Image.open(cellules[0]["fichier"])
h = round(w * im0.height / im0.width)
W, H = 200 + len(fonds) * (w + 16), 64 + len(lignes) * (h + 16)
im = Image.new("RGB", (W, H), (24, 18, 13))
d = ImageDraw.Draw(im)
for j, n in enumerate(fonds): d.text((200 + j * (w + 16), 20), n, font=F, fill=(240, 232, 220))
for i, s in enumerate(lignes):
    d.text((16, 64 + i * (h + 16) + h // 2), s, font=F, fill=(240, 232, 220))
    for c in cellules:
        if c["ligne"] != s: continue
        j = fonds.index(c["fond"])
        im.paste(Image.open(c["fichier"]).convert("RGB").resize((w, h), Image.LANCZOS), (200 + j * (w + 16), 64 + i * (h + 16)))
im.save(sortie, quality=88, subsampling=0)
`;
  execFileSync(python, ["-c", code, JSON.stringify(cellules), join(dossier, `planche-${format}.jpg`), POLICES]);
}

// Vidéo test : 10 s de l'ardoise en 9:16 (une phrase clé en Bandeau, un soulignement, un Impact, un chiffre), à 12 i/s.
const pr = sortieV6616("ardoise", "vertical");
const images = join(dossier, "video-images");
mkdirSync(images, { recursive: true });
const n = Math.round((VIDEO.finSec - VIDEO.debutSec) * VIDEO.fps);
for (let i = 0; i < n; i++) await image(pr, Math.round((VIDEO.debutSec + i / VIDEO.fps) * 1000), join(images, `${String(i).padStart(4, "0")}.png`));
const video = join(dossier, "video-test-ardoise-vertical.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(VIDEO.fps), "-i", join(images, "%04d.png"), "-vf", "scale=540:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", video]);
// Deux planches à 6 images/s : l'arrivée du Bandeau (≈ 2,6 s) et celle de l'Impact (≈ 8,2 s).
VIDEO.planches.forEach((de, i) => execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(de), "-i", video, "-vf", "fps=6,scale=270:-1,tile=6x2", "-frames:v", "1", join(dossier, `planche-mouvement-${i + 1}.jpg`)]));
rmSync(images, { recursive: true, force: true });
resume.push({ video: "video-test-ardoise-vertical.mp4", de: VIDEO.debutSec, a: VIDEO.finSec, groupes: pr.calque.segments.filter((s) => s.finSec > VIDEO.debutSec && s.debutSec < VIDEO.finSec).map((s) => ({ groupe: texte(s), style: s.style, importance: s.importance, inclinaison: s.inclinaison, souligne: s.souligne ?? null })) });
writeFileSync(join(dossier, "resume.json"), `${JSON.stringify(resume, null, 1)}\n`);
await instance.close({ silent: true });
console.log(resume.length, "entrées");
