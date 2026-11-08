/**
 * CATALOGUE DES OUTILS MOTION DESIGN (lot G). PUR : données seules, importables côté client et serveur.
 *
 * Les pièces d'interface animées que le studio saura poser dans une vidéo. Le lot « plan de scènes » branchera plus tard
 * chacune sur son vrai composant ; ici, seulement de quoi les présenter. Niveau 1 = pièce de base. Aucun prix.
 */
export interface OutilMotion {
  id: string;
  nom: string;
  /** Une courte phrase (90 caractères au plus). */
  description: string;
  niveau: 1;
}

export const CATALOGUE_OUTILS_MOTION: readonly OutilMotion[] = [
  { id: "curseur", nom: "Curseur", description: "Une flèche qui se déplace et montre où regarder.", niveau: 1 },
  { id: "zoom", nom: "Zoom", description: "Un grossissement sur la zone qui compte.", niveau: 1 },
  { id: "frappe", nom: "Frappe", description: "Un texte qui se tape lettre après lettre.", niveau: 1 },
  { id: "carte-kpi", nom: "Carte KPI", description: "Un chiffre clé qui défile jusqu'à sa valeur.", niveau: 1 },
  { id: "graphique", nom: "Graphique", description: "Des courbes et des barres qui se dessinent.", niveau: 1 },
  { id: "tableau-de-bord", nom: "Tableau de bord", description: "Plusieurs cartes réunies sur un même écran.", niveau: 1 },
  { id: "liste-crm", nom: "Liste / CRM", description: "Des lignes de contacts qui arrivent une à une.", niveau: 1 },
  { id: "fenetre-app", nom: "Fenêtre d'app", description: "Une fenêtre d'application qui s'ouvre à l'écran.", niveau: 1 },
  { id: "bulle-chat", nom: "Bulle de chat", description: "Des messages qui s'échangent comme dans une discussion.", niveau: 1 },
  { id: "legende", nom: "Légende", description: "Une phrase courte qui explique le geste en cours.", niveau: 1 },
];

export function trouverOutilMotion(id: string): OutilMotion | undefined {
  return CATALOGUE_OUTILS_MOTION.find((o) => o.id === id);
}
