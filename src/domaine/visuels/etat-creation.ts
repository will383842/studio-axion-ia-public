/** Résultat de la création d'un carrousel depuis le formulaire : la fiche créée, ou de quoi rester sur le formulaire sans rien perdre. PUR. */
export type EtatCreation =
  | { id: string }
  | { erreurs: string[]; sujet?: string; contenu?: string; eteint?: false }
  | { eteint: true; sujet?: string; contenu?: string };

export const ETAT_INITIAL: EtatCreation = { erreurs: [] };
