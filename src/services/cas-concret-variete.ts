/**
 * VARIÉTÉ DU CAS CONCRET, CÔTÉ STUDIO (lot L2). Branche les outils `variete` du moteur sur les réglages du studio :
 *   - historique des 42 derniers tirages : réglage `casConcret.historiqueTirages` (lu et écrit comme
 *     `casConcret.scriptsValides`), une ligne par vidéo, avec ses canaux ;
 *   - mise héritée : celle écrite dans la fiche d'une version précédente de la même vidéo (`projetMontage.casConcret.fiche`).
 * Ne publie rien, ne dépense rien. Les lectures illisibles valent « rien » (jamais d'exception vers la fabrication).
 */
import "server-only";
import type { Id } from "@/domaine/types";
import { ID_MOTEUR_CAS_CONCRET } from "@/moteurs/montage-cas-concret";
import type { OutilsVariete } from "@/moteurs/montage-cas-concret/outils";
import { ajouterAHistorique, lireHistorique, lireMise, type EntreeHistorique, type Mise } from "@/moteurs/montage-cas-concret/variete";
import { depots, ecrireParametre, lireParametre } from "./_commun";

export const CLE_HISTORIQUE_TIRAGES = "casConcret.historiqueTirages";

/** Les dernières lignes de l'historique (au plus 42), de la plus ancienne à la plus récente. */
export async function historiqueTirages(): Promise<EntreeHistorique[]> {
  return lireHistorique(await lireParametre<unknown>(CLE_HISTORIQUE_TIRAGES, []));
}

/** Ajoute (ou remplace) la ligne d'une vidéo ; 42 lignes au plus. */
export async function noterTirage(entree: EntreeHistorique): Promise<void> {
  await ecrireParametre(CLE_HISTORIQUE_TIRAGES, ajouterAHistorique(await historiqueTirages(), entree));
}

const objet = (v: unknown): Record<string, unknown> | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);

/** Mise de la version la plus récente de la vidéo qui en porte une ; `null` : aucune. */
export async function miseHeriteeDe(videoId: Id): Promise<Mise | null> {
  const versions = await depots().versions.lister((v) => v.videoId === videoId && v.commande?.moteurId === ID_MOTEUR_CAS_CONCRET);
  for (const v of versions.sort((a, b) => b.numero - a.numero)) {
    const mise = lireMise(objet(objet(objet(v.projetMontage)?.casConcret)?.fiche)?.mise);
    if (mise) return mise;
  }
  return null;
}

/** Les outils `variete` du moteur, branchés sur le studio. */
export function outilsVarieteDuStudio(): OutilsVariete {
  return { lireHistorique: historiqueTirages, ajouter: noterTirage, miseHeritee: miseHeriteeDe };
}
