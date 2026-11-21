/**
 * Planche des teintes sur une VRAIE prise (TEINTES-PLANCHE-a, outil local, lancé à la main).
 * Usage : pnpm exec tsx outils/planche-teintes/planche.mts --image <prise.jpg> --sortie <planche.jpg>
 * L'image ET la sortie doivent être HORS du dépôt (refus sinon). Une tuile « sans teinte » + une par teinte du Studio.
 * Rien n'est écrit dans le dépôt, rien n'est téléchargé ; ffmpeg doit être installé.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ecrireCube, melangerAvecIdentite } from "../../src/lib/qc-lut";
import { lireCube } from "../../src/lib/lut3d";
import { argumentsFfmpegPlanche, lireArgumentsPlanche, nomCubeMelange, teintesDeLaPlanche } from "./planche-teintes";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const POLICE = join(RACINE, "src", "briques", "sous-titres", "polices", "Manrope-SemiBold.ttf");

/** Fabrique la planche (écrit dans un dossier temporaire HORS dépôt, puis `sortie`). Lève une erreur claire sinon. */
export function fabriquerPlanche(image: string, sortie: string): void {
  const teintes = teintesDeLaPlanche();
  const tmp = mkdtempSync(join(tmpdir(), "planche-teintes-"));
  try {
    teintes.forEach((t, i) => {
      if (!t.fichier) return;
      const lut = lireCube(readFileSync(join(RACINE, "public", "luts", t.fichier), "utf8"));
      writeFileSync(join(tmp, nomCubeMelange(i)), ecrireCube(t.intensite >= 1 ? lut : melangerAvecIdentite(lut, t.intensite)));
    });
    mkdirSync(dirname(sortie), { recursive: true });
    execFileSync("ffmpeg", argumentsFfmpegPlanche(image, sortie, teintes, POLICE), { cwd: tmp, stdio: ["ignore", "ignore", "pipe"] });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function main(): void {
  const lu = lireArgumentsPlanche(process.argv.slice(2), RACINE, existsSync);
  if (!lu.ok) {
    console.error(`${lu.erreur}\nUsage : pnpm exec tsx outils/planche-teintes/planche.mts --image <prise> --sortie <planche.jpg>`);
    process.exit(1);
  }
  try {
    fabriquerPlanche(lu.image, lu.sortie);
  } catch (e) {
    console.error(`Planche impossible (ffmpeg absent ou image illisible) : ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(`Planche écrite : ${lu.sortie}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
