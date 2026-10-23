/**
 * Lot G (toile remplie) : images fixes des TOILES aux instants du banc commun (début + 0,5 s, milieu, fin − 0,3 s de
 * chaque bloc `toile`), sur la carte C ou D, pour une recette (la référence si aucun code). Même chaîne que
 * `scripts/image-video/variete/images-fixes.mts` : fixture, fiche simulée, voix `pisteSimulee`, `parametresDuBloc`,
 * `renderStill` sur le paquet `studio-rendu`. Aucun appel payant.
 *
 *   studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/integration/toile/toiles.mts \
 *     --carte C --recette CAM-B --format 9:16 --nom CAM-B --sortie /tmp/x
 * Sortie : `<dossier>/<NOM>-<n>.jpg` + `instants.json` (format du banc, pour `cote-a-cote.py`).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { FormatIV, RecetteVarieteIV } from "../../../../../../src/briques/schema-motion/variete";
import type { CarteImage } from "../../../../../../src/domaine/image-video/carte";
import { RESEAUX_IV } from "../../../../../../src/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "../../../../../../src/donnees/bruitages";
import { pisteSimulee } from "../../../../../../src/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "../../../../../../src/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "../../../../../../src/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "../../../../../../src/moteurs/montage-image-video/mise-en-scene";
import { RECETTE_REFERENCE_IV } from "../../../../../../src/moteurs/montage-image-video/variete/tirage";
import { parametresDuBloc } from "../../../../../../src/services/image-video-rendu";

const RACINE = resolve(import.meta.dirname, "../../../../../..");
const MODULES = resolve(RACINE, "studio-rendu/node_modules");
const AXES: Record<string, keyof RecetteVarieteIV> = { OUV: "ouverture", REC: "recit", CHI: "chiffres", CAM: "camera", TYP: "texte", APP: "apparition", TRA: "transitions", FIN: "fin", MAT: "matiere", SOU: "sousTitres" };
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const nomCarte = arg("carte") ?? "C";
const format = (arg("format") ?? "9:16") as FormatIV;
const sortie = arg("sortie");
const nom = arg("nom") ?? "REF";
if (!sortie) throw new Error("Usage : toiles.mts --carte C|D [--recette CAM-B] --format 9:16|4:5 --nom NOM --sortie <dossier>");
const recette: Record<string, string> = { ...RECETTE_REFERENCE_IV };
for (const c of (arg("recette") ?? "").split(",").filter(Boolean)) recette[AXES[c.split("-")[0]]] = c;
const carte: CarteImage = JSON.parse(readFileSync(resolve(RACINE, `tests/image-video/fixtures/cartes/${nomCarte}.json`), "utf8"));
const fiche = FICHES_SIMULEES[`essai-${nomCarte.toLowerCase()}`];
const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
const fin = fins.find((f) => f.reseaux.includes(format === "4:5" ? "linkedin" : "tiktok"))!;
const bruitagesValides = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const { ligne } = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides, variete: recette as RecetteVarieteIV, format });

const arrondi = (x: number) => Math.round(x * 1000) / 1000;
const demandes: { t: number; bloc: (typeof ligne.blocs)[number] }[] = [];
for (const b of ligne.blocs) {
  if (b.sorte !== "toile") continue;
  for (const t of [...new Set([b.debut + 0.5, (b.debut + b.fin) / 2, b.fin - 0.3].map(arrondi))].filter((x) => x >= b.debut && x < b.fin)) demandes.push({ t, bloc: b });
}
mkdirSync(sortie, { recursive: true });
const exiger = createRequire(resolve(RACINE, "studio-rendu/package.json"));
const { bundle } = exiger("@remotion/bundler");
const { selectComposition, renderStill } = exiger("@remotion/renderer");
const serveUrl: string = await bundle({
  entryPoint: resolve(RACINE, "studio-rendu/compositions/index.ts"),
  webpackOverride: (c: { resolve?: object; resolveLoader?: object }) => ({ ...c, resolve: { ...c.resolve, modules: [MODULES, "node_modules"] }, resolveLoader: { ...c.resolveLoader, modules: [MODULES, "node_modules"] } }),
});
const commun = { browserExecutable: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", chromiumOptions: { gl: "swangle" } };
const images: Record<string, unknown>[] = [];
let n = 0;
for (const d of demandes) {
  const p = parametresDuBloc(d.bloc, ligne);
  const composition = await selectComposition({ serveUrl, id: p.composition, inputProps: p.proprietes, ...commun });
  const frame = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round((d.t - d.bloc.debut) * ligne.fps)));
  const fichier = `${nom}-${++n}.jpg`;
  await renderStill({ serveUrl, composition, inputProps: p.proprietes, frame, output: resolve(sortie, fichier), imageFormat: "jpeg", jpegQuality: 90, ...commun });
  images.push({ code: nom, n, t: d.t, bloc: d.bloc.id, composition: p.composition, fichier });
  console.log(`rendue : ${fichier} (${d.t} s, bloc ${d.bloc.id}, ${p.composition})`);
}
writeFileSync(resolve(sortie, "instants.json"), JSON.stringify({ carte: nomCarte, format, recette, versions: ligne.reseaux, images }, null, 2) + "\n");
