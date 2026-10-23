/**
 * RÉGLAGES DE LA PHASE 2 DU CAS CONCRET (portage de #167). Sept réglages du studio, tous ÉTEINTS par défaut : aucun code
 * ne les allume, Will le fait lui-même. Éteint = l'écran et le comportement de master, inchangés.
 *   - catalogueEtendu : les cas de la phase 2 s'ajoutent au catalogue ;
 *   - porteB : case de texte libre (appel Claude payant) ;
 *   - retouches : retouche par opérations / par discussion (sinon « Demander une modification » garde la réponse commune) ;
 *   - documentPromis : brouillon, page imprimable, validation (ne part JAMAIS tout seul) ;
 *   - ecranFourni : dépôt d'une image masquée à la place d'une capture ;
 *   - releves : lecture seule des visites et vues, par publication ;
 *   - stockMetiers : les cas du stock par métier (`stock-metiers/stock.json`) s'ajoutent à ce que montrent la page, le stock et les suggestions.
 */
import "server-only";
import type { CommandeFabrication } from "@/domaine/types";
import { ID_MOTEUR_CAS_CONCRET } from "@/moteurs/montage-cas-concret";
import { lireParametre } from "./_commun";

export const REGLAGES_CAS_CONCRET = {
  catalogueEtendu: "casConcret.catalogueEtendu",
  porteB: "casConcret.porteB",
  retouches: "casConcret.retouches",
  documentPromis: "casConcret.documentPromis",
  ecranFourni: "casConcret.ecranFourni",
  releves: "casConcret.releves",
  stockMetiers: "casConcret.stockMetiers",
} as const;

export type IdReglageCasConcret = (typeof REGLAGES_CAS_CONCRET)[keyof typeof REGLAGES_CAS_CONCRET];

/** Allumé seulement si le réglage vaut exactement `true` ; toute autre valeur (ou rien) = éteint. */
export async function reglageAllume(id: IdReglageCasConcret): Promise<boolean> {
  return (await lireParametre<unknown>(id, false)) === true;
}

/**
 * Raccord de `casConcret.retouches` au moteur. `refusRetouche` du moteur est SYNCHRONE (il est interrogé par l'écran, par
 * `lancerRetouche` et par « Réessayer »), la lecture du réglage ne l'est pas : le service relit donc le réglage AVANT
 * chaque chemin qui interroge le moteur (`preparerReglagesMoteur`) et le moteur lit la dernière valeur connue. Au départ,
 * ou si la lecture échoue : éteint. Un réglage allumé n'est jamais pris pour acquis avant d'avoir été relu. La valeur est rangée
 * sur `globalThis` (comme les services du moteur) : un module chargé deux fois (couches Next) partage la même valeur.
 */
const cleRetouches = Symbol.for("studio-axion-ia.cas-concret-retouches");
type AvecRetouches = typeof globalThis & { [cleRetouches]?: boolean };

export async function actualiserReglageRetouches(): Promise<void> {
  try {
    (globalThis as AvecRetouches)[cleRetouches] = await reglageAllume(REGLAGES_CAS_CONCRET.retouches);
  } catch {
    (globalThis as AvecRetouches)[cleRetouches] = false;
  }
}

/** Dernière valeur lue du réglage `casConcret.retouches` (éteint tant qu'elle n'a pas été lue). */
export const retouchesAllumeesConnues = (): boolean => (globalThis as AvecRetouches)[cleRetouches] === true;

/** À appeler avant d'interroger le moteur d'une commande : relit le réglage, seulement pour le cas concret. */
export async function preparerReglagesMoteur(commande: Pick<CommandeFabrication, "moteurId">): Promise<void> {
  if (commande.moteurId === ID_MOTEUR_CAS_CONCRET) await actualiserReglageRetouches();
}
