/** MOTEUR « DÉMO FACECAM » (lot G) — vitrine : le rendu réel sera branché par un lot suivant. */
import { creerMoteurVitrine } from "../montage-vitrines/pause";

export const ID_MOTEUR_DEMO_FACECAM = "montage-demo-facecam";

export const moteurMontageDemoFacecam = creerMoteurVitrine({
  id: ID_MOTEUR_DEMO_FACECAM,
  nom: "Montage démo facecam",
  phrasePause: "La démo facecam n'est pas encore branchée : vos vidéos sont gardées, rien n'a échoué.",
  etapes: [
    { cle: "reception", nom: "Vos vidéos reçues", icone: "camera", dependDe: [], dureeEstimeeSec: 2 },
    { cle: "sous-titres", nom: "Les sous-titres", icone: "sous-titres", dependDe: ["reception"], dureeEstimeeSec: 3 },
    { cle: "montage", nom: "L'écran partagé", icone: "ecran-partage", dependDe: ["sous-titres"], dureeEstimeeSec: 4 },
  ],
});
