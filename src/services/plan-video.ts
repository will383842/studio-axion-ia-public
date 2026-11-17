/**
 * L4-14 : une vidéo programmée par l'envoi réel entre UNE fois au calendrier du plan éditorial.
 * Isolation : dépôt passé en paramètre, aucun fournisseur, aucun réseau, aucun appel vers le diffuseur. Ce module ne fait
 * qu'écrire une ligne du plan : il ne publie rien et ne déclenche aucun envoi (aucun envoi ne lit un créneau de vidéo).
 * Un créneau par vidéo et par jour de Paris ; le même créneau est retrouvé à chaque rejeu (identifiant déterministe).
 * Le statut du créneau suit celui de la publication (correspondance du plan) : jamais « programme » avant que le diffuseur
 * ne l'ait dit. Un brouillon chez le diffuseur reste donc « propose » au plan.
 */
import "server-only";
import type { Depot } from "@/domaine/depots";
import { statutPlanDepuisPublication } from "@/domaine/plan-editorial/correspondances";
import { validerCreneau } from "@/domaine/plan-editorial/statuts";
import type { Publication } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import type { CreneauPlan } from "@/services/plan-editorial";
import { sousVerrou } from "./_commun";

/** Identifiant déterministe : jamais le préfixe « cmd- » (réservé aux commandes de l'usine). */
export function idCreneauVideo(videoId: string, jour: string): string {
  return `vid-${videoId}-${jour}`;
}

/**
 * Inscrit au plan les publications de vidéo CONFIRMÉES par le diffuseur (« envoye »). Idempotent : un rejeu ne crée rien
 * et ne réécrit rien. Un créneau archivé ou publié n'est jamais rouvert ni modifié ; un créneau du plan qui porte déjà
 * cette vidéo, ce jour et ce réseau (quel que soit son identifiant) suffit : rien n'est écrit en double.
 */
export async function inscrireVideoAuCalendrier(creneaux: Depot<CreneauPlan>, publications: Publication[]): Promise<CreneauPlan[]> {
  const ecrits: CreneauPlan[] = [];
  for (const p of publications) {
    if (p.etatEnvoi !== "envoye" || !p.videoId || !p.date) continue;
    const t = Date.parse(p.date);
    if (Number.isNaN(t)) continue;
    const instant = new Date(t).toISOString();
    const jour = cleJour(instant);
    const deja = await creneaux.trouver((c) => c.videoId === p.videoId && c.jourVise === jour && c.statut !== "archive" && Boolean(c.heuresParReseau[p.reseau]));
    if (deja) continue;
    const id = idCreneauVideo(p.videoId, jour);
    const existant = await creneaux.obtenir(id);
    let suite: CreneauPlan;
    if (!existant) {
      suite = { id, jourVise: jour, heuresParReseau: { [p.reseau]: instant }, compteCible: p.canalId ?? p.canalNom ?? p.reseau, videoId: p.videoId, statut: statutPlanDepuisPublication(p.statut), decalages: 0, origine: "vous" };
    } else if (existant.statut !== "archive" && existant.statut !== "publie" && existant.videoId === p.videoId) {
      suite = { ...existant, heuresParReseau: { ...existant.heuresParReseau, [p.reseau]: instant } };
    } else continue;
    if (validerCreneau(suite).length) continue;
    ecrits.push(await creneaux.enregistrer(suite));
  }
  return ecrits;
}

/**
 * Crochet de `envoyerReel` : n'échoue jamais (même la lecture du dépôt est dans la protection). Une panne du plan ne change
 * rien à l'envoi déjà fait. Lecture et écriture sous le verrou commun : deux envois parallèles ne s'écrasent pas.
 */
export async function inscrireSansRisque(lireDepot: () => Depot<CreneauPlan>, publications: Publication[]): Promise<void> {
  try {
    await sousVerrou(() => inscrireVideoAuCalendrier(lireDepot(), publications));
  } catch (e) {
    console.error("[studio] inscription au calendrier en échec", e instanceof Error ? e.name : "erreur");
  }
}
