/**
 * Source des textes du mot GUIDE : le fichier `mots/GUIDE.md`, s'il existe, reste la voie d'un texte propre à l'opérateur
 * (pose chez Zernio). Le parcours de conversation, lui, envoie TOUJOURS les textes du dictionnaire : s'il existe, le fichier
 * fait donc refuser la validation du GUIDE du parcours (voir `gesteValiderMotGuide`). Aucun texte n'est écrit ici.
 */
import "server-only";
import { chargerTextesFichier } from "./mots-service";

export async function guideFichierPresent(): Promise<boolean> {
  return (await chargerTextesFichier("GUIDE")) !== null;
}
