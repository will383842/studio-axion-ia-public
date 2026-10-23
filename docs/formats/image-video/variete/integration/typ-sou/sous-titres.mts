/**
 * Banc du lot TYP-SOU pour l'axe 10 (sous-titres) : image d'un accent SOU-C avec ses VRAIS sous-titres, à côté du même
 * instant en SOU-B. Ligne de temps de la carte C (comme `scripts/image-video/variete/images-fixes.mts`), segments par
 * `sousTitresVariesIV` (le vrai moteur), calque rendu par la composition `SousTitres` (la vraie brique, transparente),
 * scène rendue par la composition du bloc (`parametresDuBloc`). Aucun appel payant.
 *
 * Usage (depuis la racine du dépôt) :
 *   studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/integration/typ-sou/sous-titres.mts --sortie <dossier>
 * Sortie : <CODE>-1-scene.jpg + <CODE>-1-calque.png (SOU-B, SOU-C), puis `composer.py` les superpose en <CODE>-1.jpg.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { donneesCalque } from "../../../../../../src/briques/sous-titres";
import type { CarteImage } from "../../../../../../src/domaine/image-video/carte";
import { RESEAUX_IV } from "../../../../../../src/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "../../../../../../src/donnees/bruitages";
import { pisteSimulee } from "../../../../../../src/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "../../../../../../src/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "../../../../../../src/moteurs/montage-image-video/fins";
import { mettreEnSceneIV } from "../../../../../../src/moteurs/montage-image-video/mise-en-scene";
import { passagesIvoireIV, sousTitresVariesIV, STYLE_SOUS_TITRES_IV } from "../../../../../../src/moteurs/montage-image-video/sous-titres-varies";
import { RECETTE_REFERENCE_IV } from "../../../../../../src/moteurs/montage-image-video/variete/tirage";
import { parametresDuBloc } from "../../../../../../src/services/image-video-rendu";

const RACINE = resolve(import.meta.dirname, "../../../../../..");
const MODULES = resolve(RACINE, "studio-rendu/node_modules");
const i = process.argv.indexOf("--sortie");
const sortie = i >= 0 ? process.argv[i + 1] : undefined;
if (!sortie) throw new Error("Usage : sous-titres.mts --sortie <dossier>");

const carte: CarteImage = JSON.parse(readFileSync(resolve(RACINE, "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const fiche = FICHES_SIMULEES["essai-c"];
const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("tiktok"))!;
const bruitagesValides = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const ligneDe = (sousTitres: "SOU-B" | "SOU-C") => mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin), fin, reseaux: fin.reseaux, bruitagesValides, variete: { ...RECETTE_REFERENCE_IV, sousTitres } }).ligne;
const lignes = { "SOU-B": ligneDe("SOU-B"), "SOU-C": ligneDe("SOU-C") };
const segs = { "SOU-B": sousTitresVariesIV(lignes["SOU-B"]), "SOU-C": sousTitresVariesIV(lignes["SOU-C"]) };

// L'instant : le premier accent de SOU-C qui n'existe pas en SOU-B (hors fin), 0,35 s après son entrée.
const accent = (s: { style?: string }) => s.style === "impact" || s.style === "bandeau";
const k = segs["SOU-C"].findIndex((s, n) => accent(s) && !accent(segs["SOU-B"][n]) && s.debutSec > 2 && s.finSec < lignes["SOU-C"].segmentFin.debut);
const t = +(segs["SOU-C"][k].debutSec + 0.35).toFixed(3);

const exiger = createRequire(resolve(RACINE, "studio-rendu/package.json"));
const { bundle } = exiger("@remotion/bundler");
const { selectComposition, renderStill } = exiger("@remotion/renderer");
mkdirSync(sortie, { recursive: true });
const serveUrl: string = await bundle({
  entryPoint: resolve(RACINE, "studio-rendu/compositions/index.ts"),
  webpackOverride: (c: { resolve?: object; resolveLoader?: object }) => ({ ...c, resolve: { ...c.resolve, modules: [MODULES, "node_modules"] }, resolveLoader: { ...c.resolveLoader, modules: [MODULES, "node_modules"] } }),
});
const commun = { browserExecutable: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", chromiumOptions: { gl: "swangle" } };
const resume: Record<string, unknown> = { carte: "C", instantSec: t };
for (const code of ["SOU-B", "SOU-C"] as const) {
  const ligne = lignes[code];
  const b = ligne.blocs.find((x) => x.debut <= t && t < x.fin)!;
  const p = parametresDuBloc(b, ligne);
  const scene = await selectComposition({ serveUrl, id: p.composition, inputProps: p.proprietes, ...commun });
  await renderStill({ serveUrl, composition: scene, inputProps: p.proprietes, frame: Math.min(scene.durationInFrames - 1, Math.round((t - b.debut) * ligne.fps)), output: resolve(sortie, `${code}-1-scene.jpg`), imageFormat: "jpeg", jpegQuality: 92, ...commun });
  const clairs = passagesIvoireIV(ligne);
  const d = donneesCalque({ segments: segs[code], base: "minimal", ratio: "9:16", style: STYLE_SOUS_TITRES_IV });
  const props = { donnees: clairs.length ? { ...d, passagesClairs: clairs } : d, instantSec: t };
  const calque = await selectComposition({ serveUrl, id: "SousTitres", inputProps: props, ...commun });
  await renderStill({ serveUrl, composition: calque, inputProps: props, frame: 0, output: resolve(sortie, `${code}-1-calque.png`), imageFormat: "png", ...commun });
  const g = segs[code].find((s) => s.debutSec <= t && t < s.finSec)!;
  resume[code] = { bloc: b.id, composition: p.composition, groupe: g.mots.map((m) => m.mot).join(" "), style: g.style ?? "base", accents: segs[code].filter(accent).length };
  console.log(`rendue : ${code} (${t} s, ${p.composition})`);
}
writeFileSync(resolve(sortie, "sous-titres.json"), JSON.stringify(resume, null, 2) + "\n");
