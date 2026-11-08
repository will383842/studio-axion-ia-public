/** MOTEUR « TUTORIEL D'OUTIL » (lot G) — vitrine : le rendu réel sera branché par un lot suivant. */
import { creerMoteurVitrine } from "../montage-vitrines/pause";

export const ID_MOTEUR_TUTORIEL_OUTIL = "montage-tutoriel-outil";

export const moteurMontageTutorielOutil = creerMoteurVitrine({
  id: ID_MOTEUR_TUTORIEL_OUTIL,
  nom: "Montage tutoriel d'outil",
  phrasePause: "Le tutoriel d'outil n'est pas encore branché : votre demande est gardée, rien n'a échoué.",
  etapes: [
    { cle: "script", nom: "Le script", icone: "ecrire", dependDe: [], dureeEstimeeSec: 2 },
    { cle: "voix", nom: "La voix", icone: "micro", dependDe: ["script"], dureeEstimeeSec: 3 },
    { cle: "montage", nom: "Le montage motion design", icone: "film", dependDe: ["voix"], dureeEstimeeSec: 4 },
  ],
});
