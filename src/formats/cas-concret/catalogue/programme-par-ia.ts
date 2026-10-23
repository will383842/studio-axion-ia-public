import type { CasConcret } from "../cas";

/** Cas 4 du brouillon : un programme de formation écrit par l'IA, validé par une personne. */
export const programmeParIa: CasConcret = {
  id: "programme-par-ia",
  version: 1,
  offre: "formation",
  posture: "chez-nous",
  titre: "Un programme écrit par l'IA, validé par un humain",
  theme: "Programme",
  promesse: "L'IA écrit nos programmes, un humain valide.",
  cible: "Un organisme de formation, ou une direction RH qui monte des parcours internes et veut aller plus vite sans perdre le contrôle.",
  avant: { taches: ["Partir d'une page blanche", "Rédiger chaque module à la main", "Vérifier la cohérence du programme", "Tout assembler à la main"] },
  etapes: [
    { titre: "L'intention", ligne: "On indique l'intention de la formation.", detail: "Le choix de l'intention reste humain.", visuel: { sorte: "objet", objet: "champ-commentaire" } },
    { titre: "La structure", ligne: "L'IA propose la structure du programme.", detail: "Elle part de l'intention, pas d'une page blanche.", visuel: { sorte: "objet", objet: "programme" } },
    { titre: "La note", ligne: "Une grille note la qualité de la structure.", detail: "Si la note est trop basse, l'IA reprend, en nombre de passes limité.", visuel: { sorte: "objet", objet: "barres-avant-apres" } },
    { titre: "Le contenu", ligne: "L'IA rédige le contenu du programme.", detail: "Module par module, à partir de la structure.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "Première validation", ligne: "Une personne valide le contenu.", detail: "L'outil ne peut pas se valider lui-même.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "L'assemblage", ligne: "Les pièces sont assemblées, puis revalidées.", detail: "Une deuxième validation humaine porte sur l'assemblage.", visuel: { sorte: "objet", objet: "dossier-classe" } },
  ],
  resteHumain: "Les deux validations, l'animation, le choix de l'intention.",
  resteHumainApresEtape: 5,
  resultat: "Un programme écrit vite, relu par une personne.",
  faits: [
    { id: "deux-validations", enonce: "Deux validations humaines : le contenu, puis l'assemblage.", valeurs: [2], source: "code", preuve: "src/server/queue/workers/certifexemple-formation-engine-worker.ts, lignes 1-25." },
    { id: "reprise-limitee", enonce: "Le nombre de reprises de la structure est limité.", valeurs: [], source: "code", preuve: "src/server/queue/workers/certifexemple-formation-engine-worker.ts, lignes 1-25." },
  ],
  documentPromis: { nom: "Schéma de la création d'un programme", finCadeauId: "fin-if-cadeau-formation" },
  mot: "PROGRAMME",
  vigilance: ["Ne pas dire « programme conforme Certifexemple ».", "Ne pas dire que l'IA remplace le formateur.", "Insister sur « validé par une personne ».", "Sujet très interne : à garder seulement si Will y tient."],
  enServiceVerifie: { le: "2026-10-11", source: "Relecture du code (brouillon du catalogue, cas 4) : le moteur de programme existe, sans interrupteur relevé. Mise en service non constatée en production." },
};
