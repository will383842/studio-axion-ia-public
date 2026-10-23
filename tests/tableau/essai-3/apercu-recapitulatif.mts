/**
 * APERÇU DE LA SCÈNE « RÉCAPITULATIF » DU TÉMOIN « relances de devis » (essai réel du 12/10), en vertical : rendu RÉEL
 * (Remotion, Chromium sans affichage) de la dernière image de la scène s07, avec la fin au mot RELANCE. La zone sûre
 * est tracée en rouge par-dessus (repère seulement, jamais dans la vidéo). Lancé une fois sur le code d'avant
 * (« avant ») et une fois sur celui-ci (« apres ») ; `--planche` assemble les deux côte à côte.
 *
 * Usage (depuis la racine du dépôt à rendre, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/essai-3/apercu-recapitulatif.mts <dossier> <avant|apres>
 *   npx tsx tests/tableau/essai-3/apercu-recapitulatif.mts <dossier> --planche
 * Aucun appel payant : la voix n'est pas lue (minutage régulier de 0,36 s par mot, posé ici).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, "docs/formats/apercus-essai-3"));
const quoi = process.argv[3] ?? "apres";
mkdirSync(sortie, { recursive: true });

if (quoi === "--planche") {
  // Avant | après, chacun titré, sur fond gris.
  const police = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  const titre = (t: string) => `pad=iw:ih+90:0:90:color=0x444444,drawtext=fontfile=${police}:text='${t}':x=(w-tw)/2:y=26:fontsize=40:fontcolor=white`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(sortie, "recapitulatif-avant.png"), "-i", join(sortie, "recapitulatif-apres.png"), "-filter_complex", `[0:v]scale=540:-2,${titre("AVANT")}[a];[1:v]scale=540:-2,${titre("APRES")}[b];[a][b]hstack=inputs=2,pad=iw+60:ih+40:30:20:color=0x444444`, "-q:v", "3", join(sortie, "planche-recapitulatif-vertical.jpg")]);
  console.log("Planche écrite :", join(sortie, "planche-recapitulatif-vertical.jpg"));
  process.exit(0);
}

const fiche = JSON.parse(readFileSync(join(RACINE, "tests/tableau/temoins/fiche-relances-prod.json"), "utf8")) as FicheTableau;
const texte = fiche.scenes.map((s) => s.texteDit).join(" ");
const contexte: ContexteTableau = { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres: [{ id: "mat-import-demo-02", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" }], texteScript: texte };
// Voix simulée : un mot toutes les 0,36 s (aucune lecture payante).
const mots = texte.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).map((mot, i) => ({ mot, debutSec: +(i * 0.36).toFixed(2), finSec: +(i * 0.36 + 0.3).toFixed(2) }));
const calage = calerFicheTableau(fiche, mots, { contexte, dureeSec: mots.at(-1)!.finSec + 0.5 });
if (!calage.ok) throw new Error(`calage refusé : ${calage.problemes.join(" | ")}`);

const mise = mettreEnPage(calage.fiche, { appel: { mot: "RELANCE" } });
const recap = mise.styleV2!.ecrans.find((e) => e.sceneId === "s07")!;
console.log(`${quoi} : gabarit retenu pour la scène s07 : « ${recap.gabarit} »`);
const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: calage.fiche.scenes as SceneCalee[], heures: calage.elements, stylo: calage.fiche.stylo, mots, fps: 30 });
const p = props.find((x) => x.scene.id === "s07")!;

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
const inputProps = p as unknown as Record<string, unknown>;
const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
const brut = join(sortie, `.recapitulatif-${quoi}.png`);
// Dernière image de la scène : les trois lignes écrites et cochées.
await renderStill({ composition, serveUrl, output: brut, frame: composition.durationInFrames - 1, inputProps, imageFormat: "png", ...reglages });
const z = mise.zoneSure.px;
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", brut, "-vf", `drawbox=x=${z.x}:y=${z.y}:w=${z.largeur}:h=${z.hauteur}:color=red@0.9:t=4`, join(sortie, `recapitulatif-${quoi}.png`)]);
rmSync(brut, { force: true });
console.log("Image écrite :", join(sortie, `recapitulatif-${quoi}.png`));
