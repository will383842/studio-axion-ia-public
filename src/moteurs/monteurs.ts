/**
 * REGISTRE DES ADAPTATEURS DE LA BRIQUE MONTEUR (mission H) : l'agent monteur de chaque format, sous le contrat commun
 * `AdaptateurMonteur`. Un format futur ajoute ici une ligne (son vocabulaire, son catalogue, ses règles fixes) ; tout
 * le reste (consignes, ancrage, relecture, réponse claire au refus) vient de la brique `monteur`. PUR.
 */
import type { AdaptateurMonteur } from "@/briques/monteur/adaptateur";
import { adaptateurMonteurAvocat } from "./montage-avocat/monteur";
import { adaptateurMonteurFacecam } from "./montage-facecam/monteur/adaptateur";

/** L'adaptateur d'un format, ou null s'il n'a pas (encore) de monteur. `motion` : cartes animées ouvertes (avocat). */
export function adaptateurMonteur(formatId: string, options: { motion?: boolean } = {}): AdaptateurMonteur | null {
  if (formatId === "facecam") return adaptateurMonteurFacecam as AdaptateurMonteur;
  if (formatId === "avocat") return adaptateurMonteurAvocat(options) as AdaptateurMonteur;
  return null;
}

export const FORMATS_AVEC_MONTEUR = ["facecam", "avocat"] as const;
