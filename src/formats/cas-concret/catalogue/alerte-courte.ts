import type { CasConcret } from "../cas";

/** Cas 18 du brouillon : une alerte courte sur le téléphone du dirigeant. */
export const alerteCourte: CasConcret = {
  id: "alerte-courte",
  version: 1,
  offre: "integration",
  nature: "outils-relies",
  posture: "chez-nous",
  titre: "Une alerte courte sur le téléphone, pas un mur de texte",
  theme: "Alerte",
  promesse: "On lit nos alertes en marchant.",
  cible: "Un dirigeant qui reçoit trop de notifications et finit par n'en lire aucune.",
  avant: { taches: ["Alertes longues, illisibles sur mobile", "Message perdu car trop gros", "Ne pas savoir quoi traiter d'abord", "Lire un mur de texte"] },
  etapes: [
    { titre: "L'événement", ligne: "Un événement survient sur le site.", detail: "Rendez-vous, signature, formulaire ou incident.", visuel: { sorte: "objet", objet: "pile-notifications" } },
    { titre: "Le message", ligne: "Le site compose un message court.", detail: "Pas un mur de texte.", visuel: { sorte: "objet", objet: "champ-commentaire" } },
    { titre: "L'envoi", ligne: "Il part sur la messagerie en trois secondes.", detail: "Sans jamais bloquer le visiteur.", visuel: { sorte: "objet", objet: "chrono" } },
    { titre: "Les incidents", ligne: "Les incidents sensibles vont dans un salon dédié.", detail: "Séparés des alertes courantes.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "L'écran", ligne: "Chaque message tient sur un écran.", detail: "Raccourci volontairement pour se lire en marchant.", visuel: { sorte: "objet", objet: "telephone-notification" } },
  ],
  resteHumain: "Traiter l'alerte.",
  resteHumainApresEtape: 5,
  resultat: "Une alerte qui se lit en marchant.",
  faits: [
    { id: "envoi-trois-secondes", enonce: "Le message part en 3 secondes au plus, sans bloquer le visiteur.", valeurs: [3], source: "code", preuve: "src/server/notifications/channels/telegram.ts, lignes 4 et 11-25." },
    { id: "salon-incidents", enonce: "Les incidents sensibles vont dans un salon dédié.", valeurs: [], source: "will", preuve: "Décision de Will relevée dans le brouillon du catalogue (cas 18), à confirmer avant diffusion." },
  ],
  documentPromis: { nom: "Schéma de l'intégration", finCadeauId: "fin-if-cadeau-integration" },
  mot: "ALERTE",
  vigilance: ["Jamais de prénom, de nom ni de lien réel à l'écran.", "La console de conformité a ses règles propres : ne rien en filmer.", "Vidéo courte seulement si l'accroche est forte."],
  enServiceVerifie: { le: "2026-10-11", source: "Relecture du code (brouillon du catalogue, cas 18) : envoi court avec délai maximal, échec sans blocage ; salon des incidents dépendant d'un réglage. Mise en service non constatée en production." },
};
