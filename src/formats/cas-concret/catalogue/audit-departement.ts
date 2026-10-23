import type { CasConcret } from "../cas";

/** Cas 6 du brouillon : l'audit d'un département. */
export const auditDepartement: CasConcret = {
  id: "audit-departement",
  version: 1,
  offre: "audit",
  posture: "offre",
  titre: "L'audit d'un département : du rapport au plan chiffré",
  theme: "Audit",
  promesse: "Un plan chiffré pour votre département.",
  cible: "Un responsable à qui la direction demande quel budget IA, pour quel gain.",
  avant: { taches: ["Pas de carte des tâches", "Ne pas savoir quoi comparer", "Bâtir un budget sans base", "Guider un prestataire à l'aveugle"] },
  etapes: [
    { titre: "Le cadrage", ligne: "On fixe ce que l'on regarde.", detail: "Une partie du service, ou tout le service.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/audit/cible", mouvement: "image", repli: "carte-taches" } },
    { titre: "La carte", ligne: "On dresse la carte de vos tâches.", detail: "Le volume, le temps, les outils, ce qui bloque.", visuel: { sorte: "objet", objet: "carte-taches" } },
    { titre: "Les fiches", ligne: "Chaque piste a sa fiche.", detail: "Le gain, la peine, le délai, l'outil, les règles sur les données.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "Le scoring", ligne: "Un tableau compare les pistes.", detail: "Chaque piste reçoit une note, pour les comparer.", visuel: { sorte: "objet", objet: "barres-avant-apres" } },
    { titre: "Le plan", ligne: "Un plan par étapes, avec son coût.", detail: "Il va de 3 à 12 mois.", visuel: { sorte: "objet", objet: "calendrier" } },
    { titre: "La restitution", ligne: "On vous le présente, avec votre équipe.", detail: "Puis on remet le rapport, de 10 à 40 pages.", visuel: { sorte: "objet", objet: "rapport" } },
  ],
  resteHumain: "Vous arbitrez et décidez du budget.",
  resteHumainApresEtape: 6,
  resultat: "Un plan chiffré que vous arbitrez.",
  faits: [
    { id: "atelier-deux-heures", enonce: "L'atelier de restitution dure 2 heures.", valeurs: [2], source: "site", preuve: "src/content/audit-detail-configs.ts, lignes 368 et 384." },
    { id: "rapport-dix-quarante-pages", enonce: "Le rapport compte de 10 à 40 pages.", valeurs: [10, 40], source: "site", preuve: "src/content/audit-detail-configs.ts, lignes 368 et 384." },
    { id: "plan-trois-douze-mois", enonce: "Le plan d'exécution s'étend de 3 à 12 mois.", valeurs: [3, 12], source: "site", preuve: "src/content/audit-detail-configs.ts, lignes 360-450." },
  ],
  documentPromis: { nom: "Exemple de plan d'exécution", finCadeauId: "fin-if-cadeau-audit" },
  mot: "PLAN",
  vigilance: ["La mise en œuvre est une autre prestation : ne pas la laisser croire incluse.", "Ne pas citer les fourchettes de budget : le code les marque « indicatif ».", "Ne pas confondre le plan avec un résultat.", "Ne citer aucun gain chiffré, aucun prix."],
};
