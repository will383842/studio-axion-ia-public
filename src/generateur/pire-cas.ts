/**
 * PIRE CAS D'UNE CHAÎNE D'ÉCRITURE (garde-fous budget, correctif après relecture, 15/10) — PUR.
 * Une seule entrée pour la réserve faite avant le premier appel, quelle que soit la chaîne réellement utilisée :
 *  - « grande » : `chaine.ts` (étapes 1 à 12, reprises et corrections possibles comprises) ;
 *  - « courte » : `chaine-courte.ts` (3 appels, aucune reprise ; branchée en production par une PR suivante) ;
 *  - « equipe » : `chaine-equipe.ts` (rédacteur en chef ×2 au pire, scénariste, accroches, relecteur ; livrée éteinte).
 * Même règle pour les deux (`roles/estimation.ts` · `totaliserPireCas`) : entrée au prix normal, une écriture du socle en
 * cache par rôle, sorties à `maxTokens`.
 */
import { pireCasGrandeChaine, type EtatChaine, type OptionsChaine } from "./chaine";
import { pireCasChaineCourte, type OptionsChaineCourte } from "./chaine-courte";
import { pireCasChaineEquipe } from "./chaine-equipe";
import type { DonneesGeneration } from "./contexte";
import type { PireCasChaine } from "./roles/estimation";

export type { PireCasChaine } from "./roles/estimation";

export type ChaineEcriture = "courte" | "grande" | "equipe";

export interface OptionsPireCas {
  donnees: DonneesGeneration;
  options?: OptionsChaine & OptionsChaineCourte;
  /** État d'où la chaîne repart (reprise, retour en arrière) : seules les étapes restantes sont comptées. */
  etatDepart?: EtatChaine;
}

export function pireCasChaine(chaine: ChaineEcriture, o: OptionsPireCas): PireCasChaine {
  if (chaine === "equipe") return pireCasChaineEquipe(o.donnees, o.options, o.etatDepart);
  return chaine === "courte" ? pireCasChaineCourte(o.donnees, o.options, o.etatDepart) : pireCasGrandeChaine(o.donnees, o.options, o.etatDepart);
}
