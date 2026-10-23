/** Un cas « coaching » d'essai (X5) : aucun n'est au catalogue ; il sert à tester la recette minimale de l'offre. */
import type { CasConcret } from "@/formats/cas-concret/cas";

export const casCoaching: CasConcret = {
  id: "coaching-dirigeant",
  version: 1,
  offre: "coaching",
  posture: "offre",
  titre: "Le dirigeant qui reprend la main sur ses semaines",
  promesse: "Vos semaines retrouvent de la place.",
  cible: "Un dirigeant qui passe ses soirées à rattraper ce qu'il n'a pas pu faire dans la journée.",
  avant: { taches: ["Répondre aux e-mails le soir", "Refaire les mêmes tableaux", "Tout vérifier soi-même", "Remettre la stratégie à plus tard"] },
  etapes: [
    { titre: "Le point de départ", ligne: "On regarde ensemble une semaine type.", detail: "Ce qui prend du temps, et ce qui pourrait partir à l'IA.", visuel: { sorte: "objet", objet: "calendrier" } },
    { titre: "Les priorités", ligne: "On choisit les tâches à alléger en premier.", detail: "Celles qui reviennent chaque semaine et pèsent le plus.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "La première séance", ligne: "Vous apprenez à confier une vraie tâche à l'IA.", detail: "Sur vos propres documents, sans rien envoyer de sensible.", visuel: { sorte: "objet", objet: "programme" } },
    { titre: "Les essais", ligne: "Vous essayez l'IA sur vos vraies tâches.", detail: "Entre les séances, à votre rythme, avec une fiche de suivi.", visuel: { sorte: "objet", objet: "carte-taches" } },
    { titre: "Le bilan", ligne: "Chaque séance fait le point sur ce qui marche.", detail: "On garde ce qui tient, on ajuste le reste.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "L'autonomie", ligne: "Peu à peu, vous avancez seul avec vos nouveaux réflexes.", detail: "Les séances s'espacent, les habitudes restent.", visuel: { sorte: "objet", objet: "barres-avant-apres" } },
  ],
  resteHumain: "Les décisions restent les vôtres.",
  resultat: "Vous gardez vos soirées pour vous.",
  faits: [],
  documentPromis: { nom: "Déroulé de l'accompagnement", finCadeauId: "fin-if-cadeau-coaching" },
  mot: "COACH",
  vigilance: [],
  valideParWill: { le: "2026-10-12", source: "essai X5" },
};
