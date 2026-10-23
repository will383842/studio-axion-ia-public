/**
 * CALAGE DES MOTS SIMULÉ (défaut ; posé par l'architecte le 02/10, `docs/LOT-INTENSITE-CREDITS-EXECUTION.md`).
 * Aucun calcul : il renvoie l'horodatage de la voix tel quel (`reference`), sans écart. Le moteur avocat SAUTE le calage
 * quand ce fournisseur est en mode « simulation » : la démonstration M4 et les tests sans conteneur restent identiques.
 * Le vrai calage (WhisperX dans `studio-aligneur`) s'inscrit par `aligneurReel()` (`fournisseurs/aligneur/inscription.ts`, D3).
 */
import type { DemandeAlignement, EtatAlignement, FournisseurAlignement } from "../types";

export function creerAlignementSimule(): FournisseurAlignement {
  const demandes = new Map<string, DemandeAlignement>();
  return {
    id: "simulation",
    type: "alignement",
    mode: "simulation",
    nom: "Calage des sous-titres",
    reelPrevu: "WhisperX (studio-aligneur)",
    capacites: { asynchrone: true, accordExige: false },
    async soumettre(demande) {
      demandes.set(demande.idAlignement, demande);
    },
    async suivre(idAlignement): Promise<EtatAlignement> {
      const d = demandes.get(idAlignement);
      if (!d) return { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "Demande inconnue : à soumettre à nouveau." } };
      return { statut: "termine", resultat: { mots: d.reference ?? [], motsNonAlignes: 0, modele: "simulation", dureeCalculSec: 0, ecartMoyenMs: 0, ecartMaxMs: 0 } };
    },
  };
}

export const fournisseurAlignementSimulation = creerAlignementSimule();
