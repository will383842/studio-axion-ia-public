import "server-only";
import type { IdReseau } from "@/domaine/types";

const COMPTE_PAR_DEFAUT = "compte-studio";

/**
 * Compte cible de chaque réseau pour un ajout manuel (pont CAL-14P0 : valeur par défaut, la fiche CAL-14C choisit le vrai canal).
 * Ne lève jamais : en cas de panne, chaque réseau garde la valeur par défaut.
 */
export async function comptesCibles(reseaux: IdReseau[]): Promise<Partial<Record<IdReseau, string>>> {
  try {
    return Object.fromEntries(reseaux.map((r) => [r, COMPTE_PAR_DEFAUT])) as Partial<Record<IdReseau, string>>;
  } catch {
    return {};
  }
}
