/**
 * RENDU RÉEL de la page 2 de la vidéo v-fc3ac0c1d171 (ardoise, 9:16) par le moteur (Remotion, Chromium sans affichage :
 * `TableauScene` → `PageTableau`, sous-titres « Pastille Axion » compris), en 4 images lues sur le plan de l'outil :
 * début de la page, titre « Qui fait quoi » en cours d'écriture, titre fini, phrase suivante en cours d'écriture.
 * Aucun appel payant (minutage réaliste, aucune voix).
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/titre-seul/rendu-vfc3.mts [--style ardoise] [--dossier docs/formats/apercus-titre-seul]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fabriquerSousTitres } from "../../../src/briques/sous-titres";
import type { DonneesCalque } from "../../../src/briques/sous-titres/scene";
import { parametresComposition } from "../../../src/briques/composition/parametres";
import { planPage3 } from "../../../src/briques/tableau-scene/reference/animation-3";
import type { StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { ProprietesTableauScene } from "../../../src/briques/tableau-scene/types";
import { centreBandePct, commandeTableau, pagesDuStyle, plansTableau, RECETTE_COMPOSITION_TABLEAU, sousTitresAxion } from "../../../src/moteurs/montage-tableau/fabriquer";
import { formatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, reseauxVerticaux } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { motsRealistes } from "../reference-3/fiches";
import { contexteBanc, MOTS_DOULEUR_V6616 } from "../banc/fiches-banc";
import { ficheVfc3, proprietesVfc3 } from "./fiche-vfc3";

const RACINE = process.cwd();
const args = process.argv.slice(2);
const val = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const style = (val("--style") ?? "ardoise") as StyleTableau;
const dossier = resolve(val("--dossier") ?? join(RACINE, "docs/formats/apercus-titre-seul"));
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
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string; publicDir?: string }) => Promise<string> };
const R = (await import(exiger.resolve("@remotion/renderer"))) as {
  openBrowser: (b: string, o: { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } }) => Promise<{ close: (o?: unknown) => Promise<void> }>;
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", "/opt/pw-browsers/chromium"].find((c) => existsSync(c)) ?? null;
const base = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" as const } };
const instance = await R.openBrowser("chrome", base);
const reglages: Reglages = { ...base, puppeteerInstance: instance };
// Les polices des plaquettes v4 (#339) sont chargées dès l'import du paquet, par `staticFile` : sans dossier public, tout
// rendu s'arrête (404). Le dossier de leurs polices sert de dossier public à cet aperçu.
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts"), publicDir: join(RACINE, "studio-rendu/compositions/interface-claire/motion-v4/lot5") });
mkdirSync(dossier, { recursive: true });

// La fiche telle que la fabrication la lit (style posé, pages réparées), calée sur un minutage réaliste.
const f0 = pagesDuStyle({ ...ficheVfc3(), styleTableau: style }) as FicheTableau;
const mots = motsRealistes(f0);
const c = calerFicheTableau(f0, mots, { contexte: contexteBanc(f0, MOTS_DOULEUR_V6616), dureeSec: mots.at(-1)!.finSec + 0.3 });
if (!c.ok) throw new Error(`calage refusé : ${c.problemes.join(" | ")}`);
const fiche = c.fiche;
const mise = mettreEnPage(fiche, {});
const props: ProprietesTableauScene[] = proprietesVfc3(style, "vertical");
const fs = formatSortie("vertical");
const texteScript = fiche.scenes.map((s) => s.texteDit).join(" ");
const dureeSec = props.at(-1)!.scene.finMs / 1000;
const scenes = props.map((p) => ({ id: p.scene.id, debutSec: p.scene.debutMs / 1000, finSec: p.scene.finMs / 1000, cle: `apercu/${p.scene.id}.mp4` }));
const cmd = commandeTableau({ videoId: "v-fc3ac0c1d171", fiche, texteScript, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes, ratio: fs.ratio });
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

// Les 4 instants, lus sur le plan de l'outil de la page 2 (celui que le rendu suit).
const p2 = props.find((p) => p.page.page === 2)!;
const plan = planPage3(p2.page, p2.styleReference!, { largeur: p2.largeur, hauteur: p2.hauteur });
const titre = p2.page.elements.find((e) => e.gabarit?.sorte === "titre")!;
const phrase = p2.page.elements.find((e) => e.gabarit?.sorte === "phrase")!;
const de = (id: string) => plan.actions.filter((a) => a.id === id && a.trace === "ecrire");
const t0 = Math.min(...de(titre.elementId).map((a) => a.debut));
const t1 = Math.max(...de(titre.elementId).map((a) => a.debut + a.duree));
const s0 = Math.min(...de(phrase.elementId).map((a) => a.debut));
const s1 = Math.max(...de(phrase.elementId).map((a) => a.debut + a.duree));
const instants: [number, string][] = [
  [plan.finTransition + 0.05, "1-debut"],
  [(t0 + t1) / 2, "2-titre-en-cours"],
  [t1 + 0.04, "3-titre-fini"],
  [s0 + (s1 - s0) * 0.45, "4-phrase-en-cours"],
];
const faites: string[] = [];
for (const [t, nom] of instants) faites.push(await image(Math.round(t * 1000), `vfc3-${style}-p02-${nom}`));
await instance.close({ silent: true });
console.log(`titre ${t0.toFixed(2)}→${t1.toFixed(2)} s · phrase ${s0.toFixed(2)}→${s1.toFixed(2)} s · seul ${(s0 - t1).toFixed(2)} s`);
console.log(faites.join("\n"));
