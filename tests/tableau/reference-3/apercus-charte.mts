/**
 * PREUVE VISUELLE DE LA CHARTE AXION (style « reference/3 », direction A « Page ivoire », 15/10/2026) : le témoin réel
 * du 15/10 (`temoins/fabrication-arretee-ecriture-a-l-heure-2026-10-15.json`, voix rapide), mis en page dans les
 * quatre sorties, rendu pour de vrai (Remotion, Chromium sans affichage) AVEC les sous-titres : chaque image est la
 * scène `TableauScene` recouverte du calque `SousTitres` (le vrai calque de la composition complète, ses données
 * construites par `parametresComposition` depuis `commandeTableau`, comme à la fabrication).
 *
 * Sorties, dans `docs/formats/apercus-reference-3/charte-axion/` :
 *  - `defilement-<sortie>.jpg` : une image toutes les 2,5 s (et la dernière avant le fondu) ;
 *  - `extrait-10s.mp4` (avec `--video`) : 10 s du vertical (l'accroche, puis la première page de la douleur) ;
 *  - `controle-couleurs.json` : contrôle automatique des pixels de chaque image (aucun vert, bleu ni violet) ;
 *  - `gros-plan-haut-et-sous-titres.jpg` (avec `--gros-plan`) : le haut de la page (barre des chapitres) et la bande
 *    des sous-titres, en vraie taille, à 3 instants d'un même chapitre (début, milieu, fin).
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/reference-3/apercus-charte.mts [dossier] [--formats vertical,portrait,carre,horizontal] [--pas 2.5] [--video] [--gros-plan] [--sans-defilement] [--fiche gabarit-cadre]
 * Contrôle des couleurs : Python 3 avec Pillow et NumPy (`PYTHON`, défaut `python3`). Aucun appel payant.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fabriquerSousTitres } from "../../../src/briques/sous-titres";
import type { DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { centreBandePct, commandeTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU, reseauxDuRatio, sousTitresAxion } from "../../../src/moteurs/montage-tableau/fabriquer";
import { formatSortie, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { caleeEcritureALHeure, caleeGabaritCadre, caleeGabaritCadreVisuels } from "./fiches";

const RACINE = process.cwd();
const args = process.argv.slice(2);
const val = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const formats = (val("--formats") ?? "vertical,portrait,carre,horizontal").split(",") as IdFormatSortie[];
const pas = Number(val("--pas") ?? 2.5);
const video = args.includes("--video");
const grosPlan = args.includes("--gros-plan");
const defilement = !args.includes("--sans-defilement");
/** `--garder` : garde aussi les images pleine taille (sous-dossier `images/`), pour les regarder. */
const garder = args.includes("--garder");
const libres = args.filter((a, i) => !a.startsWith("--") && !["--formats", "--pas", "--fiche", "--pages-contraste", "--contraste-avant"].includes(args[i - 1]));
const dossier = resolve(libres[0] ?? join(RACINE, "docs/formats/apercus-reference-3/charte-axion"));
const policeTitres = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const python = process.env.PYTHON ?? "python3";

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

// `--fiche gabarit-cadre` : l'exemple validé du 15/10 (`temoins/fiche-gabarit-cadre-reference-3.json`, voix posée) ;
// les images portent alors le suffixe `-gabarit-cadre`.
const ficheDemandee = val("--fiche");
// `--fiche gabarit-cadre-visuels` : le même exemple AVEC les visuels de la banque et le peps (maquette PR #260).
const suffixe = ficheDemandee === "gabarit-cadre" || ficheDemandee === "gabarit-cadre-visuels" ? `-${ficheDemandee}` : "";
const { fiche, mots, elements } = ficheDemandee === "gabarit-cadre" ? caleeGabaritCadre() : ficheDemandee === "gabarit-cadre-visuels" ? caleeGabaritCadreVisuels() : caleeEcritureALHeure();
const temps3 = tempsReference3(fiche, mots);
const texteScript = fiche.scenes.map((s) => s.texteDit).join(" ");

/** Les scènes d'une sortie, et le calque de ses sous-titres (construit comme à la fabrication). */
function sortie(format: IdFormatSortie): { props: ProprietesTableauScene[]; calque: DonneesCalque | undefined; largeur: number; hauteur: number } {
  const mise = mettreEnPage(fiche, format === "vertical" ? {} : { format });
  const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: elements, stylo: fiche.stylo, mots, temps3 });
  const f = formatSortie(format);
  const dureeSec = props.at(-1)!.scene.finMs / 1000;
  const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
  const c = commandeTableau({ videoId: "apercu-charte", fiche, texteScript, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: f.ratio });
  const reseaux = format === "vertical" ? reseauxVerticaux() : reseauxDuRatio(f.ratio);
  const segments = sousTitresAxion(fabriquerSousTitres({ texte: texteScript, dureeSec, mots, prononciations: [], style: c.styles.sousTitres?.valeur, base: "karaoke", ratio: f.ratio, reseaux }));
  const params = parametresComposition(c, { ratio: f.ratio, plans: plansTableau(scenes), segments, dureeSec, mots, pistesDouble: { face: scenes[0].cle }, positionSousTitresPct: centreBandePct(mise), ...(format === "vertical" ? {} : { echelleSousTitres: (mise.reference?.largeur ?? mise.largeurPx) / 1080 }) }, RECETTE_COMPOSITION_TABLEAU);
  return { props, calque: params.texte.sousTitres, largeur: f.largeur, hauteur: f.hauteur };
}

/** Image de la sortie à l'instant `t` (ms), sous-titres compris, en PNG pleine taille. */
async function image(s: ReturnType<typeof sortie>, t: number, png: string) {
  const p = s.props.find((x) => t >= x.scene.debutMs && t < x.scene.finMs) ?? s.props.at(-1)!;
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((t - p.scene.debutMs) / 1000) * p.fps)));
  const fond = `${png}.scene.png`;
  await renderStill({ composition, serveUrl, output: fond, frame, inputProps, imageFormat: "png", ...reglages });
  if (!s.calque) {
    execFileSync("mv", [fond, png]);
    return;
  }
  const propsCalque = { donnees: s.calque, instantSec: t / 1000 } as unknown as Record<string, unknown>;
  const cc = await selectComposition({ serveUrl, id: "SousTitres", inputProps: propsCalque, ...reglages });
  const calque = `${png}.calque.png`;
  await renderStill({ composition: { ...cc, width: s.largeur, height: s.hauteur }, serveUrl, output: calque, frame: 0, inputProps: propsCalque, imageFormat: "png", ...reglages });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fond, "-i", calque, "-filter_complex", "[0:v][1:v]overlay=0:0", png]);
  rmSync(fond, { force: true });
  rmSync(calque, { force: true });
}

/** Planche : les images dans l'ordre, titrées de leur instant, `parRangee` par rangée. */
function planche(images: { fichier: string; titre: string }[], sortieJpg: string, parRangee: number) {
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
  execFileSync("ffmpeg", ["-v", "error", "-y", ...images.flatMap((x) => ["-i", x.fichier]), "-filter_complex", noms.length > 1 ? filtre : filtre.replace(/\[r0\]$/, ""), "-q:v", "4", sortieJpg]);
}

/**
 * Contrôle des pixels (comme la PR #241) : un pixel « coloré » (saturation ≥ 12 %, assez lumineux pour avoir une teinte)
 * dont la teinte sort de la famille brun-orange (5° à 60°) est un pixel vert, bleu ou violet. Rend le compte par image.
 */
function controlerCouleurs(fichiers: string[]): { fichier: string; colores: number; horsFamille: number; teinteMin: number; teinteMax: number }[] {
  const code = `
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
    colore = (s >= 0.12) & (mx >= 0.15) & (d >= 0.06)
    hors = colore & ((h > 60) & (h < 355))
    hs = h[colore]
    res.append({"fichier": f.split("/")[-1], "colores": int(colore.sum()), "horsFamille": int(hors.sum()), "teinteMin": float(round(hs.min(), 1)) if hs.size else 0, "teinteMax": float(round(hs.max(), 1)) if hs.size else 0})
print(json.dumps(res))
`;
  return JSON.parse(execFileSync(python, ["-c", code, ...fichiers], { maxBuffer: 1 << 26 }).toString()) as ReturnType<typeof controlerCouleurs>;
}

const controles: ReturnType<typeof controlerCouleurs> = [];
if (defilement)
  for (const format of formats) {
    const s = sortie(format);
    const fin = s.props.at(-1)!.scene.finMs;
    const instants: number[] = [];
    for (let t = 0; t < fin - 700; t += pas * 1000) instants.push(Math.round(t));
    instants.push(fin - 700);
    const tmp = mkdtempSync(join(tmpdir(), "charte-axion-"));
    const images: { fichier: string; titre: string }[] = [];
    const pngs: string[] = [];
    for (const t of instants) {
      const png = join(tmp, `${format}-${String(t).padStart(6, "0")}.png`);
      await image(s, t, png);
      pngs.push(png);
      const jpg = join(tmp, `${format}-${t}.jpg`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", "scale=-2:640:flags=lanczos", "-q:v", "3", jpg]);
      images.push({ fichier: jpg, titre: `${(t / 1000).toFixed(1).replace(".", ",")} s${t === instants.at(-1) ? " (fin)" : ""}` });
    }
    const sortieJpg = join(dossier, `defilement-${format}${suffixe}.jpg`);
    planche(images, sortieJpg, format === "horizontal" ? 5 : format === "carre" ? 6 : 8);
    const c = controlerCouleurs(pngs).map((x) => ({ ...x, fichier: `${format} · ${x.fichier}` }));
    controles.push(...c);
    console.log("Défilement :", sortieJpg, "· pixels hors famille brun-orange :", c.reduce((n, x) => n + x.horsFamille, 0));
    if (garder) {
      mkdirSync(join(dossier, "images"), { recursive: true });
      for (const png of pngs) execFileSync("cp", [png, join(dossier, "images")]);
    }
    rmSync(tmp, { recursive: true, force: true });
  }
if (controles.length) writeFileSync(join(dossier, `controle-couleurs${suffixe}.json`), `${JSON.stringify({ regle: "pixel coloré (saturation ≥ 12 %) hors des teintes 355°-60° = vert, bleu ou violet", teintesAutorisees: { "#E8A27F": "mot dit des sous-titres « Pastille Axion » (orange brûlé #B44F29 éclairci, lisible sur l'encre)" }, total: controles.reduce((n, x) => n + x.horsFamille, 0), images: controles }, null, 1)}\n`);

if (video) {
  // 10 s du vertical, images complètes (scène + calque), assemblées à 30 i/s.
  const s = sortie("vertical");
  const tmp = mkdtempSync(join(tmpdir(), "charte-axion-video-"));
  const de = 0;
  const fps = s.props[0].fps;
  const n = Math.round(10 * fps);
  for (let i = 0; i < n; i++) await image(s, de + (i * 1000) / fps, join(tmp, `i${String(i).padStart(4, "0")}.png`));
  const sortieMp4 = join(dossier, "extrait-10s.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(fps), "-i", join(tmp, "i%04d.png"), "-vf", "scale=540:-2", "-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", sortieMp4]);
  rmSync(tmp, { recursive: true, force: true });
  console.log("Vidéo :", sortieMp4);
}

if (grosPlan) {
  // Le chapitre le plus long du vertical : 3 instants (début, milieu, fin), chacun posé au milieu d'un mot dit.
  const s = sortie("vertical");
  const r = s.props[0].styleReference!;
  const ch = [...(r.parties ?? [])].sort((a, b) => b.finMs - b.debutMs - (a.finMs - a.debutMs))[0];
  const surMot = (ms: number) => {
    const m = mots.find((x) => x.finSec * 1000 >= ms) ?? mots.at(-1)!;
    return Math.round(((m.debutSec + m.finSec) / 2) * 1000);
  };
  const instants = [surMot(ch.debutMs + 900), surMot((ch.debutMs + ch.finMs) / 2), surMot(ch.finMs - 900)];
  const n = r.nomsChapitres!;
  const hautPx = Math.round(n.y + n.hauteur + 40 * r.k);
  const bande = mettreEnPage(fiche, {}).bandeSousTitres.px;
  const yb = Math.max(0, bande.y - 30);
  const hb = Math.min(s.hauteur - yb, bande.hauteur + 60);
  const tmp = mkdtempSync(join(tmpdir(), "charte-axion-gros-"));
  const images: { fichier: string; titre: string }[] = [];
  for (const [i, t] of instants.entries()) {
    const png = join(tmp, `g${i}.png`);
    await image(s, t, png);
    const jpg = join(tmp, `g${i}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-filter_complex", `[0:v]crop=iw:${hautPx}:0:0[h];[0:v]crop=iw:${hb}:0:${yb}[b];[h]pad=iw:ih+24:0:0:color=0x444444[h2];[h2][b]vstack=inputs=2`, "-q:v", "2", jpg]);
    images.push({ fichier: jpg, titre: `${["Début", "Milieu", "Fin"][i]} du chapitre « ${ch.nom.replace("'", "’")} » · ${(t / 1000).toFixed(2).replace(".", ",")} s` });
  }
  const sortieJpg = join(dossier, "gros-plan-haut-et-sous-titres.jpg");
  planche(images, sortieJpg, 3);
  rmSync(tmp, { recursive: true, force: true });
  console.log("Gros plan :", sortieJpg, instants);
}

// `--pages-contraste <dossier>` : les trois pages de l'avant / après du contraste (accroche, étape, exemple), en vertical,
// pleine taille, la page finie (juste avant la page suivante). `--contraste-avant <dossier>` : assemble
// `contraste-avant-apres.jpg` (pour chaque page, l'avant à gauche, l'après à droite) depuis un dossier rendu AVANT.
const PAGES_CONTRASTE = [
  { nom: "accroche", scene: "s01", titre: "Accroche" },
  { nom: "etape", scene: "s05", titre: "Étape" },
  { nom: "exemple", scene: "s11", titre: "Exemple" },
] as const;
const dossierPages = val("--pages-contraste");
const dossierAvant = val("--contraste-avant");
if (dossierPages || dossierAvant) {
  const s = sortie("vertical");
  const apres = dossierPages ? resolve(dossierPages) : mkdtempSync(join(tmpdir(), "charte-axion-contraste-"));
  mkdirSync(apres, { recursive: true });
  for (const p of PAGES_CONTRASTE) {
    const sc = s.props.find((x) => x.scene.id === p.scene)!;
    await image(s, sc.scene.finMs - 300, join(apres, `${p.nom}.png`));
  }
  if (dossierAvant) {
    const tmp = mkdtempSync(join(tmpdir(), "charte-axion-av-"));
    const images = PAGES_CONTRASTE.flatMap((p) =>
      (["avant", "apres"] as const).map((q) => {
        const jpg = join(tmp, `${p.nom}-${q}.jpg`);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(q === "avant" ? resolve(dossierAvant) : apres, `${p.nom}.png`), "-vf", "scale=-2:960:flags=lanczos", "-q:v", "2", jpg]);
        return { fichier: jpg, titre: `${p.titre} · ${q === "avant" ? "AVANT" : "APRÈS"}` };
      }),
    );
    const sortieJpg = join(dossier, "contraste-avant-apres.jpg");
    planche(images, sortieJpg, 2);
    const c = controlerCouleurs(PAGES_CONTRASTE.map((p) => join(apres, `${p.nom}.png`)));
    console.log("Avant / après :", sortieJpg, "· pixels hors famille brun-orange (après) :", c.reduce((n, x) => n + x.horsFamille, 0));
    rmSync(tmp, { recursive: true, force: true });
  }
}

// `--contrastes` : `contrastes.json`, chaque couleur dessinée, son fond et son rapport (WCAG 2), avant et après.
if (args.includes("--contrastes")) {
  const { mesuresContraste3, rapportContraste, AVANT_CONTRASTE_3, SEUILS_CONTRASTE } = await import("./contrastes");
  const mesures = mesuresContraste3().map((m) => {
    const av = AVANT_CONTRASTE_3[m.nom as keyof typeof AVANT_CONTRASTE_3];
    const avFond = AVANT_CONTRASTE_3[m.nomFond as keyof typeof AVANT_CONTRASTE_3] ?? m.fond;
    const avant = (av ?? m.couleur).startsWith("#") && avFond.startsWith("#") ? Math.round(rapportContraste(av ?? m.couleur, avFond) * 100) / 100 : null;
    return { ...m, ...(av || avFond !== m.fond ? { avant: { couleur: av ?? m.couleur, fond: avFond, rapport: avant } } : {}), ok: m.rapport >= m.seuil };
  });
  const sortieJson = join(dossier, "contrastes.json");
  writeFileSync(sortieJson, `${JSON.stringify({ regle: `texte ≥ ${SEUILS_CONTRASTE.texte} pour 1 (WCAG AA), trait / icône / élément graphique porteur de sens ≥ ${SEUILS_CONTRASTE.graphique} pour 1 ; rapport WCAG 2`, toutOk: mesures.every((m) => m.ok), mesures }, null, 1)}\n`);
  console.log("Contrastes :", sortieJson, mesures.filter((m) => !m.ok).length, "sous le seuil");
}
