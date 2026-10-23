/**
 * Lot CAM-TRA : images fixes à des INSTANTS CHOISIS (le banc commun `scripts/image-video/variete/images-fixes.mts` ne
 * prend que début, milieu et fin de bloc). Même chaîne que le banc : ligne de temps de la carte C (fixture, fiche
 * simulée, voix `pisteSimulee`), propriétés par `parametresDuBloc`, `renderStill` sur le paquet `studio-rendu`.
 *
 *   studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/integration/cam-tra/instants.mts \
 *     --recette CAM-B --format 9:16 --sortie /tmp/x --images CAM-B-2=11.9,TRA-C-A=29.4
 * Un instant `NOM=t` (secondes de la vidéo) ; `NOM=t@bloc` force le bloc (utile pile sur une jointure). `--lister`
 * imprime les blocs (id, sorte, début, fin, données des axes caméra et transitions). Écrit aussi `instants.json` au
 * format du banc (code = NOM sans son dernier « -n »), pour `scripts/image-video/variete/cote-a-cote.py`.
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
const format = (arg("format") ?? "9:16") as FormatIV;
const recette: Record<string, string> = { ...RECETTE_REFERENCE_IV };
for (const c of (arg("recette") ?? "").split(",").filter(Boolean)) recette[AXES[c.split("-")[0]]] = c;
const carte: CarteImage = JSON.parse(readFileSync(resolve(RACINE, "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const fiche = FICHES_SIMULEES["essai-c"];
const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
const fin = fins.find((f) => f.reseaux.includes(format === "4:5" ? "linkedin" : "tiktok"))!;
const bruitagesValides = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const { ligne } = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides, variete: recette as RecetteVarieteIV, format });

if (process.argv.includes("--lister")) {
  for (const b of ligne.blocs) console.log(b.id, b.sorte, b.debut, b.fin, JSON.stringify({ camera: b.variete?.donnees?.camera ? "oui" : undefined, transitions: b.variete?.donnees?.transitions }));
  console.log("replis", JSON.stringify(ligne.variete?.replis));
}
const demandes = (arg("images") ?? "").split(",").filter(Boolean).map((x) => {
  const [nom, reste] = x.split("=");
  const [t, bloc] = reste.split("@");
  return { nom, t: Number(t), bloc };
});
if (demandes.length) {
  const sortie = arg("sortie")!;
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
  for (const d of demandes) {
    const b = d.bloc ? ligne.blocs.find((x) => x.id === d.bloc)! : ligne.blocs.find((x) => d.t >= x.debut && d.t < x.fin)!;
    const p = parametresDuBloc(b, ligne);
    const composition = await selectComposition({ serveUrl, id: p.composition, inputProps: p.proprietes, ...commun });
    const frame = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round((d.t - b.debut) * ligne.fps)));
    await renderStill({ serveUrl, composition, inputProps: p.proprietes, frame, output: resolve(sortie, `${d.nom}.jpg`), imageFormat: "jpeg", jpegQuality: 90, ...commun });
    images.push({ code: d.nom.replace(/-[^-]+$/, ""), n: d.nom.split("-").pop(), t: d.t, bloc: b.id, composition: p.composition, fichier: `${d.nom}.jpg` });
    console.log(`rendue : ${d.nom}.jpg (${d.t} s, bloc ${b.id}, image ${frame}/${composition.durationInFrames}, ${p.composition})`);
  }
  writeFileSync(resolve(sortie, "instants.json"), JSON.stringify({ carte: "C", format, recette, versions: ligne.reseaux, images }, null, 2) + "\n");
}
