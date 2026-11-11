/**
 * Registre sans dépendance : « le texte dit de la fiche contient-il un appel ? ». `variantes-fin` y enregistre
 * `trouverAppel` à son chargement ; `gabarit-3` le lit sans importer `variantes-fin` (évite un cycle d'import).
 * Détecteur pas encore enregistré : aucun appel détecté (comportement d'avant).
 */
import type { FicheTableau } from "./fiche";
type Detecteur = (fiche: Pick<FicheTableau, "scenes">) => boolean;
let detecteur: Detecteur | null = null;

export function enregistrerDetecteurAppel(d: Detecteur): void {
  detecteur = d;
}

export const appelDansLeTexte: Detecteur = (fiche) => detecteur?.(fiche) ?? false;
