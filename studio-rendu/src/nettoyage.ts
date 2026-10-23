/**
 * Audit D (fichiers temporaires de `studio-rendu`) : chaque rendu travaille dans un dossier `mkdtemp`, effacé dans
 * `finally`. Un processus TUÉ (manque de mémoire à 3 Go, SIGKILL après le délai d'arrêt) ne passe pas par `finally` :
 * ses dossiers restaient dans la couche du conteneur (jusqu'à 4 Go par entrée). Au démarrage, AVANT toute demande et
 * avant la préparation des compositions, les dossiers laissés par un processus précédent sont effacés.
 * Seuls les dossiers temporaires du rendu (préfixes ci-dessous, dans le dossier temporaire du système) sont visés :
 * ce conteneur est SANS ÉTAT, aucune donnée n'y vit.
 */
import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** `studio-rendu-` : nos dossiers (`files.ts`) ; `remotion-` / `react-motion-` : ceux de Remotion (images, paquets). */
export const PREFIXES_TEMPORAIRES = ["studio-rendu-", "remotion-", "react-motion-"] as const;

/** Efface les dossiers temporaires orphelins. Renvoie les noms effacés. Une erreur n'empêche jamais le démarrage. */
export async function nettoyerTemporairesOrphelins(dossier: string = tmpdir()): Promise<string[]> {
  let entrees: string[];
  try {
    entrees = await readdir(dossier);
  } catch {
    return [];
  }
  const effaces: string[] = [];
  for (const nom of entrees) {
    if (!PREFIXES_TEMPORAIRES.some((p) => nom.startsWith(p))) continue;
    try {
      await rm(join(dossier, nom), { recursive: true, force: true });
      effaces.push(nom);
    } catch {
      // Fichier d'un autre utilisateur, disque en lecture seule : on continue.
    }
  }
  return effaces;
}
