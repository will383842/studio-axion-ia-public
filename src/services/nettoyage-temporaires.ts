/**
 * GV2-22 : purge au démarrage des dossiers temporaires de fabrication (`iv-image-`, `iv-son-`, `iv-final-` et les
 * sous-dossiers de `mini-videos`) laissés par un processus tué avant la fin de son appel. Modèle : l'atelier de rendu
 * (`studio-rendu/src/nettoyage.ts`), recopié et non importé. Ne touche que des dossiers de plus de 24 h situés
 * directement dans le dossier temporaire donné ; ne lève jamais.
 */
import { lstat, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const PREFIXES_FABRICATION = ["iv-image-", "iv-son-", "iv-final-"] as const;
const AGE_MAX_MS = 24 * 3600_000;

async function effacerSiVieux(chemin: string, maintenant: number): Promise<void> {
  try {
    const s = await lstat(chemin);
    if (!s.isDirectory() || maintenant - s.mtimeMs <= AGE_MAX_MS) return;
    await rm(chemin, { recursive: true, force: true });
  } catch {
    // Dossier d'un autre utilisateur, disque en lecture seule, déjà parti : on continue.
  }
}

export async function purgerTemporaires(maintenant: number = Date.now(), racine: string = tmpdir()): Promise<void> {
  try {
    for (const nom of await readdir(racine)) {
      if (PREFIXES_FABRICATION.some((p) => nom.startsWith(p))) await effacerSiVieux(join(racine, nom), maintenant);
    }
    const mini = join(racine, "mini-videos");
    for (const nom of await readdir(mini).catch(() => [] as string[])) await effacerSiVieux(join(mini, nom), maintenant);
  } catch {
    // Jamais d'échec au démarrage.
  }
}
