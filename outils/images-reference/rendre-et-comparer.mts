// N-10. Le rendu ne tourne pas dans la CI (aucune ligne de `.github/`) : la session qui déploie lance `npx tsx outils/images-reference/rendre-et-comparer.mts` avant toute mise en ligne d'une pièce neuve.
// Lancé À LA MAIN par la session qui déploie, depuis la racine du Studio (voir LISEZMOI.md). Jamais par la CI.
// Options : --mettre-a-jour <id> (réécrit la référence de la pièce ; exige une ligne au journal, règle 13 de G13-04).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { comparerImages, type ImageRgba } from "../../tests/images-reference/comparer.ts";
import { versionDerivee } from "../../tests/segments-rendu/version-derivee.ts";

interface Piece { id: string; composition: string; image: number; ratio: string; fichier: string }
interface References { version: number; seuil: number; versionCompositions?: string; pieces: Piece[] }

const racine = resolve(import.meta.dirname, "..", "..");
const fichierRefs = join(racine, "tests", "images-reference", "references.json");
const dossierImages = join(racine, "tests", "images-reference", "images");

function sortir(code: number, message: string): never {
  (code === 0 ? console.log : console.error)(message);
  process.exit(code);
}

const refs = JSON.parse(readFileSync(fichierRefs, "utf8")) as References;
const iMaj = process.argv.indexOf("--mettre-a-jour");
const idMaj = iMaj >= 0 ? process.argv[iMaj + 1] : undefined;
if (iMaj >= 0 && !idMaj) sortir(1, "--mettre-a-jour demande l'identifiant de la pièce.");

if (refs.pieces.length === 0) sortir(0, "aucune pièce à comparer");

// Garde de version (G13-04) : si les compositions ont changé de version sans que les références aient été revues, on refuse.
const versionActuelle = versionDerivee((JSON.parse(readFileSync(join(racine, "tests", "segments-rendu", "version-compositions.json"), "utf8")) as { empreintes: Record<string, string> }).empreintes);
if (refs.versionCompositions !== versionActuelle) {
  sortir(1, `La version des compositions est ${versionActuelle}, les références ont été revues pour ${refs.versionCompositions ?? "aucune"} : revoir chaque pièce, puis mettre « versionCompositions » à jour dans references.json.`);
}

// @remotion/* n'est installé que dans studio-rendu/ : résolution par ce chemin.
const depuisRendu = createRequire(join(racine, "studio-rendu", "package.json"));
const { bundle } = (await import(depuisRendu.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(depuisRendu.resolve("@remotion/renderer"))) as {
  renderStill: (o: Record<string, unknown>) => Promise<unknown>;
  selectComposition: (o: Record<string, unknown>) => Promise<{ width: number; height: number }>;
};

function enRgba(png: string, largeur: number, hauteur: number): ImageRgba {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", png, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg a échoué sur ${png} : ${r.stderr?.toString()}`);
  return { largeur, hauteur, rgba: new Uint8Array(r.stdout) };
}

function dimensionsPng(png: string): { largeur: number; hauteur: number } {
  const b = readFileSync(png);
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20) };
}

// Navigateur imposé (poste sans accès à remotion.dev) : STUDIO_NAVIGATEUR=/chemin/du/chrome.
const navigateur = process.env.STUDIO_NAVIGATEUR ? { browserExecutable: process.env.STUDIO_NAVIGATEUR, chromiumOptions: { gl: "swangle" } } : {};

const temp = mkdtempSync(join(tmpdir(), "images-reference-"));
let code = 0;
try {
  const serveUrl = await bundle({ entryPoint: join(racine, "studio-rendu", "compositions", "index.ts") });
  for (const piece of refs.pieces) {
    if (idMaj && piece.id !== idMaj) continue;
    const sortie = join(temp, `${piece.id}.png`);
    const composition = await selectComposition({ serveUrl, id: piece.composition, inputProps: {}, ...navigateur });
    await renderStill({ composition, serveUrl, output: sortie, frame: piece.image, imageFormat: "png", inputProps: {}, ...navigateur });
    const reference = join(dossierImages, piece.fichier);
    if (idMaj) {
      copyFileSync(sortie, reference);
      console.log(`${piece.id} : référence réécrite (${reference}). Écrire une ligne au journal.`);
      continue;
    }
    if (!existsSync(reference)) { console.error(`${piece.id} : image gardée absente (${piece.fichier}).`); code = 1; continue; }
    const d = dimensionsPng(sortie);
    const g = dimensionsPng(reference);
    const r = comparerImages(enRgba(sortie, d.largeur, d.hauteur), enRgba(reference, g.largeur, g.hauteur));
    if (r.message) { console.error(`${piece.id} : ${r.message}.`); code = 1; }
    else if (r.partEcart > refs.seuil) {
      console.error(`${piece.id} : ${(r.partEcart * 100).toFixed(1).replace(".", ",")} % de l'image a changé, seuil ${(refs.seuil * 100).toFixed(0)} %`);
      code = 1;
    } else console.log(`${piece.id} : conforme (${(r.partEcart * 100).toFixed(2).replace(".", ",")} %).`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
process.exit(code);
