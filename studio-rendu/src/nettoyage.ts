/**
 * Audit D (fichiers temporaires de `studio-rendu`) : chaque rendu travaille dans un dossier `mkdtemp`, effacé dans
 * `finally`. Un processus TUÉ (manque de mémoire à 3 Go, SIGKILL après le délai d'arrêt) ne passe pas par `finally` :
 * ses dossiers restaient dans la couche du conteneur (jusqu'à 4 Go par entrée). Au démarrage, AVANT toute demande et
 * avant la préparation des compositions, les dossiers laissés par un processus précédent sont effacés.
 * Seuls les dossiers temporaires du rendu (préfixes ci-dessous, dans le dossier temporaire du système) sont visés :
 * ce conteneur est SANS ÉTAT, aucune donnée n'y vit.
 */
import { readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `studio-rendu-` : nos dossiers (`files.ts`) ; `remotion-` / `react-motion-` : ceux de Remotion (images, paquets) ;
 * `puppeteer_dev_chrome_profile-` : profils Chrome de Remotion (jusqu'à 15 Go chacun après un arrêt brutal, essai du 25/11).
 */
export const PREFIXES_TEMPORAIRES = ["studio-rendu-", "remotion-", "react-motion-", "puppeteer_dev_chrome_profile-"] as const;

/**
 * Âge minimal (date de modification du dossier) avant effacement : 6 h. Essai du 25/11 : un autre rendu vivant de la
 * même machine voyait ses dossiers effacés au démarrage de celui-ci. Un montage dure au plus 20 min : 6 h est large. Limite connue : le paquet `remotion-webpack-bundle-*` d'une AUTRE instance vivante depuis plus de 6 h serait effacé (son mtime reste celui de sa création) ; sans effet en production (un seul conteneur).
 */
export const AGE_MINIMAL_ORPHELIN_MS = 6 * 3600_000;

/** Efface les dossiers temporaires orphelins (plus vieux que `ageMinimalMs`). Renvoie les noms effacés. Une erreur n'empêche jamais le démarrage. */
export async function nettoyerTemporairesOrphelins(dossier: string = tmpdir(), options: { ageMinimalMs?: number; maintenant?: () => number } = {}): Promise<string[]> {
  const age = options.ageMinimalMs ?? AGE_MINIMAL_ORPHELIN_MS;
  const maintenant = options.maintenant?.() ?? Date.now();
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
      const { mtimeMs } = await stat(join(dossier, nom));
      if (maintenant - mtimeMs < age) continue;
      await rm(join(dossier, nom), { recursive: true, force: true });
      effaces.push(nom);
    } catch {
      // Fichier d'un autre utilisateur, disque en lecture seule, dossier disparu entre-temps : on continue.
    }
  }
  return effaces;
}
