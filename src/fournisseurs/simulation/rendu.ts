/**
 * Service de rendu SIMULÉ (défaut, lot M1b) : même contrat que le conteneur `studio-rendu`, sans aucun calcul.
 * File courte : ≈ 2 s ; file longue : ≈ 10 s, un rendu à la fois. `oublierTout()` imite un redémarrage du conteneur
 * (les rendus connus répondent alors « inconnu », comme un 404).
 */
import type { DemandeRendu, EtatRendu, ServiceRendu } from "../types";

const DUREE_MS = { courte: 2_000, longue: 10_000 } as const;

export interface ServiceRenduSimule extends ServiceRendu {
  /** Imite un redémarrage : tout est oublié. */
  oublierTout(): void;
  /** Nombre de soumissions reçues par identifiant (tests). */
  soumissions(idRendu: string): number;
}

export function creerServiceRenduSimule(horloge: () => number = Date.now): ServiceRenduSimule {
  const rendus = new Map<string, { demande: DemandeRendu; recuA: number }>();
  const compte = new Map<string, number>();
  return {
    async soumettre(demande) {
      compte.set(demande.idRendu, (compte.get(demande.idRendu) ?? 0) + 1);
      // Idempotent : une demande déjà connue n'est pas relancée.
      if (!rendus.has(demande.idRendu)) rendus.set(demande.idRendu, { demande, recuA: horloge() });
      return { idRendu: demande.idRendu };
    },
    async etat(idRendu): Promise<EtatRendu> {
      const r = rendus.get(idRendu);
      if (!r) return { statut: "inconnu" };
      const ecoule = horloge() - r.recuA;
      const duree = DUREE_MS[r.demande.file];
      if (ecoule >= duree) return { statut: "termine", sortieCle: r.demande.sortie.cle };
      if (ecoule < 200) return { statut: "en_file", rang: 0 };
      return { statut: "en_cours", progression: Math.min(99, Math.round((ecoule / duree) * 100)) };
    },
    oublierTout() {
      rendus.clear();
    },
    soumissions(idRendu) {
      return compte.get(idRendu) ?? 0;
    },
  };
}

export const serviceRenduSimule = creerServiceRenduSimule();
