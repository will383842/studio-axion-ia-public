/**
 * Lecture d'un fichier déposé par la chaîne en fond, SANS session.
 *
 * Réservé à la chaîne en fond (l'id vient des entrées de la vidéo, posées au dépôt sous session). Ne jamais importer depuis
 * une action serveur, une route ou un composant : sans session, cette fonction ne doit jamais devenir une porte pour l'interface.
 *
 * Elle recopie EXACTEMENT les contrôles de `fichierEnvoye` (services/fichiers.ts), sauf `exigerSession()` qui lit `cookies()`
 * et lève hors d'une requête (boucle de fond, route des crochets) :
 * - id au format `f-…` ; fichier lu au dépôt ; origine « depot » ; clé de stockage présente dont le 3e segment est le type attendu ;
 * - statut « pret » ; mêmes erreurs (`FICHIER_INCONNU`, `ENVOI_INCOMPLET`).
 * Le type est fixé à « entree » : la chaîne ne lit que le dossier posé comme entrée de la vidéo.
 */
import "server-only";
import { depots } from "@/donnees/memoire";
import type { Fichier } from "@/domaine/types";
import { ErreurStudio } from "./_commun";

export async function fichierDepotSansSession(id: unknown, typeEntite: "entree"): Promise<Fichier> {
  const f = typeof id === "string" && /^f-[A-Za-z0-9_-]{1,40}$/.test(id) ? await depots().fichiers.obtenir(id) : null;
  if (!f || f.origine !== "depot" || !f.cleStockage || f.cleStockage.split("/")[2] !== typeEntite) {
    throw new ErreurStudio("FICHIER_INCONNU", "Ce fichier n'est pas arrivé. Envoyez-le à nouveau.");
  }
  if (f.statut !== "pret") throw new ErreurStudio("ENVOI_INCOMPLET", "Le fichier n'est pas encore arrivé. Réessayez dans un instant.");
  return f;
}
