/**
 * DONNÉES D'EXEMPLE DES PLANCHES (lot C2, décision du 09/10) : en lien avec Axion-IA (formation et automatisation IA
 * pour dirigeants de PME). Le « diagnostic fuite » = trouver où l'entreprise PERD DU TEMPS (pas une fuite d'eau).
 * Mêmes données pour les deux styles (Sobre et Spectaculaire). PUR, sans alias « @/ ».
 */
import type { CarteModele, DonneesParModele, IdModeleMotion } from "./types";

export const EXEMPLES_AXION: { [K in IdModeleMotion]: DonneesParModele[K] } = {
  liste: {
    titre: "Le diagnostic *fuite*",
    aSecTitre: 0.15,
    elements: [
      { texte: "Où perdez-vous du temps ?", icone: "horloge", aSec: 0.95 },
      { texte: "Quelles tâches se répètent ?", icone: "engrenage", aSec: 1.85 },
      { texte: "Que coûte une erreur ?", icone: "euro", aSec: 2.75 },
    ],
  },
  chiffre: { surTitre: "Chaque semaine", valeur: 9, unite: "h", libelle: "rendues au dirigeant grâce à l'IA", icone: "sablier", aSec: 0.35 },
  "avant-apres": {
    titre: "La *paperasse* par semaine",
    avant: { valeur: 12, unite: "h", libelle: "à la main" },
    apres: { valeur: 3, unite: "h", libelle: "avec l'IA" },
    aSecApres: 1.7,
  },
  "ligne-de-temps": {
    titre: "Votre IA en *4 étapes*",
    etapes: [
      { titre: "Le diagnostic", detail: "Où part votre temps", icone: "loupe", aSec: 0.75 },
      { titre: "La formation", detail: "Un jour ensemble", icone: "ampoule", aSec: 1.5 },
      { titre: "L'automatisation", detail: "Vos tâches répétées", icone: "robot", aSec: 2.25 },
      { titre: "Le suivi", detail: "3 mois à vos côtés", icone: "graphique", aSec: 3.0 },
    ],
  },
  "deux-colonnes": {
    titre: "Le devis, *deux façons*",
    gauche: { titre: "À la main", points: ["2 heures", "Des oublis"], icone: "document" },
    droite: { titre: "Avec l'IA", points: ["10 minutes", "Zéro oubli"], icone: "eclair" },
    commun: { titre: "En commun", points: ["Votre expertise", "Votre prix"] },
    aSecDroite: 1.4,
    aSecCommun: 2.6,
  },
  titre: { variante: "titre", surTitre: "Épisode 1", titre: "Le diagnostic fuite", motCle: "fuite", sousTitre: "où votre entreprise perd du temps" },
};

/** Carte d'exemple Axion d'un modèle (planches). */
export function carteExempleAxion(id: IdModeleMotion): CarteModele {
  return { modele: id, donnees: EXEMPLES_AXION[id] } as CarteModele;
}
