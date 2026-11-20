/**
 * T-EXT-26a · FIN COMMUNE DU TUTORIEL — PUR. « Aucune » par défaut ; « Prendre rendez-vous » seulement si l'utilisateur
 * l'a choisie dans le formulaire. Aucune phrase n'est ajoutée à la voix ni aux sous-titres : la dernière phrase dite reste
 * celle du script validé. Interrupteur éteint = la carte « Axion IA » d'aujourd'hui, à l'identique.
 *
 * Note LUT (26c) : le tutoriel est « dessiné, rendu neutre », sans LUT, par choix (`src/briques/charte/rendu-couleur.ts:16,29`) ;
 * une LUT demanderait le mode `complet` (chantier à part). Pas de fiche.
 */
import { CARTE_FIN_AXION, CARTE_FIN_RENDEZ_VOUS, DUREE_CARTE_FIN_MS } from "./proprietes";

export type ChoixFinTutoriel = "aucune" | "rendez-vous";

export interface FinDuTutoriel {
  fin?: { titre: string; sousTitre: string };
  finMs: number;
  choix: "carte-axion" | ChoixFinTutoriel;
}

/** Interrupteur éteint : exactement la carte d'aujourd'hui. Allumé : « aucune » sauf choix explicite « rendez-vous ». */
export function finDuTutoriel(entree: ChoixFinTutoriel | undefined, actif: boolean): FinDuTutoriel {
  if (!actif) return { fin: { ...CARTE_FIN_AXION }, finMs: DUREE_CARTE_FIN_MS, choix: "carte-axion" };
  if (entree === "rendez-vous") return { fin: { ...CARTE_FIN_RENDEZ_VOUS }, finMs: DUREE_CARTE_FIN_MS, choix: "rendez-vous" };
  return { finMs: 0, choix: "aucune" };
}
