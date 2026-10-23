/**
 * PLANCHES DE RENDU RÉEL DU MOTEUR pour les trois styles du tableau (16/10/2026) : tout est rendu PAR LE MOTEUR
 * (Remotion, Chromium sans affichage : `TableauScene` → `PageTableau`, la mise en page `mise-en-page-tableau.ts`, le
 * plan d'animation `animation-3.ts`), sous-titres « Pastille Axion » compris ; rien n'est redessiné à la main.
 *
 * Sorties, dans `docs/formats/apercus-trois-styles/` :
 *  - `<fiche>-<style>-<format>-<n>-<écran>.jpg` : accroche, étape, exemple, à retenir, appel, pour chaque style, en 9:16
 *    (`vertical`) et en 4:5 (`portrait`) ;
 *  - `planche-<fiche>-<format>.jpg` : les cinq écrans des trois styles côte à côte ;
 *  - `film-v667-<style>.mp4` (`--film`) : la vidéo COMPLÈTE du témoin v667 dans chaque style, 1080 × 1920, sous-titres
 *    compris (critique #291) ; `film-v667-<style>-p<n>-<partie>.jpg` : une planche par page (12 images régulières,
 *    `fps=12/<durée>,scale=270:-1,tile=6x2`), toutes les pages bout à bout couvrent tout le film ;
 *  - `fin-tiktok-v667-<style>.jpg` (`--tiktok`) : la fin TikTok et Shorts du témoin (une seule demande, sans bouton) ;
 *  - `mesures.json` (`--mesure`) : temps de rendu par image (Remotion `renderMedia`, une page à la fois).
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/trois-styles/apercus.mts [--fiche maquettes|v667] [--formats vertical,portrait] [--animation] [--mesure]
 * Aucun appel payant (aucune voix : minutage réaliste).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fabriquerSousTitres } from "../../../src/briques/sous-titres";
import type { DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { centreBandePct, commandeTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU, sousTitresAxion } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { formatSortie, sortiesDesReseaux, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { finDeLaSortie, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { calee, ficheMaquettes, ficheTemoinV667Corrige } from "./fiches";

const RACINE = process.cwd();
const args = process.argv.slice(2);
const val = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const dossier = resolve(val("--dossier") ?? join(RACINE, "docs/formats/apercus-trois-styles"));
const fiches = (val("--fiche") ?? "maquettes,v667").split(",").filter((x) => x && x !== "aucune");
const formats = (val("--formats") ?? "vertical,portrait").split(",") as IdFormatSortie[];
const styles = (val("--styles") ?? STYLES_TABLEAU.join(",")).split(",") as StyleTableau[];
const python = process.env.PYTHON ?? "python3";
const POLICES = join(RACINE, "studio-rendu/compositions/commune/polices");

// Contrôle des pixels de chaque image rendue, SANS PERTE (le PNG du moteur, avant la compression en JPEG des aperçus,
// dont les artefacts ne viennent pas du rendu) : aucun vert, bleu ni violet (teinte 70°-290°, saturée, visible).
const codePixels = `
import sys, json
import numpy as np
from PIL import Image
res = []
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert("RGB")).astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = (60 * ((g[rr] - b[rr]) / d[rr])) % 360
    h[gg] = 60 * ((b[gg] - r[gg]) / d[gg]) + 120
    h[bb] = 60 * ((r[bb] - g[bb]) / d[bb]) + 240
    hors = (h > 70) & (h < 290) & (s > 0.12) & (mx > 0.12)
    res.append({"image": f.split("/")[-1], "pixels_hors_charte": int(hors.sum())})
print(json.dumps(res))
`;
type ResultatPixels = { image: string; pixels_hors_charte: number };
const resultatsPixels: ResultatPixels[] = [];
function controlerPixels(fichiers: string[], nom: (f: string, i: number) => string) {
  const r = JSON.parse(execFileSync(python, ["-c", codePixels, ...fichiers], { maxBuffer: 1 << 26 }).toString()) as ResultatPixels[];
  resultatsPixels.push(...r.map((x, i) => ({ ...x, image: nom(fichiers[i], i) })));
  return r.reduce((n, x) => n + x.pixels_hors_charte, 0);
}

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
  renderMedia: (o: { composition: CompositionChoisie; serveUrl: string; outputLocation: string; codec: "h264"; inputProps: Record<string, unknown>; concurrency: number; muted?: boolean } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const base = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" as const } };
const instance = await R.openBrowser("chrome", base);
const reglages: Reglages = { ...base, puppeteerInstance: instance };
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });
mkdirSync(dossier, { recursive: true });

interface Prepa {
  props: ProprietesTableauScene[];
  mots: { mot: string; debutSec: number; finSec: number }[];
  calque?: { donnees: DonneesCalque; largeur: number; hauteur: number };
  fiche: FicheTableau;
}

/** La fiche calée, mise en page et ses propriétés de scène pour un style et un format ; le calque des sous-titres. */
function preparer(f0: FicheTableau, style: StyleTableau, format: IdFormatSortie, appel?: NonNullable<Parameters<typeof mettreEnPage>[1]>["appel"]): Prepa {
  const c = calee({ ...f0, styleTableau: style });
  if (c.refus.length) throw new Error(`calage refusé (${style}) : ${c.refus.join(" | ")}`);
  const fiche = c.fiche;
  const mise = mettreEnPage(fiche, { ...(format === "vertical" ? {} : { format }), ...(appel ? { appel } : {}) });
  const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: c.elements, stylo: fiche.stylo, mots: c.mots, temps3: tempsReference3(fiche, c.mots) });
  const fs = formatSortie(format);
  const texteScript = fiche.scenes.map((s) => s.texteDit).join(" ");
  const dureeSec = props.at(-1)!.scene.finMs / 1000;
  const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
  const cmd = commandeTableau({ videoId: "apercu-trois-styles", fiche, texteScript, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: fs.ratio });
  const segments = sousTitresAxion(fabriquerSousTitres({ texte: texteScript, dureeSec, mots: c.mots, prononciations: [], style: cmd.styles.sousTitres?.valeur, base: "karaoke", ratio: fs.ratio, reseaux: format === "vertical" ? reseauxVerticaux() : undefined }));
  const params = parametresComposition(cmd, { ratio: fs.ratio, plans: plansTableau(scenes), segments, dureeSec, mots: c.mots, pistesDouble: { face: scenes[0].cle }, positionSousTitresPct: centreBandePct(mise) }, RECETTE_COMPOSITION_TABLEAU);
  const donnees = params.texte.sousTitres;
  return { props, fiche, mots: c.mots, ...(donnees ? { calque: { donnees, largeur: fs.largeur, hauteur: fs.hauteur } } : {}) };
}

/** Une image à l'instant `t` (ms, horloge de la vidéo), avec le calque des sous-titres. */
async function image(pr: Prepa, t: number, png: string, avecSousTitres = true): Promise<number> {
  const p = pr.props.find((x) => t >= x.scene.debutMs && t < x.scene.finMs) ?? pr.props.at(-1)!;
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await R.selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((t - p.scene.debutMs) / 1000) * p.fps)));
  const fond = avecSousTitres && pr.calque ? `${png}.scene.png` : png;
  const debut = Date.now();
  await R.renderStill({ composition, serveUrl, output: fond, frame, inputProps, imageFormat: "png", ...reglages });
  const duree = Date.now() - debut;
  if (!(avecSousTitres && pr.calque)) return duree;
  const propsCalque = { donnees: pr.calque.donnees, instantSec: t / 1000 } as unknown as Record<string, unknown>;
  const cc = await R.selectComposition({ serveUrl, id: "SousTitres", inputProps: propsCalque, ...reglages });
  const c = `${png}.calque.png`;
  await R.renderStill({ composition: { ...cc, width: pr.calque.largeur, height: pr.calque.hauteur }, serveUrl, output: c, frame: 0, inputProps: propsCalque, imageFormat: "png", ...reglages });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fond, "-i", c, "-filter_complex", "[0:v][1:v]overlay=0:0", png]);
  rmSync(fond, { force: true });
  rmSync(c, { force: true });
  return duree;
}

/** Les cinq écrans d'une fiche (page, nom) : accroche, étape, exemple, à retenir, appel. */
function ecrans(pr: Prepa): { page: number; nom: string }[] {
  const pages = [...new Set(pr.props.map((p) => p.page.page))];
  const partie = (n: number) => pr.props.find((p) => p.page.page === n)!.styleReference!.tableau!.partie;
  const premiere = (role: string) => pages.find((n) => partie(n) === role);
  const etape = pages.find((n) => partie(n) === "solution" && pr.props.find((p) => p.page.page === n)!.page.elements.some((e) => e.gabarit?.sorte === "pastille"));
  return [
    { page: premiere("accroche")!, nom: "accroche" },
    { page: etape ?? premiere("solution")!, nom: "etape" },
    { page: premiere("exemple")!, nom: "exemple" },
    { page: premiere("retenir")!, nom: "a-retenir" },
    { page: premiere("appel")!, nom: "appel" },
  ].filter((x) => x.page !== undefined);
}

/**
 * Instant (ms) où la page est finie : la page écrite, l'outil sorti (critique #291, I1 : 0,6 à 0,8 s de page finie avant
 * l'arrivée de la suivante) ; l'appel, avant le fondu final.
 */
function instantFini(pr: Prepa, page: number): number {
  const ps = pr.props.filter((p) => p.page.page === page);
  const der = ps.at(-1)!;
  if (der.styleReference?.derniere) return der.styleReference.finVideoMs - 700;
  // Juste avant la coupe : la page est finie et l'outil déjà sorti (0,6 s avant), le dernier sous-titre de la page encore là.
  return Math.max(ps[0].scene.debutMs + 100, der.scene.finMs - 90);
}

const NOMS_FICHES: Record<string, () => FicheTableau> = { maquettes: () => ficheMaquettes(), v667: () => ficheTemoinV667Corrige() };
const sorties: string[] = [];
const mesures: Record<string, unknown> = {};
for (const nf of fiches) {
  for (const format of formats) {
    const cellules: { style: string; nom: string; fichier: string }[] = [];
    for (const style of styles) {
      const pr = preparer(NOMS_FICHES[nf](), style, format);
      for (const [i, e] of ecrans(pr).entries()) {
        const png = join(dossier, `${nf}-${style}-${format}-${i + 1}-${e.nom}.png`);
        const ms = await image(pr, instantFini(pr, e.page), png);
        cellules.push({ style, nom: e.nom, fichier: png });
        sorties.push(png);
        console.log(nf, style, format, e.nom, `${ms} ms`);
      }
    }
    // La planche : une rangée par style, les cinq écrans côte à côte.
    const code = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
cellules, sortie, polices = json.loads(sys.argv[1]), sys.argv[2], sys.argv[3]
F = ImageFont.truetype(polices + "/Inter-SemiBold.ttf", 30)
styles = []
for c in cellules:
    if c["style"] not in styles: styles.append(c["style"])
noms = []
for c in cellules:
    if c["nom"] not in noms: noms.append(c["nom"])
w = 360
im0 = Image.open(cellules[0]["fichier"])
h = round(w * im0.height / im0.width)
W, H = 200 + len(noms) * (w + 16), 70 + len(styles) * (h + 16)
im = Image.new("RGB", (W, H), (24, 18, 13))
d = ImageDraw.Draw(im)
for j, n in enumerate(noms): d.text((200 + j * (w + 16), 22), n, font=F, fill=(240, 232, 220))
for i, s in enumerate(styles):
    d.text((16, 70 + i * (h + 16) + h // 2), s, font=F, fill=(240, 232, 220))
    for c in cellules:
        if c["style"] != s: continue
        j = noms.index(c["nom"])
        im.paste(Image.open(c["fichier"]).convert("RGB").resize((w, h), Image.LANCZOS), (200 + j * (w + 16), 70 + i * (h + 16)))
im.save(sortie, quality=88)
`;
    const planche = join(dossier, `planche-${nf}-${format}.jpg`);
    execFileSync(python, ["-c", code, JSON.stringify(cellules), planche, POLICES]);
    console.log("planche", planche);
    controlerPixels(cellules.map((c) => c.fichier), (f) => basename(f).replace(/\.png$/, ".jpg"));
    // Chaque écran en JPEG sans sous-échantillonnage des couleurs (le PNG pèse 1,4 Mo l'écran).
    for (const c of cellules) {
      const jpg = c.fichier.replace(/\.png$/, ".jpg");
      execFileSync(python, ["-c", "import sys, os\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=88, subsampling=0)\nos.remove(sys.argv[1])", c.fichier, jpg]);
      sorties[sorties.indexOf(c.fichier)] = jpg;
    }
  }
}

if (args.includes("--animation")) {
  // Un passage animé par style (9:16, fiche des maquettes) : la fin de l'accroche, l'effacement, l'étape qui s'écrit.
  for (const style of styles) {
    const pr = preparer(ficheMaquettes(), style, "vertical");
    const p2 = pr.props.find((p) => p.page.page === 2)!;
    const t0 = Math.max(0, p2.scene.debutMs - 1500);
    const t1 = Math.min(pr.props.at(-1)!.scene.finMs, p2.scene.debutMs + 4500);
    const tmp = mkdtempSync(join(tmpdir(), `anim-${style}-`));
    const pas = 1000 / 15;
    let n = 0;
    for (let t = t0; t < t1; t += pas) await image(pr, t, join(tmp, `${String(n++).padStart(4, "0")}.png`));
    const mp4 = join(dossier, `animation-${style}.mp4`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "15", "-i", join(tmp, "%04d.png"), "-vf", "scale=540:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", mp4]);
    // Planche : 24 images régulières, 6 × 4.
    const jpg = join(dossier, `animation-${style}.jpg`);
    const total = n;
    // En RVB plein, puis un JPEG sans sous-échantillonnage des couleurs (le 4:2:0 verdit le bord des lettres orange).
    const png = join(tmp, "planche.png");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "15", "-i", join(tmp, "%04d.png"), "-vf", `select='not(mod(n\\,${Math.max(1, Math.floor(total / 24))}))',scale=270:-2,tile=6x4:padding=6:color=0x18120D,format=rgb24`, "-frames:v", "1", png]);
    execFileSync(python, ["-c", "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=90, subsampling=0)", png, jpg]);
    // Toutes les images du passage, en pleine taille et sans perte, comptées comme une seule (la planche).
    const images = Array.from({ length: total }, (_, i) => join(tmp, `${String(i).padStart(4, "0")}.png`));
    const hors = controlerPixels(images, () => "");
    resultatsPixels.splice(resultatsPixels.length - total, total, { image: basename(jpg), pixels_hors_charte: hors });
    rmSync(tmp, { recursive: true, force: true });
    sorties.push(mp4, jpg);
    console.log("animation", style, total, "images", hors, "pixels hors charte");
  }
}

if (args.includes("--film")) {
  // La vidéo complète du témoin v667, scène par scène (Remotion `renderMedia`, comme la fabrication), puis le calque des
  // sous-titres (ProRes 4444, transparent) posé dessus ; une planche par page.
  for (const style of styles) {
    const pr = preparer(ficheTemoinV667Corrige(), style, "vertical");
    const tmp = mkdtempSync(join(tmpdir(), `film-${style}-`));
    const morceaux: string[] = [];
    for (const [i, p] of pr.props.entries()) {
      const inputProps = p as unknown as Record<string, unknown>;
      const composition = await R.selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
      const sortie = join(tmp, `scene-${String(i).padStart(2, "0")}.mp4`);
      await R.renderMedia({ composition, serveUrl, outputLocation: sortie, codec: "h264", inputProps, concurrency: 4, muted: true, ...reglages });
      morceaux.push(sortie);
      console.log("film", style, p.scene.id, composition.durationInFrames, "images");
    }
    writeFileSync(join(tmp, "liste.txt"), morceaux.map((m) => `file '${m}'`).join("\n"));
    const brut = join(tmp, "brut.mp4");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(tmp, "liste.txt"), "-c", "copy", brut]);
    const calque = join(tmp, "calque.mov");
    const propsCalque = { donnees: pr.calque!.donnees } as unknown as Record<string, unknown>;
    const cc = await R.selectComposition({ serveUrl, id: "SousTitres", inputProps: propsCalque, ...reglages });
    await (R.renderMedia as unknown as (o: Record<string, unknown>) => Promise<unknown>)({ composition: { ...cc, width: pr.calque!.largeur, height: pr.calque!.hauteur }, serveUrl, outputLocation: calque, codec: "prores", proResProfile: "4444", imageFormat: "png", pixelFormat: "yuva444p10le", inputProps: propsCalque, concurrency: 4, muted: true, ...reglages });
    const mp4 = join(dossier, `film-v667-${style}.mp4`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", brut, "-i", calque, "-filter_complex", "[0:v][1:v]overlay=0:0:eof_action=pass,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-movflags", "+faststart", mp4]);
    sorties.push(mp4);
    // Une planche par page : 12 images régulières sur la durée de la page.
    const pages = [...new Set(pr.props.map((p) => p.page.page))];
    const dureeFilm = pr.props.at(-1)!.scene.finMs / 1000;
    const images: string[] = [];
    for (const n of pages) {
      const de = pr.props.find((p) => p.page.page === n)!.scene.debutMs / 1000;
      const suivante = pr.props.find((p) => p.page.page > n);
      const a = suivante ? suivante.scene.debutMs / 1000 : dureeFilm;
      const duree = +(a - de).toFixed(3);
      const partie = pr.props.find((p) => p.page.page === n)!.styleReference!.tableau!.partie;
      const png = join(tmp, `planche-${n}.png`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(de), "-t", String(duree), "-i", mp4, "-vf", `fps=12/${duree},scale=270:-1,tile=6x2,format=rgb24`, "-frames:v", "1", png]);
      const jpg = join(dossier, `film-v667-${style}-p${n}-${partie}.jpg`);
      execFileSync(python, ["-c", "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=90, subsampling=0)", png, jpg]);
      sorties.push(jpg);
      // Contrôle des couleurs : 2 images par seconde de la page, sans perte.
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(de), "-t", String(duree), "-i", mp4, "-vf", "fps=2", join(tmp, `c-${n}-%03d.png`)]);
      images.push(...Array.from({ length: Math.max(1, Math.floor(duree * 2)) }, (_, i) => join(tmp, `c-${n}-${String(i + 1).padStart(3, "0")}.png`)).filter((f) => existsSync(f)));
      console.log("planche", jpg, duree, "s");
    }
    const hors = controlerPixels(images, () => "");
    resultatsPixels.splice(resultatsPixels.length - images.length, images.length, { image: basename(mp4), pixels_hors_charte: hors });
    rmSync(tmp, { recursive: true, force: true });
    console.log("film", style, `${dureeFilm} s`, hors, "pixels hors charte");
  }
}

if (args.includes("--tiktok")) {
  // La fin TikTok et Shorts du témoin : la phrase de la fin et le site, aucun bouton (défaut (a) de v-667edcd8e3a8).
  const temoin = ficheTemoinV667Corrige();
  const sortiesV = sortiesDesReseaux(["verticaux"]);
  const choisirFin = choisirFinTableau({}, { sorties: sortiesV });
  const [, liens] = sortiesRelues(temoin, sortiesV, (id) => finDeLaSortie(id, choisirFin(temoin.appelId ?? null, id), temoin));
  for (const style of styles) {
    const pr = preparer(liens.fiche, style, "vertical", liens.appel ?? undefined);
    const derniere = pr.props.at(-1)!.page.page;
    const png = join(dossier, `fin-tiktok-v667-${style}.png`);
    await image(pr, instantFini(pr, derniere), png);
    controlerPixels([png], () => basename(png).replace(/\.png$/, ".jpg"));
    const jpg = png.replace(/\.png$/, ".jpg");
    execFileSync(python, ["-c", "import sys, os\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=88, subsampling=0)\nos.remove(sys.argv[1])", png, jpg]);
    sorties.push(jpg);
    console.log("fin TikTok", style, jpg);
  }
}

if (args.includes("--mesure")) {
  // Temps de rendu par image : une page entière rendue en vidéo par Remotion (comme la fabrication), une page du
  // navigateur à la fois (le serveur en a de 1 à 4).
  for (const style of styles) {
    const pr = preparer(ficheMaquettes(), style, "vertical");
    const p = pr.props.find((x) => x.page.page === 2)!;
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await R.selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
    const sortie = join(mkdtempSync(join(tmpdir(), "mesure-")), "page.mp4");
    const debut = Date.now();
    await R.renderMedia({ composition, serveUrl, outputLocation: sortie, codec: "h264", inputProps, concurrency: 1, muted: true, ...reglages });
    const ms = Date.now() - debut;
    mesures[style] = { images: composition.durationInFrames, msParImage: Math.round(ms / composition.durationInFrames), secondes: Math.round(ms / 100) / 10 };
    console.log("mesure", style, mesures[style]);
  }
  writeFileSync(join(dossier, "mesures.json"), `${JSON.stringify({ regle: "Remotion renderMedia, 1080 × 1920, concurrence 1 (une page du navigateur), Chromium sans affichage, rendu logiciel (swangle)", ...mesures }, null, 1)}\n`);
}
// Le compte de ce passage remplace celui des mêmes images ; les autres images (passages précédents) gardent le leur.
if (resultatsPixels.length) {
  const fichier = join(dossier, "controle-couleurs.json");
  const avant = existsSync(fichier) ? (JSON.parse(readFileSync(fichier, "utf8")) as { images: ResultatPixels[] }).images : [];
  const neufs = new Set(resultatsPixels.map((x) => x.image));
  const c = [...avant.filter((x) => !neufs.has(x.image)), ...resultatsPixels].sort((a, b) => a.image.localeCompare(b.image));
  writeFileSync(fichier, `${JSON.stringify({ regle: "pixel de teinte 70°-290° (vert, bleu, violet), saturation > 0,12 et valeur > 0,12 : hors charte ; compté sur l'image rendue sans perte (PNG), avant la compression des aperçus en JPEG", total: c.reduce((n, x) => n + x.pixels_hors_charte, 0), images: c }, null, 1)}\n`);
  console.log("pixels hors charte :", c.reduce((n, x) => n + x.pixels_hors_charte, 0));
}
await instance.close({ silent: true });
console.log(sorties.length, "fichiers");
