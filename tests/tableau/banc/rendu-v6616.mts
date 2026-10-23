/**
 * RENDU RÉEL de la vidéo v-6616b3800357 (ardoise, 9:16) par le moteur (Remotion, Chromium sans affichage :
 * `TableauScene` → `PageTableau`, sous-titres « Pastille Axion » compris) : une image par page, page finie (juste avant
 * la coupe), et une image de la page 2 pendant l'écriture (le titre et sa phrase), plus la page 7 (l'exemple : « 3 »
 * en grand, la phrase entière dessous). Aucun appel payant (minutage réaliste, aucune voix).
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/banc/rendu-v6616.mts [--style ardoise] [--dossier docs/formats/apercus-v6616]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fabriquerSousTitres } from "../../../src/briques/sous-titres";
import type { DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { centreBandePct, commandeTableau, pagesDuStyle, plansTableau, RECETTE_COMPOSITION_TABLEAU, sousTitresAxion } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { formatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { tempsReference3 } from "../../../src/moteurs/montage-tableau/temps-reference-3";
import { motsRealistes } from "../reference-3/fiches";
import { contexteBanc, ficheV6616, MOTS_DOULEUR_V6616 } from "./fiches-banc";

const RACINE = process.cwd();
const args = process.argv.slice(2);
const val = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const style = (val("--style") ?? "ardoise") as StyleTableau;
const dossier = resolve(val("--dossier") ?? join(RACINE, "docs/formats/apercus-v6616"));
const POLICES = join(RACINE, "studio-rendu/compositions/commune/polices");
if (!existsSync(POLICES)) throw new Error("Polices du rendu introuvables.");

const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
interface CompositionChoisie {
  id: string;
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
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", "/opt/pw-browsers/chromium"].find((c) => existsSync(c)) ?? null;
const base = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" as const } };
const instance = await R.openBrowser("chrome", base);
const reglages: Reglages = { ...base, puppeteerInstance: instance };
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });
mkdirSync(dossier, { recursive: true });

// La fiche telle que la fabrication la lit (style de la série posé, pages réparées), calée sur un minutage réaliste.
const f0 = pagesDuStyle({ ...ficheV6616(), styleTableau: style }) as FicheTableau;
const mots = motsRealistes(f0);
const c = calerFicheTableau(f0, mots, { contexte: contexteBanc(f0, MOTS_DOULEUR_V6616), dureeSec: mots.at(-1)!.finSec + 0.3 });
if (!c.ok) throw new Error(`calage refusé : ${c.problemes.join(" | ")}`);
const fiche = c.fiche;
const mise = mettreEnPage(fiche, {});
const props: ProprietesTableauScene[] = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: fiche.scenes as SceneCalee[], heures: c.elements, stylo: fiche.stylo, mots, temps3: tempsReference3(fiche, mots) });
const fs = formatSortie("vertical");
const texteScript = fiche.scenes.map((s) => s.texteDit).join(" ");
const dureeSec = props.at(-1)!.scene.finMs / 1000;
const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
const cmd = commandeTableau({ videoId: "v-6616b3800357", fiche, texteScript, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: fs.ratio });
const segments = sousTitresAxion(fabriquerSousTitres({ texte: texteScript, dureeSec, mots, prononciations: [], style: cmd.styles.sousTitres?.valeur, base: "karaoke", ratio: fs.ratio, reseaux: reseauxVerticaux() }));
const params = parametresComposition(cmd, { ratio: fs.ratio, plans: plansTableau(scenes), segments, dureeSec, mots, pistesDouble: { face: scenes[0].cle }, positionSousTitresPct: centreBandePct(mise) }, RECETTE_COMPOSITION_TABLEAU);
const calque = params.texte.sousTitres as DonneesCalque | undefined;

/** Une image à l'instant `t` (ms), sous-titres compris, en JPEG. */
async function image(t: number, nom: string): Promise<string> {
  const p = props.find((x) => t >= x.scene.debutMs && t < x.scene.finMs) ?? props.at(-1)!;
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await R.selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.floor(((t - p.scene.debutMs) / 1000) * p.fps)));
  const fond = join(dossier, `${nom}.scene.png`);
  await R.renderStill({ composition, serveUrl, output: fond, frame, inputProps, imageFormat: "png", ...reglages });
  const sortie = join(dossier, `${nom}.jpg`);
  if (!calque) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fond, "-q:v", "3", sortie]);
  } else {
    const propsCalque = { donnees: calque, instantSec: t / 1000 } as unknown as Record<string, unknown>;
    const cc = await R.selectComposition({ serveUrl, id: "SousTitres", inputProps: propsCalque, ...reglages });
    const cp = join(dossier, `${nom}.calque.png`);
    await R.renderStill({ composition: { ...cc, width: fs.largeur, height: fs.hauteur }, serveUrl, output: cp, frame: 0, inputProps: propsCalque, imageFormat: "png", ...reglages });
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fond, "-i", cp, "-filter_complex", "[0:v][1:v]overlay=0:0", "-q:v", "3", sortie]);
    rmSync(cp, { force: true });
  }
  rmSync(fond, { force: true });
  return sortie;
}

const pages = [...new Set(props.map((p) => p.page.page))];
const faites: string[] = [];
for (const n of pages) {
  const ps = props.filter((p) => p.page.page === n);
  const der = ps.at(-1)!;
  const t = der.styleReference?.derniere ? der.styleReference.finVideoMs - 700 : Math.max(ps[0].scene.debutMs + 100, der.scene.finMs - 90);
  faites.push(await image(t, `v6616-${style}-p${String(n).padStart(2, "0")}-${ps[0].styleReference?.tableau?.partie ?? ""}`));
}
// Page 2 pendant l'écriture : le titre « Le compte rendu » et sa phrase qui suit sans attendre.
const p2 = props.find((p) => p.page.page === 2)!;
const debutP2 = p2.styleReference?.debutPageMs ?? p2.scene.debutMs;
for (const dt of [900, 1500, 2100]) faites.push(await image(debutP2 + dt, `v6616-${style}-p02-ecriture-${dt}ms`));
// Planche : toutes les pages finies côte à côte.
const finies = faites.filter((f) => !f.includes("ecriture"));
execFileSync("ffmpeg", ["-v", "error", "-y", ...finies.flatMap((f) => ["-i", f]), "-filter_complex", `${finies.map((_, i) => `[${i}:v]scale=360:-1[v${i}]`).join(";")};${finies.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${finies.length}`, "-q:v", "3", join(dossier, `planche-v6616-${style}.jpg`)]);
await instance.close({ silent: true });
console.log(faites.join("\n"));
