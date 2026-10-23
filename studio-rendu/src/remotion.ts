/**
 * Remotion dans `studio-rendu` : le paquet des compositions est construit UNE fois par processus (puis gardé),
 * les rendus utilisent le navigateur sans affichage de Remotion (installé dans l'image).
 * Chargé à la demande : le serveur et les files se testent sans Remotion.
 */
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Racine du paquet (depuis `src/` avec tsx, ou depuis `dist/src/` une fois construit). */
export function racinePaquet(): string {
  const ici = dirname(fileURLToPath(import.meta.url));
  const parent = resolve(ici, "..");
  return basename(parent) === "dist" ? resolve(parent, "..") : parent;
}

let paquet: Promise<string> | null = null;

/** Adresse du paquet des compositions (construit à la première demande). */
export function paquetCompositions(): Promise<string> {
  if (!paquet) {
    paquet = import("@remotion/bundler").then(({ bundle }) => bundle({ entryPoint: resolve(racinePaquet(), "compositions", "index.ts") }));
    // Un échec de construction ne reste pas en cache : la demande suivante réessaie.
    paquet.catch(() => {
      paquet = null;
    });
  }
  return paquet;
}

/**
 * Cœurs réellement disponibles pour le conteneur : le quota du groupe de contrôle (`/sys/fs/cgroup/cpu.max`, ce que
 * fixe `cpus:` dans le compose) s'il existe, sinon le nombre de processeurs vus par Node. PUR (lecture injectée).
 */
export function coeursDisponibles(lire: (chemin: string) => string | null = lireSiPossible, parallelisme: number = availableParallelism()): number {
  const quota = lire("/sys/fs/cgroup/cpu.max")?.trim().split(/\s+/);
  if (quota && quota[0] !== "max") {
    const [q, periode] = quota.map(Number);
    if (q > 0 && periode > 0) return Math.max(1, Math.min(parallelisme, Math.floor(q / periode)));
  }
  return Math.max(1, parallelisme);
}

function lireSiPossible(chemin: string): string | null {
  try {
    return readFileSync(chemin, "utf8");
  } catch {
    return null;
  }
}

/**
 * Pages du navigateur en parallèle (lot M4b) : la moitié des cœurs disponibles, de 1 à 4 (au-delà, le navigateur
 * ne va plus plus vite et la mémoire monte) ; `STUDIO_RENDU_CONCURRENCE` l'impose. Le serveur héberge aussi le site :
 * le conteneur tourne en priorité basse (`nice`, `cpu_shares`), il ne prend que les cœurs laissés libres.
 */
export function concurrenceRendu(env: Record<string, string | undefined> = process.env, coeurs: number = coeursDisponibles()): number {
  const impose = Number(env.STUDIO_RENDU_CONCURRENCE);
  if (Number.isFinite(impose) && impose >= 1) return Math.floor(impose);
  return Math.max(1, Math.min(4, Math.floor(coeurs / 2)));
}

/**
 * Cache des images vidéo de Remotion, BORNÉ (essai réel du 18/10 : « Compositor exited with signal SIGKILL » à 99 %, conteneur
 * à 2,9 Go sur 3 Go). Sans borne, Remotion en prend la moitié de la mémoire de la MACHINE (15 Go), pas celle du conteneur.
 */
export const CACHE_VIDEO_RENDU_OCTETS = 400 * 1024 * 1024;

/** Réglages communs des rendus Remotion. */
export const REGLAGES_RENDU = {
  concurrency: concurrenceRendu(),
  chromiumOptions: { gl: "swangle" as const },
};
