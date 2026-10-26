/**
 * VARIÉTÉ DU TABLEAU ANIMÉ, CÔTÉ STUDIO. Historique des styles (réglage `tableau.historiqueStyles`, lu et écrit comme
 * `casConcret.historiqueTirages`) : une ligne par vidéo, 42 au plus. Ne publie rien, ne dépense rien. Une lecture
 * illisible vaut « rien » (jamais d'exception vers le découpage).
 */
import "server-only";
import { ajouterAHistoriqueStyles, lireHistoriqueStyles, type EntreeHistoriqueStyle } from "@/moteurs/montage-tableau/tirage-style";
import { ecrireParametre, lireParametre } from "./_commun";

export const CLE_HISTORIQUE_STYLES = "tableau.historiqueStyles";

/** Les dernières lignes de l'historique, de la plus ancienne à la plus récente. */
export async function historiqueStylesTableau(): Promise<EntreeHistoriqueStyle[]> {
  return lireHistoriqueStyles(await lireParametre<unknown>(CLE_HISTORIQUE_STYLES, []));
}

/** Note le style d'une vidéo (remplace sa ligne précédente). */
export async function noterStyleTableau(entree: EntreeHistoriqueStyle): Promise<void> {
  await ecrireParametre(CLE_HISTORIQUE_STYLES, ajouterAHistoriqueStyles(await historiqueStylesTableau(), entree));
}
