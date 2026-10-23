/**
 * APERÇUS RÉELS des sous-titres du tableau AU DESIGN CENTRAL (17/10/2026, retour de Will sur #330) sur la fiche réelle
 * v-6616b3800357 : ardoise, tableau blanc, paperboard × 9:16 et 4:5 (images gardées), carré et 16:9 (mesurés), quatre
 * moments chacun (accroche en Impact, chiffre, phrase clé en Bandeau, texte courant) ; la RÉFÉRENCE : le même calque
 * rendu pour l'avocat (même marque, mêmes groupes, décor N1) ; une vidéo test de 10 s (ardoise 9:16 puis tableau blanc
 * 9:16) et sa planche de mouvement. Tout est rendu par le moteur (Remotion, Chromium sans affichage : `TableauScene`
 * pour la page, `SousTitres` pour le calque), par la chaîne de la fabrication (`chaine.ts`). Aucun appel payant.
 *
 * CONTRÔLES sur l'image rendue (pas sur les données) :
 * - contraste RÉEL : couleur du texte et du mot dit lue dans le calque rendu, contre le pixel le plus clair de ce qui est
 *   derrière lui (page + bande de fond, rendues sans le texte) dans le cadre du groupe ; Bandeau : texte sombre contre
 *   le rectangle crème rendu. Il faut ≥ 4,5:1 partout ;
 * - tout le texte reste dans la bande réservée (calque rendu sans la bande de fond : aucun pixel hors des lignes de la
 *   bande) ;
 * - 0 pixel vert, bleu ou violet dans la bande.
 *
 * Usage (depuis la racine, après l'installation de `studio-rendu`) : npx tsx tests/tableau/sous-titres-design-central/apercus.mts
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { elementDe, largeurElement, type DonneesCalque } from "../../../src/briques/sous-titres/scene";
import type { SegmentSousTitres } from "../../../src/domaine/types";
import { STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { RECETTE_COMPOSITION_AVOCAT } from "../../../src/moteurs/montage-avocat/recette-composition";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { sortieV6616, type SortieSousTitres } from "../sous-titres-dynamiques/chaine";
import { commandeAvocat, PLANS } from "./autres-formats";

const RACINE = process.cwd();
const dossier = resolve(join(RACINE, "docs/formats/apercus-sous-titres-design-central"));
const travail = join(dossier, "_travail");
const python = process.env.PYTHON ?? "python3";
const POLICES = join(RACINE, "studio-rendu/compositions/commune/polices");
const GARDES: IdFormatSortie[] = ["vertical", "portrait"];
const MESURES: IdFormatSortie[] = ["vertical", "portrait", "carre", "horizontal"];
const VIDEO = { fps: 12, morceaux: [{ fond: "ardoise" as StyleTableau, de: 36.5, a: 41.5 }, { fond: "tableau-blanc" as StyleTableau, de: 41.5, a: 46.5 }] };

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
mkdirSync(travail, { recursive: true });

/** La page (scène du tableau) à l'instant t (ms). */
async function page(pr: SortieSousTitres, t: number, png: string): Promise<void> {
  const p = pr.props.find((x) => t >= x.scene.debutMs && t < x.scene.finMs) ?? pr.props.at(-1)!;
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await R.selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((t - p.scene.debutMs) / 1000) * p.fps)));
  await R.renderStill({ composition, serveUrl, output: png, frame, inputProps, imageFormat: "png", ...reglages });
}

/** Le calque des sous-titres seul (fond transparent) à l'instant t (s). */
async function calque(donnees: DonneesCalque, tSec: number, largeur: number, hauteur: number, png: string): Promise<void> {
  const inputProps = { donnees, instantSec: tSec } as unknown as Record<string, unknown>;
  const cc = await R.selectComposition({ serveUrl, id: "SousTitres", inputProps, ...reglages });
  await R.renderStill({ composition: { ...cc, width: largeur, height: hauteur }, serveUrl, output: png, frame: 0, inputProps, imageFormat: "png", ...reglages });
}

const poser = (fond: string, dessus: string, sortie: string) => execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fond, "-i", dessus, "-filter_complex", "[0:v][1:v]overlay=0:0", sortie]);

/**
 * Mesures sur les images rendues. Entrées : calque avec texte seul (RGBA), page + bande de fond SANS texte, cadre du
 * groupe (x0 y0 x1 y1), Bandeau ou non, lignes de la bande (texte rendu sans bande de fond, pour « hors bande »).
 */
const codeMesure = `
import sys, json
import numpy as np
from PIL import Image
calque_txt, derriere, sans_bande, box, bandeau, y0, y1 = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4]), sys.argv[5] == "1", int(sys.argv[6]), int(sys.argv[7])
def lum(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
def cr(a, b):
    a, b = max(a, b), min(a, b)
    return (a + 0.05) / (b + 0.05)
def tsv(rgb):
    x = rgb / 255.0
    mx, mn = x.max(-1), x.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = (60 * ((g[rr] - b[rr]) / d[rr])) % 360
    h[gg] = 60 * ((b[gg] - r[gg]) / d[gg]) + 120
    h[bb] = 60 * ((r[bb] - g[bb]) / d[bb]) + 240
    return h, s, mx
A = np.asarray(Image.open(calque_txt).convert("RGBA")).astype(np.float32)
D = np.asarray(Image.open(derriere).convert("RGB")).astype(np.float32)
# Cadre RÉEL du groupe : les pixels visibles du texte rendu (contour compris), dans le cadre approché donné.
bx0, by0, bx1, by1 = [int(v) for v in box]
bx0, by0 = max(0, bx0), max(0, by0)
v_ = A[by0:by1, bx0:bx1, 3] > 8
ys, xs = np.where(v_)
x0, x1, y0b, y1b = bx0 + int(xs.min()), bx0 + int(xs.max()) + 1, by0 + int(ys.min()), by0 + int(ys.max()) + 1
res_cadre = [x0, y0b, x1, y1b]
a = A[y0b:y1b, x0:x1]
opaque = a[..., 3] >= 250
rgb = a[..., :3]
L = lum(rgb)
h, s, v = tsv(rgb)
res = {"cadre_reel": res_cadre}
if bandeau:
    creme = opaque & (L > 0.5) & (s < 0.2)
    sombre = opaque & (L < 0.05)
    if creme.sum() > 50 and sombre.sum() > 50:
        res["fond"] = np.median(rgb[creme], 0).tolist()
        res["texte"] = np.median(rgb[sombre], 0).tolist()
        res["contraste"] = cr(float(lum(np.array(res["texte"]))), float(lum(np.array(res["fond"]))))
else:
    creme = opaque & (L > 0.5) & (s < 0.2)
    orange = opaque & (s > 0.45) & (h > 5) & (h < 40) & (v > 0.6)
    d = D[y0b:y1b, x0:x1].reshape(-1, 3)
    ld = lum(d)
    clair = float(np.percentile(ld, 95))
    res["derriere_plus_clair"] = clair
    mins = []
    for nom, masque in (("creme", creme), ("orange", orange)):
        if masque.sum() > 40:
            c = np.median(rgb[masque], 0)
            res[nom] = c.tolist()
            mins.append(cr(float(lum(c)), clair))
    res["contraste"] = min(mins) if mins else None
# Texte hors de la bande : calque rendu sans la bande de fond, aucun pixel visible hors des lignes de la bande.
S = np.asarray(Image.open(sans_bande).convert("RGBA")).astype(np.float32)
vis = S[..., 3] > 8
lignes = np.where(vis.any(1))[0]
res["lignes_texte"] = [int(lignes.min()), int(lignes.max())] if len(lignes) else None
res["hors_bande"] = int(vis[:y0].sum() + vis[y1:].sum())
print(json.dumps(res))
`;

// Pixels hors charte (vert, bleu, violet : teinte 70°-290°, saturée, visible) dans la bande de l'image finale.
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

const versJpg = (png: string, jpg: string) => execFileSync(python, ["-c", "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=88, subsampling=0)", png, jpg]);
const fin = (s: SegmentSousTitres) => Math.round(Math.min(s.finSec - 0.02, Math.max(s.debutSec + 0.3, s.mots.at(-1)!.debutSec + 0.05)) * 1000);
const texte = (s: SegmentSousTitres) => s.mots.map((m) => m.mot).join(" ");

/** Les quatre moments de la fiche : accroche (Impact), chiffre dit, phrase clé (Bandeau), texte courant. */
function moments(segs: SegmentSousTitres[]): [string, SegmentSousTitres][] {
  return [
    ["accroche", segs.find((s) => s.debutSec < 2 && s.style === "impact")!],
    ["chiffre", segs.find((s) => /\bdix\b/i.test(texte(s)) && s.mots.some((m) => m.enValeur))!],
    ["phrase-cle", segs.find((s) => s.style === "bandeau")!],
    ["texte-courant", segs.find((s) => s.style === "base" && s.debutSec > 20 && (s.importance ?? 0) < 3)!],
  ];
}

/** Une image complète (page + bande + texte) et ses mesures ; `garder` : l'image va dans le dossier. */
async function imageMesuree(pr: SortieSousTitres, fond: string, format: string, quoi: string, s: SegmentSousTitres, garder: boolean) {
  const t = fin(s);
  const k = pr.hauteur / pr.calque.hauteur;
  const nom = `${quoi}-${fond}-${format}`;
  const f = (x: string) => join(travail, `${nom}.${x}.png`);
  await page(pr, t, f("page"));
  await calque(pr.calque, t / 1000, pr.largeur, pr.hauteur, f("calque"));
  await calque({ ...pr.calque, segments: [] }, t / 1000, pr.largeur, pr.hauteur, f("bande"));
  await calque({ ...pr.calque, bandeFond: undefined }, t / 1000, pr.largeur, pr.hauteur, f("texte"));
  poser(f("page"), f("bande"), f("derriere"));
  poser(f("page"), f("calque"), f("image"));
  const el = elementDe(pr.calque, s, t / 1000);
  const w = largeurElement(el) * el.echelle;
  // Cadre approché, large (le cadre réel est lu dans les pixels du texte rendu).
  const demi = (el.fond ? el.taillePx / 2 + el.fond.margeYPx : el.taillePx * 0.8 + el.gabarit.contourPx) * el.echelle + 20;
  const cx = pr.calque.largeur / 2;
  const box = [(cx - w / 2 - 10) * k, (el.yPx - demi) * k, (cx + w / 2 + 10) * k, (el.yPx + demi) * k].map(Math.round);
  const bande = { y0: Math.floor(pr.bande.y * k), y1: Math.ceil((pr.bande.y + pr.bande.hauteur) * k) };
  const m = JSON.parse(execFileSync(python, ["-c", codeMesure, f("texte"), f("derriere"), f("texte"), JSON.stringify(box), s.style === "bandeau" ? "1" : "0", String(bande.y0), String(bande.y1)]).toString());
  // Le Bandeau se mesure sur son rectangle (calque avec texte seul) ; les autres contre ce qui est derrière.
  const hors = Number(execFileSync(python, ["-c", codePixels, f("image"), String(bande.y0), String(bande.y1)]).toString().trim());
  const jpg = join(dossier, `${nom}.jpg`);
  if (garder) versJpg(f("image"), jpg);
  for (const x of ["page", "calque", "bande", "texte", "derriere"]) rmSync(f(x), { force: true });
  if (!garder) rmSync(f("image"), { force: true });
  return { quoi, fond, format, groupe: texte(s), style: s.style, importance: s.importance ?? 0, instantSec: t / 1000, bande, cadre: m.cadre_reel, contraste: m.contraste, mesure: m, horsBande: m.hors_bande, pixelsHorsCharteBande: hors, image: garder ? `${nom}.jpg` : null, png: garder ? f("image") : null };
}

const resume: Record<string, unknown>[] = [];
const echecs: string[] = [];
const cellules: Record<string, { ligne: string; colonne: string; fichier: string }[]> = {};
for (const format of MESURES) {
  for (const fond of STYLES_TABLEAU) {
    const pr = sortieV6616(fond, format);
    for (const [quoi, s] of moments(pr.calque.segments)) {
      const r = await imageMesuree(pr, fond, format, quoi, s, GARDES.includes(format));
      const { png, ...ligne } = r;
      resume.push(ligne);
      if (png) (cellules[format] ??= []).push({ ligne: quoi, colonne: fond, fichier: png });
      const ok = r.contraste !== null && r.contraste >= 4.5 && r.horsBande === 0 && r.pixelsHorsCharteBande === 0;
      if (!ok) echecs.push(`${format} ${fond} ${quoi}`);
      console.log(ok ? "ok " : "ÉCHEC", format, fond, quoi, `« ${r.groupe} »`, r.style, `contraste ${r.contraste?.toFixed(2)}:1`, `hors bande ${r.horsBande}`, `hors charte ${r.pixelsHorsCharteBande}`);
    }
  }
}

// RÉFÉRENCE : le MÊME calque (mêmes groupes, même marque) rendu pour l'AVOCAT, sur son décor N1 (Halo orange).
const ref = sortieV6616("tableau-blanc", "vertical");
const avocat = parametresComposition(commandeAvocat("avocat"), { ratio: "9:16", plans: PLANS as never, segments: ref.calque.segments, dureeSec: 60 }, RECETTE_COMPOSITION_AVOCAT).texte.sousTitres!;
const decorN1 = join(travail, "decor-n1.png");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(RACINE, "public/demo/decors/fond-1-halo-orange.jpg"), "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", decorN1]);
for (const [quoi, s] of moments(ref.calque.segments)) {
  const c = join(travail, `avocat-${quoi}.calque.png`);
  const png = join(travail, `avocat-${quoi}.png`);
  await calque(avocat, fin(s) / 1000, 1080, 1920, c);
  poser(decorN1, c, png);
  rmSync(c, { force: true });
  versJpg(png, join(dossier, `reference-avocat-${quoi}.jpg`));
  (cellules["comparaison"] ??= []).push({ ligne: quoi, colonne: "avocat (référence)", fichier: png });
  for (const fond of ["ardoise", "tableau-blanc"]) {
    const v = (cellules["vertical"] ?? []).find((x) => x.ligne === quoi && x.colonne === fond)!;
    cellules["comparaison"].push({ ligne: quoi, colonne: `tableau · ${fond}`, fichier: v.fichier });
  }
}
resume.push({ reference: "avocat", decor: "decor-n1-halo-orange", couleursAvocat: avocat.couleurs, couleursTableau: ref.calque.couleurs, identiques: JSON.stringify(avocat.couleurs) === JSON.stringify(ref.calque.couleurs) });

// Planches : 9:16, 4:5, et la comparaison avec l'avocat.
const codePlanche = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
cellules, sortie, polices = json.loads(sys.argv[1]), sys.argv[2], sys.argv[3]
F = ImageFont.truetype(polices + "/Inter-SemiBold.ttf", 28)
lignes, colonnes = [], []
for c in cellules:
    if c["ligne"] not in lignes: lignes.append(c["ligne"])
    if c["colonne"] not in colonnes: colonnes.append(c["colonne"])
w = 420
im0 = Image.open(cellules[0]["fichier"])
h = round(w * im0.height / im0.width)
W, H = 220 + len(colonnes) * (w + 16), 64 + len(lignes) * (h + 16)
im = Image.new("RGB", (W, H), (24, 18, 13))
d = ImageDraw.Draw(im)
for j, n in enumerate(colonnes): d.text((220 + j * (w + 16), 20), n, font=F, fill=(240, 232, 220))
for i, s in enumerate(lignes):
    d.text((16, 64 + i * (h + 16) + h // 2), s, font=F, fill=(240, 232, 220))
    for c in cellules:
        if c["ligne"] != s: continue
        j = colonnes.index(c["colonne"])
        im.paste(Image.open(c["fichier"]).convert("RGB").resize((w, h), Image.LANCZOS), (220 + j * (w + 16), 64 + i * (h + 16)))
im.save(sortie, quality=88, subsampling=0)
`;
for (const [nom, cs] of Object.entries(cellules)) execFileSync(python, ["-c", codePlanche, JSON.stringify(cs), join(dossier, `planche-${nom}.jpg`), POLICES]);

// Vidéo test : 5 s d'ardoise 9:16 puis 5 s de tableau blanc 9:16, à 12 i/s ; planche de mouvement à 6 i/s.
const images = join(travail, "video");
mkdirSync(images, { recursive: true });
let n = 0;
for (const m of VIDEO.morceaux) {
  const pr = sortieV6616(m.fond, "vertical");
  const nb = Math.round((m.a - m.de) * VIDEO.fps);
  for (let i = 0; i < nb; i++) {
    const t = Math.round((m.de + i / VIDEO.fps) * 1000);
    const p = join(images, `p${n}.png`);
    const c = join(images, `c${n}.png`);
    await page(pr, t, p);
    await calque(pr.calque, t / 1000, pr.largeur, pr.hauteur, c);
    poser(p, c, join(images, `${String(n).padStart(4, "0")}.png`));
    rmSync(p, { force: true });
    rmSync(c, { force: true });
    n++;
  }
}
const video = join(dossier, "video-test-ardoise-puis-tableau-blanc-vertical.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(VIDEO.fps), "-i", join(images, "%04d.png"), "-vf", "scale=540:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", video]);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", video, "-vf", "fps=6,scale=270:-1,tile=6x2", "-frames:v", "1", join(dossier, "planche-mouvement.jpg")]);
resume.push({ video: "video-test-ardoise-puis-tableau-blanc-vertical.mp4", morceaux: VIDEO.morceaux, images: n });
rmSync(travail, { recursive: true, force: true });
writeFileSync(join(dossier, "resume.json"), `${JSON.stringify(resume, null, 1)}\n`);
await instance.close({ silent: true });
console.log(resume.length, "entrées ;", echecs.length ? `ÉCHECS : ${echecs.join(" | ")}` : "tous les contrôles passent");
if (echecs.length) process.exitCode = 1;
