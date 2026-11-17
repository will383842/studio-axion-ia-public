/**
 * L4-14 : une vidéo programmée par l'envoi réel entre UNE fois au calendrier du plan éditorial.
 * Isolation : dépôt passé en paramètre, aucun fournisseur, aucun réseau, aucun appel vers le diffuseur. Ce module ne fait
 * qu'écrire une ligne du plan : il ne publie rien et ne déclenche aucun envoi (le créneau « programme » n'est lu par aucun envoi).
 * Un créneau par vidéo et par jour de Paris ; le même créneau est retrouvé à chaque rejeu (identifiant déterministe).
 */
import "server-only";
import type { Depot } from "@/domaine/depots";
import type { Publication } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import type { CreneauPlan } from "@/services/plan-editorial";

/** Identifiant déterministe : jamais le préfixe « cmd- » (réservé aux commandes de l'usine). */
export function idCreneauVideo(videoId: string, jour: string): string {
  return `vid-${videoId}-${jour}`;
}

/**
 * Inscrit au plan les publications de vidéo CONFIRMÉES par le diffuseur (« envoye »). Idempotent : un rejeu ne crée rien
 * et ne réécrit rien. Un créneau archivé ou publié n'est jamais rouvert ni modifié.
 */
export async function inscrireVideoAuCalendrier(creneaux: Depot<CreneauPlan>, publications: Publication[]): Promise<CreneauPlan[]> {
  const ecrits: CreneauPlan[] = [];
  for (const p of publications) {
    if (p.etatEnvoi !== "envoye" || !p.videoId || !p.date) continue;
    const jour = cleJour(p.date);
    const id = idCreneauVideo(p.videoId, jour);
    const existant = await creneaux.obtenir(id);
    if (!existant) {
      ecrits.push(await creneaux.enregistrer({
        id, jourVise: jour, heuresParReseau: { [p.reseau]: p.date }, compteCible: p.canalId ?? p.canalNom ?? p.reseau,
        videoId: p.videoId, statut: "programme", decalages: 0, origine: "vous",
      }));
    } else if ((existant.statut === "programme" || existant.statut === "valide") && existant.videoId === p.videoId && !existant.heuresParReseau[p.reseau]) {
      ecrits.push(await creneaux.enregistrer({ ...existant, heuresParReseau: { ...existant.heuresParReseau, [p.reseau]: p.date } }));
    }
  }
  return ecrits;
}

/** Crochet de `envoyerReel` : n'échoue jamais. Une panne du plan ne change rien à l'envoi déjà fait. */
export async function inscrireSansRisque(creneaux: Depot<CreneauPlan>, publications: Publication[]): Promise<void> {
  try {
    await inscrireVideoAuCalendrier(creneaux, publications);
  } catch (e) {
    console.error("[studio] inscription au calendrier en échec", e instanceof Error ? e.name : "erreur");
  }
}
