import type { CasConcret } from "../cas";

/** Cas 12 du brouillon : l'autofacture des formateurs indépendants. Aucune affirmation fiscale. */
export const autofactureFormateurs: CasConcret = {
  id: "autofacture-formateurs",
  version: 1,
  offre: "integration",
  nature: "automatisation",
  posture: "chez-nous",
  titre: "Payer ses formateurs indépendants avec une autofacture",
  theme: "Autofacture",
  promesse: "Nos formateurs sont payés sans facture à réclamer.",
  cible: "Une entreprise qui travaille avec des indépendants et leur court après pour recevoir leurs factures.",
  avant: { taches: ["Réclamer la facture à chacun", "La saisir à la main", "Revoir chaque mention à la main", "Courir après les formateurs"] },
  etapes: [
    { titre: "Le mandat", ligne: "Un mandat écrit est signé avant.", detail: "Le formateur dit oui avant toute séance.", visuel: { sorte: "objet", objet: "contrat-signature" } },
    { titre: "La séance", ligne: "Puis la séance a lieu, comme prévu.", detail: "Le formateur la donne, rien ne change pour lui.", visuel: { sorte: "objet", objet: "calendrier" } },
    { titre: "L'émission", ligne: "Une personne lance la pièce.", detail: "Un seul geste humain, et rien de plus à faire.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "Le garde-fou", ligne: "Sans mandat signé, rien ne part.", detail: "Aucune pièce ne part sans lui.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "La mention", ligne: "La pièce porte la bonne mention.", detail: "Au nom et pour le compte du formateur.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "La contestation", ligne: "Elle lui est envoyée ; il peut la contester.", detail: "Il peut le faire dès qu'il la reçoit.", visuel: { sorte: "objet", objet: "e-mail" } },
  ],
  resteHumain: "Le geste qui lance la pièce, et la réponse à un refus.",
  resteHumainApresEtape: 6,
  resultat: "Plus de facture à réclamer au formateur.",
  faits: [
    { id: "refus-sans-mandat", enonce: "Le système refuse d'émettre sans mandat préalable.", valeurs: [], source: "code", preuve: "src/server/actions/certifexemple/autofacture.ts, lignes 9-24." },
    { id: "mention-autofacturation", enonce: "La pièce porte la mention d'autofacturation, au nom et pour le compte du formateur.", valeurs: [], source: "code", preuve: "src/server/actions/certifexemple/autofacture.ts, lignes 1-45." },
  ],
  documentPromis: { nom: "Schéma du mandat à la contestation", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "MANDAT",
  vigilance: ["Aucune affirmation fiscale : ne rien dire de la régularité ni de la TVA sans relecture par Will, qui n'a ni avocat ni expert-comptable.", "Ne citer aucun taux de commission.", "Sujet précis, risque de jargon : rester sur le geste et le refus sans mandat."],
  enServiceVerifie: { le: "2026-10-11", source: "Relecture du code (brouillon du catalogue, cas 12) : refus sans mandat préalable, émission déclenchée par l'opérateur. Mise en service non constatée en production." },
};
