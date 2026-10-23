/**
 * APERÇUS RÉELS des sous-titres CENTRAUX du tableau (17/10/2026) : trois styles de la Bibliothèque (Pastille Axion,
 * Karaoké crème, Axion pop = Impact) × les trois fonds (tableau blanc, ardoise, paperboard) × 9:16 et 4:5. Tout est rendu
 * par le moteur (Remotion, Chromium sans affichage : `TableauScene` pour la page, `SousTitres` pour le calque), avec la
 * même chaîne que la fabrication : `commandeTableau` (style choisi, bande réservée) → `fabriquerSousTitres` →
 * `groupesTableau` → `parametresComposition`. Rien n'est redessiné à la main.
 *
 * Sorties, dans `docs/formats/apercus-sous-titres-centraux/` : `<style>-<fond>-<format>.jpg` (un instant où un groupe est
 * affiché, au milieu d'une page de contenu), `planche-<format>.jpg` (styles en lignes, fonds en colonnes), `resume.json`
 * (gabarit retenu, contraste, alerte éventuelle, pixels hors charte).
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) : npx tsx tests/tableau/sous-titres-centraux/apercus.mts
 * Aucun appel payant (aucune voix : minutage réaliste).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fabriquerSousTitres } from "../../../src/briques/sous-titres";
import type { DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { STYLES_TABLEAU, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import type { StyleResolu, ValeurStyleSousTitres } from "../../../src/domaine/types";
import { creerDonneesDemo } from "../../../src/donnees/memoire/demo";
import { centreBandePct, commandeTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU, reseauxDuRatio } from "../../../src/moteurs/montage-tableau/fabriquer";
import { formatSortie, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { bandeDe, groupesTableau, sousTitresTableau } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { calee, ficheMaquettes } from "../trois-styles/fiches";

const RACINE = process.cwd();
const dossier = resolve(join(RACINE, "docs/formats/apercus-sous-titres-centraux"));
const python = process.env.PYTHON ?? "python3";
const POLICES = join(RACINE, "studio-rendu/compositions/commune/polices");
const FORMATS: IdFormatSortie[] = ["vertical", "portrait"];
const IDS_STYLES = ["st-avocat-v1", "st-karaoke", "st-axion-pop"];
const elements = creerDonneesDemo(0).elements;
const STYLES: StyleResolu<ValeurStyleSousTitres>[] = IDS_STYLES.map((id) => {
  const e = elements.find((x) => x.id === id)!;
  return { id: e.id, nom: e.nom, valeur: e.valeur as ValeurStyleSousTitres };
});

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

interface Prepa {
  props: ProprietesTableauScene[];
  calque: DonneesCalque;
  largeur: number;
  hauteur: number;
  resume: Record<string, unknown>;
}

/** Fiche calée et mise en page pour un fond et un format ; le calque des sous-titres du style choisi (chaîne de production). */
function preparer(fond: StyleTableau, format: IdFormatSortie, choisi: StyleResolu<ValeurStyleSousTitres>): Prepa {
  const c = calee({ ...ficheMaquettes(), styleTableau: fond });
  if (c.refus.length) throw new Error(`calage refusé (${fond}) : ${c.refus.join(" | ")}`);
  const fiche = c.fiche;
  const mise = mettreEnPage(fiche, format === "vertical" ? {} : { format });
  const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: c.elements, stylo: fiche.stylo, mots: c.mots, temps3: tempsReference3(fiche, c.mots) });
  const fs = formatSortie(format);
  const verticale = format === "vertical";
  const reseaux = verticale ? reseauxVerticaux() : reseauxDuRatio(fs.ratio);
  const texteScript = fiche.scenes.map((s) => s.texteDit).join(" ");
  const dureeSec = props.at(-1)!.scene.finMs / 1000;
  const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
  const bande = bandeDe(mise, fs.ratio, verticale, reseaux);
  const st = sousTitresTableau({ fiche, choisi, positionPct: centreBandePct(mise), bande });
  const cmd = commandeTableau({ videoId: "apercu-sous-titres-centraux", fiche, texteScript, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: fs.ratio, styleSousTitres: choisi, bandeSousTitres: bande });
  const segments = groupesTableau(fabriquerSousTitres({ texte: texteScript, dureeSec, mots: c.mots, prononciations: [], style: cmd.styles.sousTitres?.valeur, base: cmd.sousTitres?.base, ratio: fs.ratio, reseaux }), st.gabarit);
  const echelle = verticale ? {} : { echelleSousTitres: (mise.reference?.largeur ?? mise.largeurPx) / 1080 };
  const params = parametresComposition(cmd, { ratio: fs.ratio, plans: plansTableau(scenes), segments, dureeSec, mots: c.mots, pistesDouble: { face: scenes[0].cle }, positionSousTitresPct: centreBandePct(mise), ...echelle }, RECETTE_COMPOSITION_TABLEAU);
  return {
    props,
    calque: params.texte.sousTitres!,
    largeur: fs.largeur,
    hauteur: fs.hauteur,
    resume: { style: choisi.nom, fond, format, posé: cmd.styles.sousTitres?.nom, gabarit: st.gabarit, contraste: +st.contraste.toFixed(2), ...(st.alerte ? { alerte: st.alerte.message } : {}), bande: { y0: Math.floor((mise.bandeSousTitres.px.y / mise.hauteurPx) * fs.hauteur), y1: Math.ceil(((mise.bandeSousTitres.px.y + mise.bandeSousTitres.px.hauteur) / mise.hauteurPx) * fs.hauteur) }, alertesComposition: params.alertes.map((a) => a.message) },
  };
}

/** Un instant d'une page de contenu (la 2e) où un groupe est affiché, son dernier mot dit. */
function instant(pr: Prepa): number {
  const p2 = pr.props.filter((p) => p.page.page === 2);
  const de = p2[0].scene.debutMs / 1000;
  const a = p2.at(-1)!.scene.finMs / 1000;
  const cible = de + (a - de) * 0.7;
  const s = pr.calque.segments.find((x) => x.finSec > cible && x.debutSec >= de) ?? pr.calque.segments.find((x) => x.debutSec >= de)!;
  return Math.round(Math.min(s.finSec - 0.02, Math.max(s.debutSec + 0.3, s.mots.at(-1)!.debutSec + 0.05)) * 1000);
}

/** Page à l'instant t, puis le calque des sous-titres posé dessus. */
async function image(pr: Prepa, t: number, png: string): Promise<void> {
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

// Pixels hors charte (vert, bleu, violet : teinte 70°-290°, saturée, visible) dans la BANDE des sous-titres, sur le PNG.
const codePixels = `
import sys, json
import numpy as np
from PIL import Image
f, y0, y1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
a = np.asarray(Image.open(f).convert("RGB")).astype(np.float32)[y0:y1] / 255
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
print(int(((h > 70) & (h < 290) & (s > 0.12) & (mx > 0.12)).sum()))
`;

const resume: Record<string, unknown>[] = [];
for (const format of FORMATS) {
  const cellules: { style: string; fond: string; fichier: string }[] = [];
  for (const choisi of STYLES)
    for (const fond of STYLES_TABLEAU) {
      const pr = preparer(fond, format, choisi);
      const t = instant(pr);
      const png = join(dossier, `${choisi.id.replace(/^st-/, "")}-${fond}-${format}.png`);
      await image(pr, t, png);
      const b = pr.resume.bande as { y0: number; y1: number };
      const hors = Number(execFileSync(python, ["-c", codePixels, png, String(b.y0), String(b.y1)]).toString().trim());
      const jpg = png.replace(/\.png$/, ".jpg");
      execFileSync(python, ["-c", "import sys, os\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=88, subsampling=0)\nos.remove(sys.argv[1])", png, jpg]);
      cellules.push({ style: choisi.nom, fond, fichier: jpg });
      resume.push({ ...pr.resume, instantSec: t / 1000, pixelsHorsCharteBande: hors, image: jpg.split("/").at(-1) });
      console.log(format, choisi.nom, fond, pr.resume.gabarit, `${t} ms`, hors, "pixels hors charte");
    }
  const code = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
cellules, sortie, polices = json.loads(sys.argv[1]), sys.argv[2], sys.argv[3]
F = ImageFont.truetype(polices + "/Inter-SemiBold.ttf", 28)
styles, fonds = [], []
for c in cellules:
    if c["style"] not in styles: styles.append(c["style"])
    if c["fond"] not in fonds: fonds.append(c["fond"])
w = 420
im0 = Image.open(cellules[0]["fichier"])
h = round(w * im0.height / im0.width)
W, H = 230 + len(fonds) * (w + 16), 64 + len(styles) * (h + 16)
im = Image.new("RGB", (W, H), (24, 18, 13))
d = ImageDraw.Draw(im)
for j, n in enumerate(fonds): d.text((230 + j * (w + 16), 20), n, font=F, fill=(240, 232, 220))
for i, s in enumerate(styles):
    d.text((16, 64 + i * (h + 16) + h // 2), s, font=F, fill=(240, 232, 220))
    for c in cellules:
        if c["style"] != s: continue
        j = fonds.index(c["fond"])
        im.paste(Image.open(c["fichier"]).convert("RGB").resize((w, h), Image.LANCZOS), (230 + j * (w + 16), 64 + i * (h + 16)))
im.save(sortie, quality=88, subsampling=0)
`;
  execFileSync(python, ["-c", code, JSON.stringify(cellules), join(dossier, `planche-${format}.jpg`), POLICES]);
}
writeFileSync(join(dossier, "resume.json"), `${JSON.stringify(resume, null, 1)}\n`);
await instance.close({ silent: true });
console.log(resume.length, "images");
