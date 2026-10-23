/**
 * Banc COMMUN des lots de variété « Image → vidéo » : images fixes d'une recette forcée, rendues par le VRAI moteur.
 * Ligne de temps de la carte C (fixture, fiche simulée, voix `pisteSimulee`, fins `planDesFinsIV`), propriétés de chaque
 * bloc par `parametresDuBloc` (le service, pur), puis `renderStill` sur le paquet `studio-rendu`. Aucun appel payant.
 *
 * Usage (depuis la racine du dépôt) :
 *   studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/images-fixes.mts --code OUV-A --format 9:16 --sortie /tmp/x
 *   … --recette OUV-A,REC-B,CHI-C   (plusieurs codes ; les axes non cités gardent la référence)
 *   … --carte E                     (une autre carte des fixtures, A à F ; défaut C)
 *   … --fiche REC-B                 (fiche simulée écrite selon ce récit) ou --fiche <fiche.json> (une fiche à part)
 * Images : début du bloc + 0,5 s, milieu, fin − 0,3 s de chaque bloc qui porte un code cité (plus 0,5 s / 1,5 s / 3 s
 * pour une ouverture). Aucun bloc ne porte le code (axe encore bouchon) : celles du premier bloc, plus, pour un axe à
 * écran propre, une image de son écran `ImageVideoVariete` (`<CODE>-ecran.jpg`). Sortie :
 * `<dossier>/<CODE>-<n>.jpg` + `instants.json`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { AXES_VARIETE, type AxeEcranVariete, type AxeVariete, type FormatIV, type RecetteVarieteIV } from "../../../src/briques/schema-motion/variete";
import type { CarteImage } from "../../../src/domaine/image-video/carte";
import { RESEAUX_IV } from "../../../src/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "../../../src/donnees/bruitages";
import { pisteSimulee } from "../../../src/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES, ficheSimuleeRecit } from "../../../src/moteurs/montage-image-video/ecriture.simulation";
import type { FicheImage } from "../../../src/domaine/image-video/fiche";
import type { CodeRecit } from "../../../src/moteurs/montage-image-video/recettes";
import { planDesFinsIV } from "../../../src/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV } from "../../../src/moteurs/montage-image-video/mise-en-scene";
import { RECETTE_REFERENCE_IV } from "../../../src/moteurs/montage-image-video/variete/tirage";
import { parametresDuBloc } from "../../../src/services/image-video-rendu";

const RACINE = resolve(import.meta.dirname, "../../..");
const MODULES = resolve(RACINE, "studio-rendu/node_modules");
const PREFIXES: Record<string, AxeVariete> = { OUV: "ouverture", REC: "recit", CHI: "chiffres", CAM: "camera", TYP: "texte", APP: "apparition", TRA: "transitions", FIN: "fin", MAT: "matiere", SOU: "sousTitres" };

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const codes = (argument("recette") ?? argument("code") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
const format = (argument("format") ?? "9:16") as FormatIV;
const sortie = argument("sortie");
if (!codes.length || !sortie || !["9:16", "4:5"].includes(format)) throw new Error("Usage : images-fixes.mts --code OUV-A | --recette OUV-A,REC-B --format 9:16|4:5 --sortie <dossier>");
const recette: Record<string, string> = { ...RECETTE_REFERENCE_IV };
for (const c of codes) {
  const axe = PREFIXES[c.split("-")[0]];
  if (!axe) throw new Error(`Code inconnu : ${c}`);
  recette[axe] = c;
}

// 1. Ligne de temps de la carte (C par défaut) : la version TikTok en 9:16, la version LinkedIn en 4:5.
const nomCarte = (argument("carte") ?? "C").toUpperCase();
const carte: CarteImage = JSON.parse(readFileSync(resolve(RACINE, `tests/image-video/fixtures/cartes/${nomCarte}.json`), "utf8"));
// Fiche : celle de base de la carte ; `--fiche REC-x` : la fiche simulée de ce récit ; `--fiche x.json` : un fichier.
const choixFiche = argument("fiche");
const fiche: FicheImage = !choixFiche
  ? FICHES_SIMULEES[carte.image.empreinte]
  : /^REC-[A-D]$/.test(choixFiche)
    ? (ficheSimuleeRecit(carte.image.empreinte, choixFiche as CodeRecit) ?? FICHES_SIMULEES[carte.image.empreinte])
    : JSON.parse(readFileSync(resolve(choixFiche), "utf8"));
if (!fiche) throw new Error(`Aucune fiche pour la carte ${nomCarte}.`);
const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
const fin = fins.find((f) => f.reseaux.includes(format === "4:5" ? "linkedin" : "tiktok"))!;
const bruitagesValides = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const { ligne } = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides, variete: recette as RecetteVarieteIV, format });

// 2. Instants : chaque bloc qui porte un code cité.
const porte = (b: BlocRenduIV, code: string, axe: AxeVariete) => (b.sorte === "variete" && b.code === code) || b.variete?.donnees?.[axe] !== undefined;
const arrondi = (x: number) => Math.round(x * 1000) / 1000;
type Instant = { code: string; n: number | "ecran"; t: number; bloc: string; composition: string; repli?: string };
const instants: Instant[] = [];
const blocs = new Map(ligne.blocs.map((b) => [b.id, b]));
const AXES_ECRAN: readonly AxeVariete[] = ["ouverture", "texte", "chiffres", "camera", "fin"] satisfies AxeEcranVariete[];
for (const code of codes) {
  const axe = PREFIXES[code.split("-")[0]];
  const portes = ligne.blocs.filter((b) => porte(b, code, axe));
  const repli = portes.length ? undefined : "aucun bloc ne porte ce code (axe encore bouchon) : premier bloc";
  let n = 0;
  for (const b of portes.length ? portes : [ligne.blocs[0]]) {
    const ts = [b.debut + 0.5, (b.debut + b.fin) / 2, b.fin - 0.3, ...(axe === "ouverture" ? [b.debut + 1.5, b.debut + 3] : [])].filter((t) => t >= b.debut && t < b.fin);
    for (const t of [...new Set(ts.map(arrondi))].sort((x, y) => x - y)) instants.push({ code, n: ++n, t, bloc: b.id, composition: parametresDuBloc(b, ligne).composition, ...(repli ? { repli } : {}) });
  }
  if (!portes.length && AXES_ECRAN.includes(axe)) {
    const b = { id: `ecran-${code}`, debut: 0, fin: 3, sorte: "variete", axe, code, donnees: null, variete: { recette: recette as RecetteVarieteIV, format } } as BlocRenduIV;
    blocs.set(b.id, b);
    instants.push({ code, n: "ecran", t: 0.5, bloc: b.id, composition: parametresDuBloc(b, ligne).composition, repli: "écran de l'axe encore bouchon (fond + marque)" });
  }
}

// 3. Rendu : un paquet, une image par instant.
mkdirSync(sortie, { recursive: true });
const exiger = createRequire(resolve(RACINE, "studio-rendu/package.json"));
const { bundle } = exiger("@remotion/bundler");
const { selectComposition, renderStill } = exiger("@remotion/renderer");
const serveUrl: string = await bundle({
  entryPoint: resolve(RACINE, "studio-rendu/compositions/index.ts"),
  webpackOverride: (c: { resolve?: object; resolveLoader?: object }) => ({ ...c, resolve: { ...c.resolve, modules: [MODULES, "node_modules"] }, resolveLoader: { ...c.resolveLoader, modules: [MODULES, "node_modules"] } }),
});
const commun = { browserExecutable: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", chromiumOptions: { gl: "swangle" } };
const images: (Instant & { fichier: string })[] = [];
for (const i of instants) {
  const b = blocs.get(i.bloc)!;
  const p = parametresDuBloc(b, ligne);
  const composition = await selectComposition({ serveUrl, id: p.composition, inputProps: p.proprietes, ...commun });
  const frame = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round((i.t - b.debut) * ligne.fps)));
  const fichier = `${i.code}-${i.n}.jpg`;
  await renderStill({ serveUrl, composition, inputProps: p.proprietes, frame, output: resolve(sortie, fichier), imageFormat: "jpeg", jpegQuality: 90, ...commun });
  images.push({ ...i, fichier });
  console.log(`rendue : ${fichier} (${i.t} s, ${p.composition})`);
}
writeFileSync(resolve(sortie, "instants.json"), JSON.stringify({ carte: nomCarte, fiche: choixFiche ?? "base", format, recette, axes: AXES_VARIETE, versions: ligne.reseaux, images }, null, 2) + "\n");
console.log(`${images.length} image(s) dans ${sortie}`);
