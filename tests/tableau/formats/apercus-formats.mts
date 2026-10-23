/**
 * APERÇUS DES FORMATS DE SORTIE du tableau animé : la même scène témoin (fiche « démonstration », dernière scène de la
 * page 2, dernière image) rendue en local dans chaque format, avec la ZONE SÛRE (trait vert) et la BANDE DES
 * SOUS-TITRES (trait rouge) tracées par-dessus, réduite en petite image PNG.
 *
 *   npx tsx tests/tableau/formats/apercus-formats.mts [dossier]      (défaut : docs/formats/apercus-formats)
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome   navigateur sans affichage (sinon celui de Playwright, s'il est là)
 *
 * Rien de payant, aucun serveur : Remotion de `studio-rendu` (après `npm ci` dans `studio-rendu`) et FFmpeg du poste.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import { IDS_FORMATS_SORTIE, formatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { imagesScene, proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import { motsFabriques, preuvesExemple } from "../compositions/outils";
import { contexteExemple, ficheDemonstration } from "../regles/exemples";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, "docs/formats/apercus-formats"));
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "apercus-"));
const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: Record<string, unknown>) => Promise<unknown>;
  renderStill: (o: Record<string, unknown>) => Promise<unknown>;
};
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };

const cale = calerFicheTableau(ficheDemonstration, motsFabriques(ficheDemonstration), { contexte: contexteExemple(ficheDemonstration) });
if (!cale.ok) throw new Error(cale.problemes.join("\n"));
const preuves = preuvesExemple(ficheDemonstration);
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });

for (const id of IDS_FORMATS_SORTIE) {
  const f = formatSortie(id);
  const mise = mettreEnPage(cale.fiche, { preuves, format: id });
  const scenes = proprietesScenes({ miseEnPage: mise, scenes: cale.fiche.scenes, heures: cale.elements, stylo: cale.fiche.stylo, preuves });
  const p = scenes.filter((s) => s.page.page === 2).at(-1)!;
  const inputProps = p as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "TableauScene", inputProps, ...reglages });
  const brut = join(travail, `${id}.png`);
  await renderStill({ composition, serveUrl, output: brut, frame: imagesScene(p) - 1, inputProps, imageFormat: "png", ...reglages });
  const z = mise.zoneSure.px;
  const b = mise.bandeSousTitres.px;
  const largeur = f.largeur > f.hauteur ? 480 : 270;
  const filtre = [`drawbox=x=${z.x}:y=${z.y}:w=${z.largeur}:h=${z.hauteur}:color=0x2E8B57:t=4`, `drawbox=x=${b.x}:y=${b.y}:w=${b.largeur}:h=${b.hauteur}:color=0xC0392B:t=4`, `scale=${largeur}:-2:flags=lanczos`].join(",");
  const fichier = join(sortie, `${id}-${f.largeur}x${f.hauteur}.png`);
  const r = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", brut, "-vf", filtre, "-frames:v", "1", "-compression_level", "9", fichier], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  console.log(`${f.libelle} : ${fichier}`);
}
