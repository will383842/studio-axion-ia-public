/**
 * Ordre et règles de la feuille « Votre vidéo » (lot L3, sujet déjà traité), en fonctions pures pour être testées sans
 * navigateur. Le contrôle du sujet passe AVANT le prix : l'estimation annonce `dejaTraite`, le bouton principal reste
 * bloqué tant que Will n'a pas choisi, et le prix n'est confirmé qu'ensuite. Le serveur reste maître : au lancement, il
 * revérifie, et un jeton périmé redonne le refus.
 */
import type { ChoixConfirmation } from "@/domaine/sujets-traites";

/** Le choix de Will devant un sujet déjà traité : sa confirmation, telle qu'elle repart au serveur. */
export interface ChoixSujet {
  choix: ChoixConfirmation;
  jeton: string;
}

/** Ce que l'estimation annonce quand le cas est déjà traité (seul le jeton compte ici). */
export interface DejaTraiteVue {
  jeton: string;
}

/** Le bouton principal n'est utilisable que si le cas est libre, ou si Will a choisi. */
export const peutFabriquer = (dejaTraite: DejaTraiteVue | undefined, choix: ChoixSujet | undefined): boolean => !dejaTraite || !!choix;

/** « Nouvel angle » active l'option existante « Nouveau script » pour le prix ; sinon l'interrupteur de Will décide. */
export const nouveauScriptPourEstimation = (nouveauScript: boolean, choix: ChoixSujet | undefined): boolean => nouveauScript || choix?.choix === "nouvel-angle";

/**
 * Après une nouvelle estimation : si elle annonce encore (ou de nouveau) un sujet déjà traité, le choix n'est plus valable
 * (jeton périmé : les vidéos ont changé) et Will choisit de nouveau.
 */
export const choixApresEstimation = (choix: ChoixSujet | undefined, dejaTraite: DejaTraiteVue | undefined): ChoixSujet | undefined => (dejaTraite ? undefined : choix);

/** La confirmation envoyée au serveur : exactement le choix et le jeton reçus. */
export const sujetAEnvoyer = (choix: ChoixSujet | undefined): ChoixSujet | undefined => (choix ? { choix: choix.choix, jeton: choix.jeton } : undefined);

/**
 * L'interrupteur « Nouveau script » (cas à script validé) et le choix « Nouvel angle » ne font qu'un : allumer
 * l'interrupteur sur un cas déjà traité = choisir « Nouvel angle » (le panneau ne disparaît pas sans choix) ; l'éteindre
 * retire ce choix. Les autres choix (« Refaire quand même ») ne bougent pas.
 */
export function choixApresInterrupteur(allume: boolean, choix: ChoixSujet | undefined, dejaTraite: DejaTraiteVue | undefined): ChoixSujet | undefined {
  if (allume) return !choix && dejaTraite ? { choix: "nouvel-angle", jeton: dejaTraite.jeton } : choix;
  return choix?.choix === "nouvel-angle" ? undefined : choix;
}
