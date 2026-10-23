/**
 * PREUVES VISUELLES DES 16 VISUELS DESSINÉS ET DU PEPS (style « reference/3 », maquette validée par Will le 15/10/2026,
 * PR #260) : tout est rendu PAR LE MOTEUR (Remotion, Chromium sans affichage : `TableauScene` → `PageReference3`, le
 * plan d'animation `animation-3.ts`, la banque `visuels-3.ts`), rien n'est redessiné à la main.
 *
 * Sorties, dans `docs/formats/apercus-reference-3/visuels-peps/` :
 *  - `banque-16-visuels.png` (`--planche`) : la planche 4 × 4 des 16 visuels finis, chacun rendu seul sur une page
 *    ivoire (nom, usage, ce qui bouge) ; `banque-16-visuels-trace.jpg` : chaque visuel à 4 instants de son tracé ;
 *  - `comparaison.jpg` (`--comparaison <dossier de la maquette>`) : pour l'accroche, l'étape et l'exemple, la maquette
 *    de la PR #260 à gauche et la page rendue par le moteur à droite (fiche témoin AVEC visuels, voix posée) ;
 *  - `controle-couleurs-planche.json` : contrôle automatique des pixels (aucun vert, bleu ni violet).
 * Le défilement vertical et l'extrait de 10 s sont faits par `apercus-charte.mts --fiche gabarit-cadre-visuels`.
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/reference-3/apercus-visuels.mts [dossier] [--planche] [--comparaison <dossier maquette>]
 * Python 3 avec Pillow et NumPy (`PYTHON`, défaut `python3`). Aucun appel payant.
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
import { IDS_VISUELS_3, VISUELS_3, EXEMPLES_VISUELS_3, GRILLE_VISUEL_3, dessinVisuel3, encreVisuel3 } from "../../../src/briques/tableau-scene/reference/visuels-3";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { centreBandePct, commandeTableau, plansTableau, RECETTE_COMPOSITION_TABLEAU, sousTitresAxion } from "../../../src/moteurs/montage-tableau/fabriquer";
import { formatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { caleeGabaritCadreVisuels } from "./fiches";

const RACINE = process.cwd();
const args = process.argv.slice(2);
const val = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const libres = args.filter((a, i) => !a.startsWith("--") && !["--comparaison"].includes(args[i - 1]));
const dossier = resolve(libres[0] ?? join(RACINE, "docs/formats/apercus-reference-3/visuels-peps"));
const python = process.env.PYTHON ?? "python3";
const POLICES = join(RACINE, "studio-rendu/compositions/commune/polices");

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

/** Une image de la scène `p` à l'instant `t` (ms, horloge de la vidéo), avec le calque des sous-titres s'il y en a un. */
async function image(p: ProprietesTableauScene, t: number, png: string, calque?: { donnees: DonneesCalque; largeur: number; hauteur: number }) {
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((t - p.scene.debutMs) / 1000) * p.fps)));
  const fond = calque ? `${png}.scene.png` : png;
  await renderStill({ composition, serveUrl, output: fond, frame, inputProps, imageFormat: "png", ...reglages });
  if (!calque) return;
  const propsCalque = { donnees: calque.donnees, instantSec: t / 1000 } as unknown as Record<string, unknown>;
  const cc = await selectComposition({ serveUrl, id: "SousTitres", inputProps: propsCalque, ...reglages });
  const c = `${png}.calque.png`;
  await renderStill({ composition: { ...cc, width: calque.largeur, height: calque.hauteur }, serveUrl, output: c, frame: 0, inputProps: propsCalque, imageFormat: "png", ...reglages });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fond, "-i", c, "-filter_complex", "[0:v][1:v]overlay=0:0", png]);
  rmSync(fond, { force: true });
  rmSync(c, { force: true });
}

/** Contrôle des pixels (comme `apercus-charte.mts`) : un pixel coloré hors des teintes 355°-60° est vert, bleu ou violet. */
function controlerCouleurs(fichiers: string[]): { fichier: string; colores: number; horsFamille: number }[] {
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
    res.append({"fichier": f.split("/")[-1], "colores": int(colore.sum()), "horsFamille": int(hors.sum())})
print(json.dumps(res))
`;
  return JSON.parse(execFileSync(python, ["-c", code, ...fichiers], { maxBuffer: 1 << 26 }).toString()) as ReturnType<typeof controlerCouleurs>;
}

/* ------------------------------------------------------------------ */
/* La fiche témoin AVEC visuels, calée sur la voix posée                 */
/* ------------------------------------------------------------------ */

const { fiche, mots, elements } = caleeGabaritCadreVisuels();
const temps3 = tempsReference3(fiche, mots);
const texteScript = fiche.scenes.map((s) => s.texteDit).join(" ");
const mise = mettreEnPage(fiche, {});
const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: elements, stylo: fiche.stylo, mots, temps3 });
const vertical = formatSortie("vertical");
function calqueVertical(): DonneesCalque | undefined {
  const dureeSec = props.at(-1)!.scene.finMs / 1000;
  const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
  const c = commandeTableau({ videoId: "apercu-visuels", fiche, texteScript, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: vertical.ratio });
  const segments = sousTitresAxion(fabriquerSousTitres({ texte: texteScript, dureeSec, mots, prononciations: [], style: c.styles.sousTitres?.valeur, base: "karaoke", ratio: vertical.ratio, reseaux: reseauxVerticaux() }));
  const params = parametresComposition(c, { ratio: vertical.ratio, plans: plansTableau(scenes), segments, dureeSec, mots, pistesDouble: { face: scenes[0].cle }, positionSousTitresPct: centreBandePct(mise) }, RECETTE_COMPOSITION_TABLEAU);
  return params.texte.sousTitres;
}

/* ------------------------------------------------------------------ */
/* Planche des 16 visuels                                                */
/* ------------------------------------------------------------------ */

/** Une page ivoire carrée (1080 × 1080) qui ne porte que le visuel `id`, dessiné de 0,3 s à 2 s ; la scène dure 4,15 s. */
function pageDuVisuel(id: (typeof IDS_VISUELS_3)[number]): ProprietesTableauScene {
  const base = props[0];
  const options = EXEMPLES_VISUELS_3[id];
  const d = dessinVisuel3(id, options);
  const E = encreVisuel3(d);
  // La grille du visuel posée comme sur la planche de la maquette (390 px sur une cellule de 540) : 780 px ici.
  const cote = 780;
  const sg = cote / GRILLE_VISUEL_3;
  const boite = { x: Math.round((1080 - cote) / 2), y: 160, largeur: cote, hauteur: cote };
  const encre = { x: Math.round(boite.x + E.x * sg), y: Math.round(boite.y + E.y * sg), largeur: Math.round(E.l * sg), hauteur: Math.round(E.h * sg) };
  const fr = (r: { x: number; y: number; largeur: number; hauteur: number }) => ({ px: r, fraction: { x: r.x / 1080, y: r.y / 1080, largeur: r.largeur / 1080, hauteur: r.hauteur / 1080 } });
  const sceneId = `v${String(VISUELS_3[id].numero).padStart(2, "0")}`;
  const elementId = `${sceneId}~visuel`;
  const page = { page: 1, echelle: 1, elements: [{ elementId, sceneId, type: "mention" as const, ordre: 0, lignes: [], gabarit: { sorte: "visuel" as const, id, options, boite, encre }, ...fr(encre), encombrement: fr(encre) }], gestes: [] };
  const r = base.styleReference!;
  return {
    ...base,
    largeur: 1080,
    hauteur: 1080,
    scene: { id: sceneId, page: 1, debutMs: 0, finMs: 4150, premiere: true },
    page,
    heures: [{ elementId, sceneId, debutMs: 300 }],
    dejaEcrits: [],
    pagePrecedente: null,
    styleReference: { ...r, signature: null, heuresPage: { [elementId]: 300 }, scenesPage: [{ id: sceneId, debutMs: 0, finMs: 4150 }], temps3: {}, poses: [], parties: [], debutPageMs: 0, derniere: false, pageFinale: false, finVoixMs: 4150, finVideoMs: 4150 },
  } as ProprietesTableauScene;
}

if (args.includes("--planche")) {
  const tmp = mkdtempSync(join(tmpdir(), "visuels-planche-"));
  const finis: string[] = [];
  const traces: string[][] = [];
  for (const id of IDS_VISUELS_3) {
    const p = pageDuVisuel(id);
    const fin = join(tmp, `${id}.png`);
    await image(p, 4000, fin);
    finis.push(fin);
    const etapes: string[] = [];
    for (const t of [700, 1100, 1550, 2100]) {
      const png = join(tmp, `${id}-${t}.png`);
      await image(p, t, png);
      etapes.push(png);
    }
    traces.push(etapes);
    console.log("visuel", id);
  }
  // Planche 4 × 4 (2160 × 2840, comme la maquette) : numéro, visuel, nom, usage, « Animé : … ».
  const fiches = IDS_VISUELS_3.map((id) => ({ id, ...VISUELS_3[id] }));
  const code = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
fiches, finis, traces, sortie, sortie2, polices = json.loads(sys.argv[1]), json.loads(sys.argv[2]), json.loads(sys.argv[3]), sys.argv[4], sys.argv[5], sys.argv[6]
import os
SYS = "/usr/share/fonts/opentype/inter/"
def F(n, t):
    # Les textes de la planche (hors visuels) : l'Inter complète du système si elle est là (la flèche « → »).
    s = SYS + n.replace(".ttf", ".otf")
    return ImageFont.truetype(s if n.startswith("Inter") and os.path.exists(s) else polices + "/" + n, t)
fond, encre, mention, sable, accent = (246, 241, 232), (17, 10, 5), (94, 79, 62), (191, 168, 139), (180, 79, 41)
W, H = 2160, 2840
im = Image.new("RGB", (W, H), fond)
d = ImageDraw.Draw(im)
d.text((70, 54), "Banque de 16 visuels dessinés · rendue par le moteur", font=F("Montserrat-ExtraBold.ttf", 64), fill=encre)
d.text((70, 136), "PageReference3 + animation-3 + visuels-3 (Remotion) · crayon brun sur page ivoire, une seule touche orange animée par visuel.", font=F("Inter-Medium.ttf", 30), fill=mention)
def coupe(texte, police, largeur):
    mots, l, res = texte.split(), "", []
    for m in mots:
        e = (l + " " + m).strip()
        if d.textlength(e, font=police) > largeur and l: res.append(l); l = m
        else: l = e
    return res + ([l] if l else [])
for i, (f, png) in enumerate(zip(fiches, finis)):
    x, y = (i % 4) * 540, 180 + (i // 4) * 660
    # La cellule de la maquette (540 × 448 au-dessus du nom), le visuel à (75, 46) sur 390 px : ici rendu deux fois plus grand.
    v = Image.open(png).convert("RGB").crop((0, 68, 1080, 964)).resize((540, 448), Image.LANCZOS)
    im.paste(v, (x, y))
    d.text((x + 34, y + 22), "%02d" % f["numero"], font=F("Montserrat-ExtraBold.ttf", 34), fill=sable)
    yy = y + 448
    for l in coupe(f["nom"], F("Inter-SemiBold.ttf", 36), 480): d.text((x + 34, yy), l, font=F("Inter-SemiBold.ttf", 36), fill=encre); yy += 40
    yy += 6
    for l in coupe(f["usage"], F("Inter-Medium.ttf", 26), 484): d.text((x + 34, yy), l, font=F("Inter-Medium.ttf", 26), fill=mention); yy += 32
    yy += 6
    for l in coupe("Animé : " + f["anime"], F("Inter-Bold.ttf", 25), 484): d.text((x + 34, yy), l, font=F("Inter-Bold.ttf", 25), fill=(153, 63, 30)); yy += 30
im.save(sortie)
# Les 16 visuels à 4 instants de leur tracé (0,7 s, 1,1 s, 1,55 s, 2,1 s après le début de la page).
c = 240
t2 = Image.new("RGB", (8 * c + 40, 8 * (round(c * 896 / 1080) + 40) + 60), fond)
d2 = ImageDraw.Draw(t2)
d2.text((20, 14), "Le tracé au crayon, trait par trait, puis la touche orange (rendu du moteur, 4 instants par visuel)", font=F("Inter-SemiBold.ttf", 26), fill=encre)
for i, (f, ps) in enumerate(zip(fiches, traces)):
    rang, demi = i // 2, i % 2
    y = 60 + rang * (round(c * 896 / 1080) + 40)
    d2.text((20 + demi * 4 * c, y), "%02d %s" % (f["numero"], f["nom"]), font=F("Inter-SemiBold.ttf", 22), fill=mention)
    for j, p in enumerate(ps):
        v = Image.open(p).convert("RGB").crop((0, 68, 1080, 964)).resize((c, round(c * 896 / 1080)), Image.LANCZOS)
        t2.paste(v, (20 + (demi * 4 + j) * c, y + 30))
t2.save(sortie2, quality=88)
`;
  execFileSync(python, ["-c", code, JSON.stringify(fiches), JSON.stringify(finis), JSON.stringify(traces), join(dossier, "banque-16-visuels.png"), join(dossier, "banque-16-visuels-trace.jpg"), POLICES], { maxBuffer: 1 << 26 });
  const c = controlerCouleurs([...finis, ...traces.flat()]);
  writeFileSync(join(dossier, "controle-couleurs-planche.json"), `${JSON.stringify({ regle: "pixel coloré (saturation ≥ 12 %) hors des teintes 355°-60° = vert, bleu ou violet", total: c.reduce((n, x) => n + x.horsFamille, 0), images: c }, null, 1)}\n`);
  console.log("Planche :", join(dossier, "banque-16-visuels.png"), "· pixels hors famille :", c.reduce((n, x) => n + x.horsFamille, 0));
  rmSync(tmp, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */
/* Comparaison maquette / moteur                                         */
/* ------------------------------------------------------------------ */

const maquette = val("--comparaison");
if (maquette) {
  const calque = calqueVertical();
  const tmp = mkdtempSync(join(tmpdir(), "visuels-comparaison-"));
  // Pages finies de la fiche témoin, au mot-clé dit (comme les images de la maquette) : l'accroche (« trois »), l'étape 1
  // (« lettres »), l'exemple (la page finie).
  const instant = (sceneId: string, mot?: string) => {
    const p = props.find((x) => x.scene.id === sceneId)!;
    if (!mot) return { p, t: p.scene.finMs - 400 };
    const m = mots.find((x) => x.debutSec * 1000 >= p.scene.debutMs && x.mot.toLowerCase().startsWith(mot))!;
    return { p, t: Math.round(((m.debutSec + m.finSec) / 2) * 1000) + 2600 };
  };
  const pages = [
    { nom: "accroche", maquette: "peps-1-accroche.png", ...instant("s01") },
    { nom: "etape", maquette: "peps-2-etape.png", ...instant("s05", "lettres") },
    { nom: "exemple", maquette: "peps-3-exemple.png", ...instant(props.find((x) => x.page.elements.some((e) => e.gabarit?.sorte === "visuel" && e.gabarit.id === "bouclier-coche"))!.scene.id) },
  ];
  const sorties: string[] = [];
  for (const p of pages) {
    const png = join(tmp, `${p.nom}.png`);
    const page = props.filter((x) => x.page.page === p.p.page.page);
    const derniere = page.at(-1)!;
    const t = derniere.scene.finMs - 400;
    const q = page.find((x) => t >= x.scene.debutMs && t < x.scene.finMs) ?? derniere;
    await image(q, t, png, calque ? { donnees: calque, largeur: 1080, hauteur: 1920 } : undefined);
    sorties.push(png);
    console.log("page", p.nom, (t / 1000).toFixed(2), "s");
  }
  const code = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
pages, maquette, sortie, polices = json.loads(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
F = ImageFont.truetype(polices + "/Inter-SemiBold.ttf", 30)
w, h = 540, 960
im = Image.new("RGB", (2 * w * 3 + 5 * 24, h + 70), (34, 34, 34))
d = ImageDraw.Draw(im)
for i, p in enumerate(pages):
    for j, (titre, f) in enumerate([("Maquette #260", maquette + "/" + p["maquette"]), ("Moteur", p["moteur"])]):
        x = 24 + (2 * i + j) * w + i * 24 * 2
        d.text((x, 18), p["titre"] + " · " + titre, font=F, fill=(240, 240, 240))
        im.paste(Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS), (x, 60))
im.save(sortie, quality=90)
`;
  const titres = ["Accroche", "Étape", "Exemple"];
  execFileSync(python, ["-c", code, JSON.stringify(pages.map((p, i) => ({ maquette: p.maquette, moteur: sorties[i], titre: titres[i] }))), resolve(maquette), join(dossier, "comparaison.jpg"), POLICES]);
  const c = controlerCouleurs(sorties);
  console.log("Comparaison :", join(dossier, "comparaison.jpg"), "· pixels hors famille (moteur) :", c.reduce((n, x) => n + x.horsFamille, 0));
  for (const s of sorties) execFileSync("cp", [s, join(dossier, `moteur-${s.split("/").pop()}`)]);
  rmSync(tmp, { recursive: true, force: true });
}
