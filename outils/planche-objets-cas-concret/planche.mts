/**
 * PLANCHE « PETITS OBJETS DU CAS CONCRET » (PLANCHE-C9-42-v21s). Outil local lancé à la main : 0 €, aucun appel à Claude
 * (plans par règles fixes), rien n'importe ce fichier, rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-objets-cas-concret/planche.mts --navigateur <chemin> [--sortie <dossier>]`
 * (les plans sont calculés par un sous-processus `tsx --conditions=react-server` : `server-only` n'est pas bouchonné dans le dépôt,
 * et Remotion est chargé dans le processus principal, qui n'a pas cette condition).
 * Sortie par défaut : `docs/captures/objets-cas-concret` (jamais ajouté au dépôt) : les PNG `t<n>-<sans|avec>-s<k>-<pièce>.png` + `planche.txt`.
 * Sans `--navigateur` : message et sortie 1 (rien n'est téléchargé).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");

export interface ImagePlanche {
  fichier: string;
  variante: "sans" | "avec";
  texte: number;
  scene: number;
  piece: string;
  image: number;
}
interface PaireTemoin {
  texte: string;
  sans: unknown;
  avec: unknown;
}
interface Temoin {
  lesPaires: () => Promise<PaireTemoin[]>;
  imagesDe: (paires: readonly PaireTemoin[]) => ImagePlanche[];
  objetsMontres: (images: readonly ImagePlanche[]) => string[];
}

/** Le témoin (partie pure seulement), par chemin CALCULÉ : jamais `lancer`, jamais Remotion. */
async function chargerTemoin(): Promise<Temoin> {
  const chemin = [RACINE, "studio-rendu", "scripts", "temoin-objets-cas-concret.ts"].join("/");
  return (await import(/* @vite-ignore */ chemin)) as Temoin;
}

export interface ArgumentsPlanche {
  navigateur: string | undefined;
  sortie: string;
}

/** Lit `--navigateur <chemin>` et `--sortie <dossier>` (dans n'importe quel ordre) ; sortie par défaut `docs/captures/objets-cas-concret`. */
export function lireArguments(args: readonly string[]): ArgumentsPlanche {
  const valeur = (nom: string): string | undefined => {
    const i = args.indexOf(`--${nom}`);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
  };
  return { navigateur: valeur("navigateur"), sortie: resolve(valeur("sortie") ?? join(RACINE, "docs", "captures", "objets-cas-concret")) };
}

/** Les images de la planche : exactement celles du témoin (mêmes noms, mêmes images). */
export async function imagesPlanche(paires: readonly PaireTemoin[]): Promise<ImagePlanche[]> {
  return (await chargerTemoin()).imagesDe(paires);
}

/** Une ligne par image (fichier, texte, scène, pièce), puis « objets montrés : … ». */
export async function rapportPlanche(images: readonly ImagePlanche[]): Promise<string> {
  const lignes = images.map((i) => `${i.fichier} | texte ${i.texte} | ${i.variante} | scène ${i.scene} | ${i.piece}`);
  lignes.push(`objets montrés : ${(await chargerTemoin()).objetsMontres(images).join(", ")}`);
  return lignes.join("\n");
}

type Composition = { width: number; height: number };

/** Sous-processus (condition `react-server`) : écrit les plans, les images et le rapport dans `fichier`. */
async function ecrirePlans(fichier: string): Promise<void> {
  const paires = await (await chargerTemoin()).lesPaires();
  const images = await imagesPlanche(paires);
  writeFileSync(fichier, JSON.stringify({ paires, images, rapport: await rapportPlanche(images) }));
}

async function main(args: readonly string[]): Promise<number> {
  const { navigateur, sortie } = lireArguments(args);
  if (!navigateur) {
    console.error("Il manque --navigateur <chemin du navigateur> : rien n'est téléchargé. Voir l'en-tête de ce fichier.");
    return 1;
  }
  mkdirSync(sortie, { recursive: true });
  const fichierPlans = join(sortie, "plans.json");
  execFileSync("pnpm", ["exec", "tsx", "--conditions=react-server", fileURLToPath(import.meta.url), "--plans", fichierPlans], { cwd: RACINE, stdio: "inherit" });
  const { paires, images, rapport } = JSON.parse(readFileSync(fichierPlans, "utf8")) as { paires: PaireTemoin[]; images: ImagePlanche[]; rapport: string };
  const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
  const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
  const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
    selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown>; browserExecutable?: string | null }) => Promise<Composition>;
    renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string }; browserExecutable?: string | null }) => Promise<unknown>;
  };
  const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu", "compositions", "index.ts") });
  for (const [t, p] of paires.entries()) {
    for (const variante of ["sans", "avec"] as const) {
      const plan = p[variante];
      if (!plan) continue;
      const inputProps = { plan } as Record<string, unknown>;
      const composition = await selectComposition({ serveUrl, id: "PlanDeScenes", inputProps, browserExecutable: navigateur });
      for (const im of images.filter((i) => i.texte === t + 1 && i.variante === variante)) {
        await renderStill({ composition, serveUrl, frame: im.image, output: join(sortie, im.fichier), inputProps, chromiumOptions: { gl: "swangle" }, browserExecutable: navigateur });
        console.log(join(sortie, im.fichier));
      }
    }
  }
  writeFileSync(join(sortie, "planche.txt"), `${rapport}\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const i = process.argv.indexOf("--plans");
  if (i >= 0 && process.argv[i + 1]) await ecrirePlans(resolve(process.argv[i + 1]!));
  else process.exitCode = await main(process.argv.slice(2));
}
