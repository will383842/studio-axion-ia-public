/**
 * DONNÉES D'EXEMPLE DES MODÈLES 7 À 13 (lot F2) : en lien avec Axion-IA (formation et automatisation IA pour
 * dirigeants de PME), comme `exemples-axion.ts`. Mêmes données pour les deux styles (Sobre et Spectaculaire).
 * La capture d'exemple est désignée par `CAPTURE_EXEMPLE` : la composition la remplace par l'image fournie avec le
 * rendu (`studio-rendu/compositions/commune/motion/exemples/`). PUR, sans alias « @/ ».
 */
import type { CarteModeleEtendu, DonneesGraphique, DonneesParModeleEtendu, IdModeleMotionEtendu } from "./types-etendus";

/** Adresse symbolique de la capture d'exemple (un tableau de bord d'automatisations, sans marque). */
export const CAPTURE_EXEMPLE = "exemple:capture-tableau-de-bord";

export const EXEMPLES_AXION_ETENDUS: { [K in IdModeleMotionEtendu]: DonneesParModeleEtendu[K] } = {
  graphique: {
    variante: "barres",
    titre: "Où part le *temps* d'un dirigeant",
    unite: "h",
    series: [
      { libelle: "Administratif", valeur: 9, aSec: 0.9 },
      { libelle: "E-mails", valeur: 6, aSec: 1.45 },
      { libelle: "Devis et factures", valeur: 4, aSec: 2.0 },
      { libelle: "Relances", valeur: 3, aSec: 2.55 },
    ],
    note: "heures par semaine",
  },
  "icone-mot": { surTitre: "Un seul mot", mot: "Déléguer", icone: "robot", sousTitre: "les tâches répétitives à l'IA", aSec: 1.2 },
  "probleme-solution": {
    probleme: { titre: "Les devis à la main", detail: "2 heures chacun, des oublis", icone: "document" },
    solution: { titre: "Un devis prêt en 10 min", detail: "Préparé par l'IA, relu par vous", icone: "eclair" },
    aSecSolution: 1.9,
  },
  "check-list": {
    titre: "Prêt pour *l'IA* ?",
    aSecTitre: 0.15,
    elements: [
      { texte: "Vos tâches répétées sont listées", aSec: 0.9 },
      { texte: "Vos fichiers sont rangés", aSec: 1.6 },
      { texte: "Votre équipe est partante", aSec: 2.3 },
      { texte: "Un premier outil est choisi", aSec: 3.0 },
    ],
  },
  "capture-annotee": {
    image: { src: CAPTURE_EXEMPLE, origine: "mes-images", largeur: 1440, hauteur: 1600, description: "Tableau de bord des automatisations de la semaine" },
    titre: "Votre *tableau de bord*",
    annotations: [
      { type: "cercle", x: 0.505, y: 0.205, largeur: 0.45, hauteur: 0.17, texte: "9 h gagnées", aSec: 0.9 },
      { type: "surligne", x: 0.05, y: 0.452, largeur: 0.9, hauteur: 0.088, texte: "La plus utile", aSec: 2.1 },
      { type: "fleche", x: 0.3, y: 0.86, largeur: 0.4, hauteur: 0.09, texte: "Un clic", aSec: 3.25 },
    ],
  },
  "titre-plein-ecran": { numero: "02", surTitre: "Chapitre 2", titre: "Reprendre la main sur son *temps*", sousTitre: "l'IA au service du dirigeant" },
  documentaire: {
    lieu: "Lyon, Rhône",
    date: "Mars 2026",
    chiffre: { valeur: 14, unite: "salariés", libelle: "une PME qui automatise ses devis" },
    contexte: "9 heures rendues chaque semaine",
    aSec: 0.4,
  },
};

/** Variantes « courbe » et « camembert » du graphique (planche de validation). */
export const EXEMPLES_GRAPHIQUE: Record<"courbe" | "camembert", DonneesGraphique> = {
  courbe: {
    variante: "courbe",
    titre: "Heures *gagnées* par semaine",
    unite: "h",
    series: [
      { libelle: "Mois 1", valeur: 1, aSec: 0.9 },
      { libelle: "Mois 2", valeur: 3, aSec: 1.4 },
      { libelle: "Mois 3", valeur: 5, aSec: 1.9 },
      { libelle: "Mois 4", valeur: 7, aSec: 2.4 },
      { libelle: "Mois 6", valeur: 9, aSec: 2.9 },
    ],
    note: "après la formation",
  },
  camembert: {
    variante: "camembert",
    titre: "La semaine d'un *dirigeant*",
    unite: "%",
    series: [
      { libelle: "Administratif", valeur: 38, aSec: 0.9 },
      { libelle: "Clients", valeur: 30, aSec: 1.5 },
      { libelle: "Équipe", valeur: 20, aSec: 2.1 },
      { libelle: "Stratégie", valeur: 12, aSec: 2.7 },
    ],
  },
};

/** Carte d'exemple Axion d'un modèle 7 à 13 (planches). */
export function carteExempleAxionEtendue(id: IdModeleMotionEtendu): CarteModeleEtendu {
  return { modele: id, donnees: EXEMPLES_AXION_ETENDUS[id] } as CarteModeleEtendu;
}
