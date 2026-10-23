/**
 * PLANCHE AVANT / APRÈS DU TÉMOIN « relances de devis » (fiche réelle, première vidéo fabriquée) : rendu RÉEL
 * (Remotion, Chromium sans affichage) de la fin de CHAQUE écran de chaque scène, plus les premières images de la
 * scène 1 (texte annoncé), en vertical et en portrait 4:5. Lancé une fois sur le code d'avant (« avant ») et une fois
 * sur celui-ci (« apres ») ; `--planche` assemble, par format, une rangée « AVANT » au-dessus d'une rangée « APRES ».
 *
 * Usage (depuis la racine du dépôt à rendre, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/dessin-3/apercus.mts <dossier> <avant|apres>
 *   npx tsx tests/tableau/dessin-3/apercus.mts <dossier> --planche
 * Aucun appel payant : la voix n'est pas lue (minutage régulier de 0,36 s par mot, posé ici).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, "docs/formats/apercus-dessin-3"));
const quoi = process.argv[3] ?? "apres";
const FORMATS = ["vertical", "portrait"] as const;
mkdirSync(sortie, { recursive: true });

if (quoi === "--planche") {
  const police = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  for (const format of FORMATS) {
    const rangee = (q: string) => readdirSync(join(sortie, q)).filter((f) => f.startsWith(`${format}-`) && f.endsWith(".jpg")).sort().map((f) => join(sortie, q, f));
    const avant = rangee("avant");
    const apres = rangee("apres");
    const n = Math.max(avant.length, apres.length);
    const images = [...avant, ...apres];
    const entrees = images.flatMap((f) => ["-i", f]);
    // Chaque image titrée de son nom (écran, instant), puis deux rangées.
    const etiq = (f: string) => f.split("/").pop()!.replace(/\.jpg$/, "").replace(`${format}-`, "").replace(/'/g, "");
    const pre = images.map((f, i) => `[${i}:v]pad=iw+8:ih+44:4:40:color=0x444444,drawtext=fontfile=${police}:text='${etiq(f)}':x=6:y=10:fontsize=18:fontcolor=white[i${i}]`).join(";");
    const ligne = (de: number, nb: number, nom: string) => `${Array.from({ length: nb }, (_, j) => `[i${de + j}]`).join("")}hstack=inputs=${nb},pad=iw+120:ih:120:0:color=0x222222,drawtext=fontfile=${police}:text='${nom}':x=10:y=(h-th)/2:fontsize=26:fontcolor=white[${nom}]`;
    void n;
    const filtre = `${pre};${ligne(0, avant.length, "AVANT")};${ligne(avant.length, apres.length, "APRES")};[AVANT][APRES]vstack=inputs=2`;
    const fichier = join(sortie, `planche-${format}.jpg`);
    execFileSync("ffmpeg", ["-v", "error", "-y", ...entrees, "-filter_complex", filtre, "-q:v", "4", fichier]);
    console.log("Planche écrite :", fichier);
  }
  process.exit(0);
}

const fiche = JSON.parse(readFileSync(join(RACINE, "tests/tableau/temoins/fiche-relances-prod.json"), "utf8")) as FicheTableau;
const texte = fiche.scenes.map((s) => s.texteDit).join(" ");
const contexte: ContexteTableau = { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres: [{ id: "mat-import-demo-02", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" }], texteScript: texte };
const mots = texte.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).map((mot, i) => ({ mot, debutSec: +(i * 0.36).toFixed(2), finSec: +(i * 0.36 + 0.3).toFixed(2) }));
const calage = calerFicheTableau(fiche, mots, { contexte, dureeSec: mots.at(-1)!.finSec + 0.5 });
if (!calage.ok) throw new Error(`calage refusé : ${calage.problemes.join(" | ")}`);

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
const dossier = join(sortie, quoi);
rmSync(dossier, { recursive: true, force: true });
mkdirSync(dossier, { recursive: true });

for (const format of FORMATS) {
  const mise = mettreEnPage(calage.fiche, { appel: { mot: "RELANCE" }, ...(format === "vertical" ? {} : { format }) });
  const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: calage.fiche.scenes as SceneCalee[], heures: calage.elements, stylo: calage.fiche.stylo, mots, fps: 30 });
  let rang = 0;
  for (const p of props) {
    const inputProps = p as unknown as Record<string, unknown>;
    const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
    const v = p.v2!;
    // Images : fin de chaque écran (juste avant le suivant), et pour la scène 1 les toutes premières images.
    const vues: { nom: string; frame: number }[] = [];
    if (rang === 0) for (const f of [0, 12]) vues.push({ nom: `${p.scene.id}-debut-${String(f).padStart(2, "0")}`, frame: f });
    v.ecrans.forEach((e, j) => {
      // L'écran de la scène d'avant (repris pour le balayage) est vu avec sa propre scène.
      if (e.sceneId !== p.scene.id) return;
      const fin = j + 1 < v.ecrans.length ? v.temps[v.ecrans[j + 1].id].debutMs - 60 : p.scene.finMs - 40;
      const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((fin - p.scene.debutMs) / 1000) * p.fps)));
      vues.push({ nom: `${e.id.replace(/~/g, "-")}-${e.gabarit}`, frame });
    });
    for (const vue of vues) {
      const png = join(dossier, `.${format}.png`);
      await renderStill({ composition, serveUrl, output: png, frame: vue.frame, inputProps, imageFormat: "png", ...reglages });
      const jpg = join(dossier, `${format}-${String(rang).padStart(2, "0")}-${vue.nom}.jpg`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", "scale=300:-2:flags=lanczos", "-q:v", "3", jpg]);
      rmSync(png, { force: true });
      console.log(`${quoi} ${format} → ${jpg}`);
      rang++;
    }
  }
}
console.log("Aperçus écrits dans", dossier);
