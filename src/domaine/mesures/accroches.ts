/**
 * CLASSEUR D'ACCROCHES ET FIABILITÉ (fiche RC-26). PUR, aucun appel réel.
 *
 * Réutilise le regroupement existant des mesures (`regrouper`, axe « ouverture » = famille d'accroche) : aucune
 * logique de rang n'est recopiée. Un groupe de moins de 3 vidéos est « trop tôt » : on ne le lit pas.
 */
import { regrouper, type RangVideo } from "../mesures-rangs";

export type FiabiliteAccroche = "lisible" | "trop tôt";

export interface LigneClasseur {
  /** Famille d'accroche (type d'ouverture). */
  famille: string;
  nombre: number;
  /** Position médiane (0 à 1) ; absente tant que le groupe est « trop tôt ». */
  positionMediane?: number;
  fiabilite: FiabiliteAccroche;
  meilleur?: { code: string; rang: number; sur: number };
}

/** Classe les familles d'accroches : lisibles d'abord (les mieux placées devant), « trop tôt » en fin de liste. */
export function classeurAccroches(rangs: readonly RangVideo[]): LigneClasseur[] {
  return regrouper(rangs, "ouverture").map((g) => ({
    famille: g.valeur,
    nombre: g.nombre,
    positionMediane: g.positionMediane,
    fiabilite: g.tropTot ? "trop tôt" : "lisible",
    meilleur: g.meilleur,
  }));
}
