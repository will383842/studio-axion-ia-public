/**
 * Lot F45 · images fixes de la carte C en 4:5 (version LinkedIn) et en 9:16 (version TikTok), rendues par le VRAI moteur
 * (ligne de temps `mettreEnSceneIV`, propriétés `parametresDuBloc` du service) et le VRAI paquet `studio-rendu`
 * (`renderStill`), SOUS-TITRES COMPRIS : le calque `SousTitres` de la brique commune, avec les sous-titres variés de la
 * ligne posés au centre de la bande du format, superposé à la scène (comme le montage final). Aucun appel payant.
 *
 * Usage (racine du dépôt) :
 *   studio-rendu/node_modules/.bin/tsx docs/formats/image-video/variete/integration/f45/rendre-f45.mts --sortie <dossier>
 * Instants (critère du lot final) : 0,5 s, 1,5 s, 3 s puis toutes les 3 s. Sortie : `<format>-<t>.jpg` (scène +
 * sous-titres), `instants.json`. Les deux formats ont les mêmes instants (même voix, même ligne de temps).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
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
import { centreSousTitresPct, parametresDuBloc, ratioDeLaLigneIV } from "../../../../../../src/services/image-video-rendu";

const RACINE = resolve(import.meta.dirname, "../../../../../..");
const MODULES = resolve(RACINE, "studio-rendu/node_modules");
const i = process.argv.indexOf("--sortie");
const sortie = i >= 0 ? resolve(process.argv[i + 1]) : "";
if (!sortie) throw new Error("Usage : rendre-f45.mts --sortie <dossier>");
mkdirSync(sortie, { recursive: true });

const carte: CarteImage = JSON.parse(readFileSync(resolve(RACINE, "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const fiche = FICHES_SIMULEES["essai-c"];
const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
const bruitagesValides = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const ligneDe = (format: "9:16" | "4:5") => {
  const fin = fins.find((f) => f.reseaux.includes(format === "4:5" ? "linkedin" : "tiktok"))!;
  const r = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides, ...(format === "4:5" ? { format } : {}) });
  return { ligne: r.ligne, ok: r.ok, phrases: r.phrases };
};

const exiger = createRequire(resolve(RACINE, "studio-rendu/package.json"));
const { bundle } = exiger("@remotion/bundler");
const { selectComposition, renderStill } = exiger("@remotion/renderer");
const serveUrl: string = await bundle({
  entryPoint: resolve(RACINE, "studio-rendu/compositions/index.ts"),
  webpackOverride: (c: { resolve?: object; resolveLoader?: object }) => ({ ...c, resolve: { ...c.resolve, modules: [MODULES, "node_modules"] }, resolveLoader: { ...c.resolveLoader, modules: [MODULES, "node_modules"] } }),
});
const commun = { browserExecutable: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", chromiumOptions: { gl: "swangle" } };
const images: { format: string; t: number; bloc: string; sorte: string; composition: string; fichier: string }[] = [];
const bilans: Record<string, { ok: boolean; phrases: string[]; largeur: number; hauteur: number; dureeSec: number }> = {};

for (const format of ["4:5", "9:16"] as const) {
  const { ligne, ok, phrases } = ligneDe(format);
  bilans[format] = { ok, phrases, largeur: ligne.largeur, hauteur: ligne.hauteur, dureeSec: ligne.dureeSec };
  const ratio = ratioDeLaLigneIV(ligne);
  // Calque des sous-titres du montage final : sous-titres variés de la ligne, au centre de la bande du format.
  const donnees = donneesCalque({ segments: sousTitresVariesIV(ligne), base: "minimal", ratio, style: { ...STYLE_SOUS_TITRES_IV, positionPct: centreSousTitresPct(ratio) } });
  const clairs = passagesIvoireIV(ligne);
  const calque = { donnees: clairs.length ? { ...donnees, passagesClairs: clairs } : donnees };
  const instants = [0.5, 1.5, 3, ...Array.from({ length: Math.floor(ligne.dureeSec / 3) }, (_, k) => 3 * (k + 2))].filter((t) => t < ligne.dureeSec - 0.2);
  for (const t of instants) {
    const b = ligne.blocs.find((x) => t >= x.debut && t < x.fin) ?? ligne.blocs[ligne.blocs.length - 1];
    const p = parametresDuBloc(b, ligne);
    const composition = await selectComposition({ serveUrl, id: p.composition, inputProps: p.proprietes, ...commun });
    const frame = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round((t - b.debut) * ligne.fps)));
    const nom = `${format === "4:5" ? "4x5" : "9x16"}-${t.toFixed(1).padStart(4, "0")}`;
    const scene = resolve(sortie, `${nom}-scene.png`);
    const st = resolve(sortie, `${nom}-st.png`);
    await renderStill({ serveUrl, composition, inputProps: p.proprietes, frame, output: scene, imageFormat: "png", ...commun });
    const cst = await selectComposition({ serveUrl, id: "SousTitres", inputProps: { ...calque, instantSec: t }, ...commun });
    await renderStill({ serveUrl, composition: cst, inputProps: { ...calque, instantSec: t }, frame: 0, output: st, imageFormat: "png", ...commun });
    // Scène + sous-titres (le calque est rendu en 1080 × 1920 : seul son haut, à la taille de l'image, est gardé).
    execFileSync("python3", ["-I", "-c", "import sys\nfrom PIL import Image\na=Image.open(sys.argv[1]).convert('RGBA')\nb=Image.open(sys.argv[2]).convert('RGBA').crop((0,0)+a.size)\nImage.alpha_composite(a,b).convert('RGB').save(sys.argv[3],quality=90)", scene, st, resolve(sortie, `${nom}.jpg`)]);
    images.push({ format, t, bloc: b.id, sorte: b.sorte, composition: p.composition, fichier: `${nom}.jpg` });
    console.log(`rendue : ${nom}.jpg (${b.sorte}, ${p.composition})`);
  }
}
writeFileSync(resolve(sortie, "instants.json"), JSON.stringify({ carte: "C", bilans, images }, null, 2) + "\n");
console.log(`${images.length} image(s) dans ${sortie}`);
