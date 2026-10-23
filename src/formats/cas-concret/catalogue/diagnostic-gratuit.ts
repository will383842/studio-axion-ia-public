import type { CasConcret } from "../cas";

/** Cas 7 du brouillon : le diagnostic en ligne. Le texte ne redit jamais la demande de la fin (« votre diagnostic gratuit »). */
export const diagnosticGratuit: CasConcret = {
  id: "diagnostic-gratuit",
  version: 1,
  offre: "audit",
  posture: "offre",
  titre: "Le diagnostic en ligne : ce que l'IA peut vous rendre",
  theme: "Diagnostic",
  promesse: "Calculez ce que l'IA peut vous rendre.",
  cible: "Un dirigeant curieux qui veut un premier ordre de grandeur avant de parler à quelqu'un.",
  avant: { taches: ["Estimer au doigt mouillé", "Ne pas savoir par où commencer", "Hésiter à demander un échange", "Manquer d'un élément concret"] },
  etapes: [
    { titre: "La page", ligne: "Vous arrivez sur la page de diagnostic.", detail: "Un outil gratuit, directement sur le site.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/diagnostic", mouvement: "image", repli: "liste-taches" } },
    { titre: "Les questions", ligne: "Vous répondez à des questions de tête.", detail: "Par exemple : combien de devis par semaine ?", visuel: { sorte: "objet", objet: "champ-commentaire" } },
    { titre: "Le calcul", ligne: "Le simulateur reconstruit le temps par tâche.", detail: "Seulement pour les tâches qui peuvent être automatisées.", visuel: { sorte: "objet", objet: "barres-avant-apres" } },
    { titre: "Le rapport", ligne: "Vous obtenez un rapport nominatif.", detail: "Plan d'action, feuille de route et limites assumées.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "L'envoi", ligne: "Vous le recevez par e-mail.", detail: "Vous pouvez ensuite proposer un échange.", visuel: { sorte: "objet", objet: "e-mail" } },
  ],
  resteHumain: "Rien côté visiteur, hors le questionnaire.",
  resteHumainApresEtape: 5,
  resultat: "Un ordre de grandeur, présenté comme une estimation.",
  faits: [
    { id: "hypotheses-de-modele", enonce: "Les résultats sont des hypothèses de modèle, jamais une étude.", valeurs: [], source: "code", preuve: "src/app/[locale]/roi/page.tsx, lignes 13-15." },
    { id: "outil-gratuit", enonce: "Le diagnostic est un outil gratuit du site.", valeurs: [], source: "site", preuve: "src/app/[locale]/diagnostic/page.tsx, lignes 1-30." },
  ],
  documentPromis: { nom: "Exemple de rapport de diagnostic", finCadeauId: "fin-if-cadeau-audit" },
  mot: "CALCUL",
  vigilance: ["Jamais « vous économiserez X ».", "Ni compteur de rareté, ni « satisfait ou remboursé » : le code les refuse.", "Dire « estimation »."],
};
