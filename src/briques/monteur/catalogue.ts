/**
 * BRIQUE MONTEUR — forme commune d'un catalogue d'opérations (mission H, extrait du lot D). PUR.
 *
 * Chaque format tient SON catalogue (ce qu'il sait faire) sous cette forme ; il sert trois fois : dans la consigne de
 * Claude, pour les règles fixes de la version simple, et pour le bouton « Que puis-je demander ? ».
 */

export interface EntreeCatalogueMonteur<T extends string = string> {
  type: T;
  /** Ce que Will voit (mots simples). */
  libelle: string;
  /** Ce que Claude lit (règles de l'opération). */
  regle: string;
  /** Exemples de phrases de Will (touchables dans « Que puis-je demander ? »). */
  exemples: string[];
}

/** Catalogue tel que Claude le lit (bloc de consigne, mis en cache). */
export function texteCatalogue(entrees: readonly EntreeCatalogueMonteur[]): string {
  return entrees.map((e) => `- ${e.type} (${e.libelle}) : ${e.regle}`).join("\n");
}

/** Exemples proposés par « Que puis-je demander ? » (un par famille, dans l'ordre du catalogue). */
export function exemplesDuCatalogue(entrees: readonly EntreeCatalogueMonteur[], max = 8): string[] {
  return entrees.map((e) => e.exemples[0]).filter(Boolean).slice(0, max);
}
