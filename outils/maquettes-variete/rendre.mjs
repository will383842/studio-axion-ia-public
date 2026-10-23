/**
 * MAQUETTES DE VARIÉTÉ (lot L1) · étape 2 : rendu des images fixes (Remotion `renderStill`) avec les VRAIS composants
 * du studio. Prévu pour tourner dans un conteneur JETABLE construit depuis l'image `studio-rendu` (Remotion et son
 * navigateur y sont déjà ; rien à installer sur le PC) :
 *
 *   # sur le serveur, dossier temporaire /tmp/maquettes-l1 contenant : compositions/ (studio-rendu/compositions),
 *   # briques/ (src/briques), rendre.mjs, sous-titres.json — puis :
 *   docker run --rm --cpus 2 --memory 3g --network none -v /tmp/maquettes-l1:/travail --entrypoint sh studio-rendu:local \
 *     -c "rm -rf compositions /app/src/briques && cp -r /travail/compositions . && cp -r /travail/briques /app/src/briques \
 *         && cp /travail/rendre.mjs . && node rendre.mjs"
 *
 * Les images sortent dans /travail/sortie/<nom>.jpg. Le conteneur ne touche à aucun conteneur en service.
 * Ensuite, sur le PC : `python outils/maquettes-variete/planche.py`.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const TRAVAIL = process.env.TRAVAIL ?? "/travail";
const SORTIE = join(TRAVAIL, "sortie");
mkdirSync(SORTIE, { recursive: true });
const st = existsSync(join(TRAVAIL, "sous-titres.json")) ? JSON.parse(readFileSync(join(TRAVAIL, "sous-titres.json"), "utf-8")) : {};

/** Image rendue de chaque maquette (25 i/s) : animations posées, sauf la bande de transitions (instants choisis). */
const RENDUS = [
  ["aujourdhui-accroche", 62],
  ["aujourdhui-etape", 62],
  ["m01-ouverture-chiffre", 55],
  ["m02-ouverture-titre-gauche", 62],
  ["m03-etape-plein-cadre", 62],
  ["m04-etape-objet-gauche", 62],
  ["m05-liste-pile", 75],
  ["m06-fond-terracotta", 62],
  ["m07-barres-proportionnelles", 75],
  ["m08-objet-compose", 75],
  ["m09-ouverture-question", 62],
  ["m10-ouverture-avant-apres", 40],
  ["m11-ouverture-zoom-arriere", 75],
  ["m12-citation-geante", 62],
  ["m13-comparatif-deux-colonnes", 75],
  ["m14-journee-8h-22h", 75],
  ["m15-jauge-13-criteres", 75],
  ["m16-fin-variante", 75],
  ["m17-recrutement-autre-tirage", 62],
  ["t1-volet-entree", 9],
  ["t2-volet-sortie", 13],
  ["t3-zoom-debut", 30],
  ["t4-zoom-fin", 99],
];

const seuls = process.argv.slice(2);
const choisis = seuls.length ? RENDUS.filter(([n]) => seuls.includes(n)) : RENDUS;
const debut = Date.now();
const serveUrl = await bundle({ entryPoint: resolve("compositions/cas-concret/variantes/entree.ts") });
const reglages = { chromiumOptions: { gl: "swangle" }, logLevel: "error" };
for (const [nom, image] of choisis) {
  const inputProps = { nom, ...(st[nom] ? { sousTitres: { donnees: st[nom].donnees, instantSec: st[nom].instantSec } } : {}) };
  const composition = await selectComposition({ serveUrl, id: "CasConcretMaquette", inputProps, ...reglages });
  await renderStill({ composition, serveUrl, output: join(SORTIE, `${nom}.jpg`), frame: image, inputProps, imageFormat: "jpeg", jpegQuality: 92, ...reglages });
  console.log(`${nom} (image ${image})`);
}
console.log(`${choisis.length} images en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
