/**
 * MODE DU BUDGET : un seul interrupteur, `budget.mode` = "indicatif" | "bloquant" (décision de Will, 23/10).
 *  - « indicatif » : les montants (plafond du mois, seuil de confirmation, plafonds par vidéo, solde deviné de fal.ai) sont
 *    des REPÈRES. Au-delà, le studio journalise et prévient Will (cloche, une fois par jour et par motif), puis continue.
 *    Seul un arrêt de sécurité (5 × le prix annoncé, par vidéo ou par sujet) arrête encore une fabrication.
 *  - « bloquant » : comportement d'avant, tous les seuils refusent. Retour en arrière : réglage `budget.mode` = "bloquant".
 * Ce qui reste dur dans les DEUX modes : les gardes de l'Usine, le double réel, le solde réel HeyGen / ElevenLabs, les
 * plafonds anti-boucle (retouches, lectures de voix) et l'idempotence des réservations.
 * Le défaut vient du code (`STUDIO_BUDGET_MODE_DEFAUT`, « indicatif » sans variable) ; le réglage en base l'emporte.
 * Un réglage illisible retombe sur le défaut du code. Lu à l'exécution : pas de redémarrage, pas de migration.
 */
import "server-only";
import { depots, lireParametre } from "./_commun";

export type ModeBudget = "indicatif" | "bloquant";
export const CLE_MODE_BUDGET = "budget.mode";

/** Multiple du prix annoncé au-delà duquel une vidéo (ou un sujet) s'arrête, même en mode indicatif. */
export const FACTEUR_SECURITE_BUDGET = 5;

function defautDuCode(): ModeBudget {
  return process.env.STUDIO_BUDGET_MODE_DEFAUT === "bloquant" ? "bloquant" : "indicatif";
}

export async function modeBudget(): Promise<ModeBudget> {
  const v = await lireParametre<unknown>(CLE_MODE_BUDGET, null);
  return v === "indicatif" || v === "bloquant" ? v : defautDuCode();
}

/** Indicatif pour CETTE commande : jamais pour une commande de l'Usine (elle reste bloquante). */
export async function budgetIndicatifPour(origine?: string | null): Promise<boolean> {
  return origine !== "usine" && (await budgetIndicatif());
}

/**
 * Origine d'une vidéo, lue sur sa version la plus récente (`commande.origine`, figée au lancement). Sert aux chemins qui
 * n'ont pas l'origine en main (monteur, face caméra animée, textes) : une vidéo commandée par l'Usine le reste. Illisible : studio.
 */
export async function origineDeLaVideo(videoId: string): Promise<"studio" | "usine"> {
  try {
    const versions = await depots().versions.lister((v) => v.videoId === videoId);
    const derniere = versions.sort((a, b) => b.numero - a.numero)[0];
    return derniere?.commande?.origine === "usine" ? "usine" : "studio";
  } catch {
    // Échec fermé : une origine illisible est traitée comme l'Usine (bloquante), jamais comme une commande de Will.
    return "usine";
  }
}

/**
 * Sujet de la cloche de dépassement : l'identifiant du LOT si la vidéo en fait partie (une cloche par lot), sinon celui de la
 * vidéo. Le même sujet sert aux dépassements Claude et à ceux de la caisse Image -> vidéo : une vidéo ne sonne jamais deux fois.
 */
export async function sujetDeCloche(videoId: string): Promise<string> {
  try {
    const versions = await depots().versions.lister((v) => v.videoId === videoId);
    const derniere = versions.sort((a, b) => b.numero - a.numero)[0];
    const lot = (derniere?.commande?.entrees as { lot?: { id?: unknown; rang?: unknown } } | undefined)?.lot;
    return typeof lot?.id === "string" && lot.id && typeof lot.rang === "number" ? lot.id : videoId;
  } catch {
    return videoId;
  }
}

/** Indicatif pour CETTE vidéo : l'origine donnée l'emporte, sinon celle de sa dernière version ; l'Usine reste bloquante. */
export async function budgetIndicatifPourVideo(videoId: string, origine?: string | null): Promise<boolean> {
  return budgetIndicatifPour(origine ?? (await origineDeLaVideo(videoId)));
}

export async function budgetIndicatif(): Promise<boolean> {
  return (await modeBudget()) === "indicatif";
}

/** Phrase de l'arrêt de sécurité (5 × le prix annoncé) ; `prixAnnonce` : le prix annoncé déjà écrit en euros, s'il est connu. */
export function messageArretSecurite(prixAnnonce?: string): string {
  return `Arrêt de sécurité : cette fabrication dépasserait 5 fois le prix annoncé${prixAnnonce ? ` (${prixAnnonce})` : ""}, rien de plus n'est payé.`;
}
/** Phrase d'un dépassement du budget indicatif : la fabrication continue. */
export function messageAuDelaDuBudgetIndicatif(prixAnnonce?: string): string {
  return `Au-delà du budget indicatif${prixAnnonce ? ` (${prixAnnonce})` : ""} : la fabrication continue, arrêt de sécurité à ${FACTEUR_SECURITE_BUDGET} fois le prix annoncé.`;
}
export const MESSAGE_ARRET_SECURITE = messageArretSecurite();
