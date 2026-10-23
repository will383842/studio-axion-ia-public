/**
 * L10 · RENDU FIDÈLE À LA PROD : images fixes de la galerie « Image → vidéo » rendues depuis un paquet `studio-rendu`
 * construit COMME LA PROD, sinon elles ne prouvent rien (I8).
 *
 * 1. Recopie, dans un dossier de travail, exactement ce que copie `deploiement/studio-rendu/Dockerfile` (lignes
 *    `COPY` lues dans le fichier, même disposition `/app/studio-rendu` + `/app/src/...`).
 * 2. `npm ci --omit=dev` (NODE_ENV=production, sans NODE_PATH) : SANS typescript — vérifié dans le paquet ET par
 *    résolution depuis `@remotion/bundler`, sinon arrêt (la machine cloud expose un typescript global par NODE_PATH :
 *    il suffit à faire lire le tsconfig, donc à compiler le JSX en mode automatique, et le banc ne prouverait rien).
 *    Sans typescript, le JSX est compilé en JSX classique et `React` n'est posé qu'après le chargement des
 *    compositions : un JSX de niveau module LU au chargement, sans import React, casse le rendu, comme en prod.
 * 3. Liste les fichiers que les compositions (toutes, depuis L17) importent et que le Dockerfile ne copie pas (ils
 *    manqueraient en prod) ; les ajoute pour pouvoir rendre (`--strict` : arrêt à la place).
 * 4. Remplace l'entrée `compositions/index.ts` de la copie par une entrée qui inscrit `Racine` (toute la prod, dont les
 *    compositions « Image → vidéo » depuis L17) PLUS les planches de micro-objets, puis rend avec les fonctions de prod
 *    (`paquetCompositions`, `REGLAGES_RENDU` de `studio-rendu/src/remotion.ts`), lancées par le `tsx` du paquet.
 *
 * 5. Rend TOUTES les galeries (C, D/E/F ; A, B, objets de L9a ; micro-objets de L9b) en JPEG dans `galerie/`,
 *    `galerie-l9a/`, `galerie-micro-objets/`, puis une planche par galerie et la planche récapitulative.
 *
 * Aucune opération nouvelle du serveur de rendu, aucune mise en ligne, aucun appel payant. L'extraction d'images du
 * fichier final reste l'opération existante `controle` / `etape: "images"`.
 *
 * Usage (routine cloud) :
 *   pnpm tsx scripts/image-video/galerie-prod.ts [--sortie docs/formats/image-video] [--travail <dossier>]
 *        [--navigateur <chemin de chrome-headless-shell>] [--strict] [--piege] [--toutes]
 *   Avant les galeries, TOUTES les compositions de la Racine de prod sont rendues (image 0, propriétés par défaut) :
 *   « React is not defined » sur l'une d'elles arrête tout (code 3).
 *   `--toutes` : seulement ce passage sur toutes les compositions (aucune galerie, aucune planche).
 *   `--piege` : ajoute un fichier piège (JSX de niveau module sans import React) ; le rendu DOIT casser.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const RACINE = resolve(import.meta.dirname, "../..");

/**
 * Environnement de la prod (`NODE_ENV=production`) SANS `NODE_PATH` : l'image de prod n'a aucun module global, alors
 * que la machine cloud en expose (dont typescript) par `NODE_PATH`.
 */
const ENV_PROD = Object.fromEntries(Object.entries({ ...process.env, NODE_ENV: "production" }).filter(([k]) => k !== "NODE_PATH")) as NodeJS.ProcessEnv;

function option(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const drapeau = (nom: string) => process.argv.includes(`--${nom}`);

/** Une copie du Dockerfile : sources (relatives à la racine du dépôt) → destination dans l'image. */
export type CopieDockerfile = { sources: string[]; destination: string };

/** Lit les `COPY` du Dockerfile (hors `--from=`), avec le `WORKDIR` courant pour les destinations relatives. PUR. */
export function copiesDuDockerfile(texte: string): CopieDockerfile[] {
  const copies: CopieDockerfile[] = [];
  let workdir = "/";
  for (const brute of texte.split("\n")) {
    const ligne = brute.trim();
    if (/^WORKDIR\s+/i.test(ligne)) workdir = ligne.split(/\s+/)[1];
    if (!/^COPY\s+/i.test(ligne)) continue;
    const mots = ligne.split(/\s+/).slice(1);
    if (mots.some((m) => m.startsWith("--from="))) continue;
    const args = mots.filter((m) => !m.startsWith("--"));
    const destination = args[args.length - 1];
    copies.push({ sources: args.slice(0, -1), destination: destination.startsWith("/") ? destination : join(workdir, destination) });
  }
  return copies;
}

/** Recopie les sources dans `travail` (qui joue `/app`), comme `COPY` (un dossier copie son contenu). */
function appliquerCopies(copies: CopieDockerfile[], travail: string) {
  for (const c of copies) {
    const dest = join(travail, relative("/app", c.destination));
    for (const src of c.sources) {
      const s = join(RACINE, src);
      if (!existsSync(s)) throw new Error(`Le Dockerfile copie ${src}, introuvable dans le dépôt.`);
      if (statSync(s).isDirectory()) cpSync(s, dest, { recursive: true });
      else {
        const cible = c.destination.endsWith("/") ? join(dest, src.split("/").pop()!) : dest;
        mkdirSync(dirname(cible), { recursive: true });
        cpSync(s, cible);
      }
    }
  }
}

const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/**
 * Fichiers du dépôt (chemins relatifs à la racine) atteints par imports RELATIFS depuis `departs`, de proche en proche
 * (`import type` compris : le typage du paquet, `npm run verifier`, les lit aussi). Trié.
 */
export function fichiersImportes(departs: string[]): string[] {
  const vus = new Set<string>();
  const atteints = new Set<string>();
  const pile = [...departs];
  while (pile.length) {
    const f = pile.pop()!;
    if (vus.has(f)) continue;
    vus.add(f);
    const texte = readFileSync(f, "utf8");
    for (const m of texte.matchAll(/(?:import|export)\s[^;]*?from\s*["'](\.[^"']+)["']|import\s*["'](\.[^"']+)["']/g)) {
      const spec = m[1] ?? m[2];
      const base = resolve(dirname(f), spec);
      const trouve = EXTENSIONS.map((e) => base + e).find((x) => existsSync(x) && statSync(x).isFile());
      if (!trouve) continue;
      if (!/\.(ts|tsx)$/.test(trouve)) continue;
      atteints.add(relative(RACINE, trouve));
      pile.push(trouve);
    }
  }
  return [...atteints].sort();
}

/** Les `.ts` / `.tsx` d'un dossier du dépôt (sous-dossiers compris), en chemins absolus, triés. */
export function sourcesDuDossier(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .sort()
    .map((f) => join(RACINE, dossier, f));
}

/** Fichiers importés depuis `departs` et absents de la copie : ils manqueraient en prod. */
function manquants(departs: string[], travail: string): string[] {
  return fichiersImportes(departs).filter((rel) => !existsSync(join(travail, rel)));
}

const ENTREE = `import React from "react";
/**
 * Entrée de la galerie (copie de travail SEULEMENT) : toute la prod (Racine, qui inscrit les compositions « Image → vidéo »
 * depuis L17) + les planches de micro-objets (outil de galerie, jamais en prod).
 */
import { registerRoot } from "remotion";
import { Racine } from "./Racine";
import { CompositionsMicroObjets } from "./image-video/MicroObjet";
__PIEGE_IMPORT__
function RacineGalerie() {
  return React.createElement(React.Fragment, null, React.createElement(Racine), React.createElement(CompositionsMicroObjets));
}
registerRoot(RacineGalerie);
`;

const PIEGE = `/** PIÈGE (copie de travail seulement) : JSX évalué au niveau module, SANS import React. Le rendu de prod doit casser. */
export const PIEGE_IV = <div>piège</div>;
`;

const RENDRE = `/** Rendu des images fixes avec les fonctions de PROD (paquetCompositions, REGLAGES_RENDU). Lancé par le tsx du paquet. */
import { getCompositions, renderStill, selectComposition } from "@remotion/renderer";
import { paquetCompositions, REGLAGES_RENDU } from "./src/remotion";
import { INSTANTS_GALERIE_C, sceneGalerieC } from "./compositions/image-video/donnees-galerie";
import { INSTANTS_GALERIE_OBJETS, SCENES_GALERIE_OBJETS } from "./compositions/image-video/donnees-galerie-objets";
import { galerieA, galerieB, galerieObjets, INSTANTS_GALERIE_L9A } from "./compositions/image-video/donnees-galerie-l9a";
import { COMPOSITIONS_MICRO_OBJETS, instantsGalerieMicro, proprietesGalerieMicro } from "./compositions/image-video/donnees-galerie-micro";

const [racine, navigateur, mode] = process.argv.slice(2);
const serveUrl = await paquetCompositions();
const commun = { browserExecutable: navigateur || null, chromiumOptions: REGLAGES_RENDU.chromiumOptions };

// L17 : TOUTES les compositions inscrites (Racine de prod entière, pas seulement « Image → vidéo »), une image chacune,
// propriétés par défaut. « React is not defined » sur l'une d'elles = la prod casse : arrêt (code 3).
const toutes = await getCompositions(serveUrl, { ...commun });
console.log(\`\${toutes.length} compositions inscrites.\`);
if (!toutes.some((c) => c.id === "ImageVideoScene")) {
  console.error("ImageVideoScene absente de la Racine : le raccord L17 manque.");
  process.exit(4);
}
const casses: string[] = [];
const autres: string[] = [];
for (const composition of toutes) {
  try {
    await renderStill({ serveUrl, composition, inputProps: composition.defaultProps, frame: 0, output: \`toutes-compositions/\${composition.id}.jpg\`, imageFormat: "jpeg", jpegQuality: 60, ...commun });
    console.log(\`  ok  \${composition.id}\`);
  } catch (e) {
    const message = String((e as Error)?.message ?? e).split("\\n")[0];
    (/React is not defined/.test(message) ? casses : autres).push(\`\${composition.id} : \${message}\`);
    console.log(\`  ÉCHEC  \${composition.id} : \${message}\`);
  }
}
if (autres.length) console.log(\`\\n\${autres.length} composition(s) en échec pour une autre raison (propriétés par défaut vides ?) :\\n\${autres.join("\\n")}\`);
if (casses.length) {
  console.error(\`\\n« React is not defined » sur \${casses.length} composition(s) : la prod casserait.\\n\${casses.join("\\n")}\`);
  process.exit(3);
}
console.log(\`Toutes les compositions : aucune « React is not defined » (\${toutes.length - autres.length}/\${toutes.length} rendues).\`);
if (mode === "toutes") process.exit(0);
/** Une galerie : la composition, ses propriétés, ses instants, le dossier et le préfixe des fichiers (JPEG 92). */
async function rendre(id: string, inputProps: Record<string, unknown>, instants: readonly { nom: string; t: number }[], dossier: string, prefixe = "") {
  const composition = await selectComposition({ serveUrl, id, inputProps, ...commun });
  for (const i of instants) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(i.t * composition.fps));
    await renderStill({ serveUrl, composition, inputProps, frame, output: \`\${racine}/\${dossier}/\${prefixe}\${i.nom}.jpg\`, imageFormat: "jpeg", jpegQuality: 92, ...commun });
    console.log(\`\${dossier}/\${prefixe}\${i.nom} (t = \${i.t} s, image \${frame}) rendue\`);
  }
}
// L7 : image C (scène continue) ; L8 : objets des images D, E, F.
await rendre("ImageVideoGalerie", sceneGalerieC(), INSTANTS_GALERIE_C, "galerie", "C-");
for (const [image, instants] of Object.entries(INSTANTS_GALERIE_OBJETS)) await rendre(\`ImageVideoGalerie\${image}\`, SCENES_GALERIE_OBJETS[image as keyof typeof SCENES_GALERIE_OBJETS](), instants, "galerie");
// L9a : composants des images A, B, et objets de C et E.
await rendre("ImageVideoGalerieA", galerieA(), INSTANTS_GALERIE_L9A.A, "galerie-l9a", "A-");
await rendre("ImageVideoGalerieB", galerieB(), INSTANTS_GALERIE_L9A.B, "galerie-l9a", "B-");
await rendre("ImageVideoGalerieObjets", galerieObjets(), INSTANTS_GALERIE_L9A.objets, "galerie-l9a", "objets-");
// L9b : micro-objets (images A, B, et la banque entière).
for (const liste of ["A", "B", "banque"] as const) await rendre(COMPOSITIONS_MICRO_OBJETS[liste], proprietesGalerieMicro(liste), instantsGalerieMicro(liste), "galerie-micro-objets");
`;

/** Dossiers des galeries (sous la racine de sortie) et titre de leur planche. */
export const GALERIES = Object.freeze([
  { dossier: "galerie", titre: "C (scène continue) · D, E, F (objets)" },
  { dossier: "galerie-l9a", titre: "A, B (bénéfices) · objets de C et E" },
  { dossier: "galerie-micro-objets", titre: "Micro-objets (A, B, banque)" },
]);

/**
 * Planches (ImageMagick `montage`) : une par galerie, et la planche récapitulative de toutes les images, avec le nom de
 * chaque image dessous. Absente (`montage` introuvable) : signalé, rien d'autre ne change.
 */
function planches(racine: string) {
  if (spawnSync("montage", ["-version"]).status !== 0) {
    console.log("montage (ImageMagick) introuvable : planches non faites.");
    return;
  }
  const toutes: string[] = [];
  for (const g of GALERIES) {
    const dossier = join(racine, g.dossier);
    const images = readdirSync(dossier).filter((f) => f.endsWith(".jpg") && !f.startsWith("planche")).sort().map((f) => join(dossier, f));
    toutes.push(...images);
    execFileSync("montage", [...images, "-label", "%t", "-tile", "6x", "-geometry", "360x640+12+12", "-pointsize", "22", "-background", "#efe7dc", "-title", g.titre, join(dossier, "planche.jpg")]);
    console.log(`Planche ${relative(RACINE, join(dossier, "planche.jpg"))}`);
  }
  execFileSync("montage", [...toutes, "-label", "%t", "-tile", "9x", "-geometry", "270x480+8+8", "-pointsize", "16", "-background", "#efe7dc", "-title", "Image → vidéo · toutes les galeries (rendu comme en prod)", "-quality", "86", join(racine, "planche-recapitulative.jpg")]);
  console.log(`Planche récapitulative ${relative(RACINE, join(racine, "planche-recapitulative.jpg"))}`);
}

function principal() {
  const sortie = resolve(RACINE, option("sortie") ?? "docs/formats/image-video");
  const travail = resolve(option("travail") ?? join(tmpdir(), "galerie-prod-iv"));
  const navigateur = option("navigateur") ?? process.env.NAVIGATEUR_REMOTION ?? "";
  const piege = drapeau("piege");

  console.log(`Copie de travail (joue /app) : ${travail}`);
  const garder = join(travail, "studio-rendu/node_modules");
  const cache = join(tmpdir(), "galerie-prod-iv-node_modules");
  const lock = readFileSync(join(RACINE, "studio-rendu/package-lock.json"), "utf8");
  // node_modules gardé entre deux lancements seulement si le verrou n'a pas changé (sinon npm ci repart de zéro).
  const memeVerrou = existsSync(join(travail, "studio-rendu/package-lock.json")) && readFileSync(join(travail, "studio-rendu/package-lock.json"), "utf8") === lock;
  if (memeVerrou && existsSync(garder)) {
    rmSync(cache, { recursive: true, force: true });
    cpSync(garder, cache, { recursive: true, verbatimSymlinks: true });
  }
  rmSync(travail, { recursive: true, force: true });
  mkdirSync(travail, { recursive: true });

  const copies = copiesDuDockerfile(readFileSync(join(RACINE, "deploiement/studio-rendu/Dockerfile"), "utf8"));
  appliquerCopies(copies, travail);
  const paquet = join(travail, "studio-rendu");

  if (memeVerrou && existsSync(cache)) cpSync(cache, garder, { recursive: true, verbatimSymlinks: true });
  else execFileSync("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], { cwd: paquet, stdio: "inherit", env: ENV_PROD });
  // Jamais le cache de webpack d'un lancement précédent : chaque paquet est compilé de zéro, comme dans une image neuve.
  rmSync(join(garder, ".cache"), { recursive: true, force: true });
  if (existsSync(join(paquet, "node_modules/typescript"))) throw new Error("typescript est présent dans le paquet : il ne serait pas construit comme la prod.");
  // Le bundler de Remotion lit le tsconfig (donc compile le JSX en mode automatique) dès que `require.resolve("typescript")`
  // réussit DEPUIS SON DOSSIER : un typescript global (NODE_PATH de la machine cloud) suffit à fausser le banc.
  const resolution = spawnSync(process.execPath, ["-e", "try{require.resolve('typescript',{paths:[require.resolve('@remotion/bundler')]});console.log('trouve')}catch{console.log('absent')}"], { cwd: paquet, env: ENV_PROD, encoding: "utf8" });
  if (resolution.stdout.trim() !== "absent") throw new Error("typescript reste trouvable depuis @remotion/bundler : le banc ne compilerait pas comme la prod.");
  console.log("Paquet construit comme la prod : npm ci --omit=dev, typescript ABSENT et introuvable depuis le bundler.");

  // L17 : toutes les compositions (la Racine de prod les inscrit toutes), sous-dossiers compris.
  const absents = manquants(sourcesDuDossier("studio-rendu/compositions"), travail);
  if (absents.length) {
    console.log(`\nATTENTION — fichiers importés par les compositions que le Dockerfile de prod NE COPIE PAS (à ajouter au raccordement) :\n${absents.map((a) => `  - ${a}`).join("\n")}`);
    if (drapeau("strict")) process.exit(2);
    for (const a of absents) {
      mkdirSync(dirname(join(travail, a)), { recursive: true });
      cpSync(join(RACINE, a), join(travail, a));
    }
    console.log("Ajoutés à la copie de travail pour rendre la galerie.\n");
  }

  // Le piège doit être UTILISÉ : esbuild marque le JSX « pur », un JSX de niveau module jamais lu est retiré du paquet de
  // production (c'est un JSX lu au chargement, comme `TRACES` dans #201, qui casse).
  writeFileSync(join(paquet, "compositions/index.ts"), ENTREE.replace("__PIEGE_IMPORT__", piege ? 'import { PIEGE_IV } from "./image-video/piege-iv";\n(globalThis as Record<string, unknown>).__piegeIV = PIEGE_IV;' : ""));
  if (piege) writeFileSync(join(paquet, "compositions/image-video/piege-iv.tsx"), PIEGE);
  writeFileSync(join(paquet, "rendre-galerie.mts"), RENDRE);

  const sortieRendu = piege ? join(travail, "sortie-piege") : sortie;
  for (const g of GALERIES) mkdirSync(join(sortieRendu, g.dossier), { recursive: true });
  const r = spawnSync(join(paquet, "node_modules/.bin/tsx"), ["rendre-galerie.mts", sortieRendu, navigateur, drapeau("toutes") ? "toutes" : ""], { cwd: paquet, stdio: piege ? "pipe" : "inherit", encoding: "utf8", env: ENV_PROD });
  if (piege) {
    const journal = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    if (r.status === 0) {
      console.error("ÉCHEC : le fichier piège n'a PAS cassé le rendu. Le banc ne voit pas ce que voit la prod.");
      process.exit(1);
    }
    const cause = journal.match(/React is not defined/) ? "React is not defined" : (journal.split("\n").find((l) => /Error/.test(l)) ?? "erreur");
    console.log(`Piège : le rendu casse comme en prod (${cause}). Le banc voit ce que voit la prod.`);
    return;
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
  if (drapeau("toutes")) return;
  planches(sortie);
  console.log(`\nImages fixes déposées dans ${GALERIES.map((g) => `${relative(RACINE, join(sortie, g.dossier))}/`).join(", ")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) principal();
