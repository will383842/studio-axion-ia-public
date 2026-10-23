/**
 * RENDU D'IMAGES FIXES des compositions du tableau animé (TB-05), en local, sans serveur : mêmes compositions que
 * l'opération `composition` (sans mode) du conteneur. Pour 3 scènes tirées des fiches d'exemple et les 3 compositions
 * par défaut : première image, milieu, dernière image, puis contrôles sur les pixels :
 *   - première image de la scène 1 : l'accroche est visible (de l'encre dans son rectangle) ;
 *   - rien dans la bande des sous-titres (que la couleur de la page) ;
 *   - deux rendus de la même image sont identiques à l'octet près.
 *
 * Usage (depuis la racine, après `npm ci` dans `studio-rendu`) :
 *   npx tsx tests/tableau/compositions/images-fixes.mts [dossier de sortie]
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/chrome   navigateur sans affichage (sinon celui de Playwright, s'il est là)
 * Sortie : code 0 si tous les contrôles passent ; les images PNG sont écrites dans le dossier de sortie.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { COULEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import { BULLE_EXEMPLE, LIGNE_EXEMPLE, SCENE_EXEMPLE } from "../../../studio-rendu/compositions/tableau/exemples";
import { imagesScene } from "../../../studio-rendu/compositions/tableau/proprietes";
import type { ProprietesTableauScene } from "../../../studio-rendu/compositions/tableau/types";
import { ficheErreurCorrigee, ficheQuestionAbonne } from "../regles/exemples";
import { scenesExemple } from "./outils";

const RACINE = process.cwd();
const sortie = resolve(process.argv[2] ?? join(RACINE, ".images-tableau"));
mkdirSync(sortie, { recursive: true });
const exiger = createRequire(join(RACINE, "studio-rendu/package.json"));
// Remotion n'est installé que dans `studio-rendu` : chargé depuis là, avec les seules signatures utilisées ici.
interface CompositionChoisie {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}
type Reglages = { browserExecutable: string | null; chromiumOptions: { gl: "swangle" } };
const { bundle } = (await import(exiger.resolve("@remotion/bundler"))) as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = (await import(exiger.resolve("@remotion/renderer"))) as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> } & Reglages) => Promise<CompositionChoisie>;
  renderStill: (o: { composition: CompositionChoisie; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; imageFormat: "png" } & Reglages) => Promise<unknown>;
};

const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c)) ?? null;
const reglages: Reglages = { browserExecutable: navigateur, chromiumOptions: { gl: "swangle" } };

/* PNG → pixels RVB(A) 8 bits (sans entrelacement), pour les contrôles. */
function lirePng(fichier: string): { largeur: number; hauteur: number; canaux: number; pixels: Buffer } {
  const b = readFileSync(fichier);
  let o = 8;
  let largeur = 0;
  let hauteur = 0;
  let type = 0;
  const idat: Buffer[] = [];
  while (o < b.length) {
    const n = b.readUInt32BE(o);
    const nom = b.toString("ascii", o + 4, o + 8);
    const d = b.subarray(o + 8, o + 8 + n);
    if (nom === "IHDR") {
      largeur = d.readUInt32BE(0);
      hauteur = d.readUInt32BE(4);
      if (d[8] !== 8 || d[12] !== 0) throw new Error("PNG non pris en charge");
      type = d[9];
    } else if (nom === "IDAT") idat.push(d);
    o += 12 + n;
  }
  const canaux = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!canaux) throw new Error(`PNG de type ${type} non pris en charge`);
  const brut = inflateSync(Buffer.concat(idat));
  const pas = largeur * canaux;
  const pixels = Buffer.alloc(pas * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[y * (pas + 1)];
    for (let x = 0; x < pas; x++) {
      const v = brut[y * (pas + 1) + 1 + x];
      const a = x >= canaux ? pixels[y * pas + x - canaux] : 0;
      const h = y > 0 ? pixels[(y - 1) * pas + x] : 0;
      const c = x >= canaux && y > 0 ? pixels[(y - 1) * pas + x - canaux] : 0;
      const pa = Math.abs(h - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + h - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? h : c;
      pixels[y * pas + x] = (v + [0, a, h, (a + h) >> 1, paeth][filtre]) & 255;
    }
  }
  return { largeur, hauteur, canaux, pixels };
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const PAGE = hex(COULEURS_VIDEO.page);
const ENCRE = hex(COULEURS_VIDEO.ecriture);

/** Pixels qui ne sont pas la page, dans un rectangle ; et pixels proches de l'écriture. */
function compter(img: ReturnType<typeof lirePng>, r: { x: number; y: number; largeur: number; hauteur: number }) {
  let autres = 0;
  let encre = 0;
  for (let y = Math.max(0, r.y); y < Math.min(img.hauteur, r.y + r.hauteur); y++) {
    for (let x = Math.max(0, r.x); x < Math.min(img.largeur, r.x + r.largeur); x++) {
      const i = (y * img.largeur + x) * img.canaux;
      const px = [img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]];
      if (px.some((v, k) => Math.abs(v - PAGE[k]) > 2)) autres++;
      if (px.every((v, k) => Math.abs(v - ENCRE[k]) < 40)) encre++;
    }
  }
  return { autres, encre };
}

const erreur = scenesExemple(ficheErreurCorrigee, { e06: ["questions"] });
const question = scenesExemple(ficheQuestionAbonne);
const CAS: { nom: string; id: string; p: ProprietesTableauScene }[] = [
  { nom: "erreur-corrigee-s01", id: "TableauScene", p: erreur[0] },
  { nom: "erreur-corrigee-s03-nouvelle-page", id: "TableauScene", p: erreur[2] },
  { nom: "erreur-corrigee-s04-suite-de-page", id: "TableauScene", p: erreur[3] },
  { nom: "question-abonne-s05-preuve", id: "TableauScene", p: question[4] },
  { nom: "defaut-scene", id: "TableauScene", p: SCENE_EXEMPLE },
  { nom: "defaut-ligne", id: "TableauLigneEcrite", p: LIGNE_EXEMPLE },
  { nom: "defaut-bulle", id: "TableauBullePreuve", p: BULLE_EXEMPLE },
];

const debut = Date.now();
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu/compositions/index.ts") });
const echecs: string[] = [];
for (const c of CAS) {
  const inputProps = c.p as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: c.id, inputProps, ...reglages });
  const n = imagesScene(c.p);
  if (composition.durationInFrames !== n || composition.width !== 1080 || composition.height !== 1920 || composition.fps !== 25) echecs.push(`${c.nom} : métadonnées ${composition.width}×${composition.height}, ${composition.fps} i/s, ${composition.durationInFrames} images (attendu ${n})`);
  const images = [0, Math.floor((n - 1) / 2), n - 1];
  for (const [k, frame] of images.entries()) {
    const fichier = join(sortie, `${c.nom}-${["premiere", "milieu", "derniere"][k]}.png`);
    await renderStill({ composition, serveUrl, output: fichier, frame, inputProps, imageFormat: "png", ...reglages });
    const img = lirePng(fichier);
    const bande = compter(img, c.p.bandeSousTitres.px);
    if (bande.autres) echecs.push(`${c.nom} image ${frame} : ${bande.autres} pixels dans la bande des sous-titres`);
    // Sous la bande aussi (bas de l'image) : rien.
    const dessous = compter(img, { x: 0, y: c.p.bandeSousTitres.px.y, largeur: 1080, hauteur: 1920 - c.p.bandeSousTitres.px.y });
    if (dessous.autres) echecs.push(`${c.nom} image ${frame} : ${dessous.autres} pixels sous le haut de la bande`);
    if (k === 0 && c.p.scene.premiere) {
      const accroche = c.p.page.elements.find((e) => e.sceneId === c.p.scene.id && e.type === "ligne")!;
      const { encre } = compter(img, accroche.px);
      if (encre < 500) echecs.push(`${c.nom} : accroche invisible à la première image (${encre} pixels d'encre)`);
      else console.log(`${c.nom} : accroche visible à la première image (${encre} pixels d'encre)`);
    }
  }
  // Déterminisme : l'image du milieu rendue deux fois.
  const a = join(sortie, `${c.nom}-milieu.png`);
  const b = join(sortie, `.${c.nom}-milieu-bis.png`);
  await renderStill({ composition, serveUrl, output: b, frame: images[1], inputProps, imageFormat: "png", ...reglages });
  if (!readFileSync(a).equals(readFileSync(b))) echecs.push(`${c.nom} : deux rendus de l'image ${images[1]} diffèrent`);
  console.log(`${c.nom} : ${n} images, rendues ${images.join(", ")}`);
}
console.log(`Durée : ${((Date.now() - debut) / 1000).toFixed(1)} s · images dans ${sortie}`);
if (echecs.length) {
  console.error(`ÉCHECS (${echecs.length}) :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log("Tous les contrôles d'image passent.");
