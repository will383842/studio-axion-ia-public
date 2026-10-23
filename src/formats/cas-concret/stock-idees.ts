/**
 * IDÉES À VENIR du « Cas concret MD » : les automatisations d'Axion-IA qui n'ont pas encore de fiche de cas.
 * Données seules, VIDE aujourd'hui : une autre tâche (l'inventaire) la remplira. Aucune idée n'est inventée ici.
 */
import type { Offre } from "./cas";

export interface IdeeAutomatisation {
  id: string;
  nom: string;
  /** Une phrase, en clair. */
  resume: string;
  /** D'où elle vient : un chemin de code ou une page du site. */
  source: string;
  offre: Offre;
  statut: "idee";
}

export const IDEES_A_VENIR: readonly IdeeAutomatisation[] = [];
