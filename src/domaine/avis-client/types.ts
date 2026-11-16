/** Avis client (C8-A02). Préfixe `avisClient` : `avisWill` existe déjà ailleurs. */
export interface AvisClient {
  id: string;
  auteur: string;
  /** Date ISO de l'avis. */
  date: string;
  source: "google" | "trustpilot" | "direct" | "formulaire-site";
  /** Note réelle de l'avis (entier 1 à 5). */
  note: number;
  /** Texte exact, jamais réécrit. */
  texte: string;
  /** Seul « published » est affichable. */
  statut: string;
  accordAuteur: { ecrit: boolean; date: string; forme: string };
  valideLe: string;
  urlPreuve?: string;
  /** Vrai seulement si l'information vient de la plateforme source. */
  verifie?: boolean;
  /** Avis d'exemple : jamais affiché hors `outils/`. */
  exemple?: true;
}
