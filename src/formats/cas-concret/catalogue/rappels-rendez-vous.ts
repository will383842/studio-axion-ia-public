import type { CasConcret } from "../cas";

/** Cas 9 du brouillon. */
export const rappelsRendezVous: CasConcret = {
  id: "rappels-rendez-vous",
  version: 1,
  offre: "integration",
  nature: "automatisation",
  posture: "chez-nous",
  titre: "Un rendez-vous réservé : confirmation, veille, une heure avant",
  theme: "Rendez-vous",
  promesse: "Nos rendez-vous ne sont plus oubliés.",
  cible: "Toute entreprise qui prend des rendez-vous commerciaux et subit les absents.",
  avant: { taches: ["Écrire une confirmation à la main", "Oublier de rappeler la veille", "Voir le prospect arriver en retard", "Ne pas savoir qu'un rendez-vous a été pris"] },
  etapes: [
    { titre: "La réservation", ligne: "Le visiteur choisit un créneau.", detail: "Un contrôle détecte la réservation en moins d'une minute.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/appel", mouvement: "image", repli: "calendrier" } },
    { titre: "L'alerte", ligne: "Une alerte arrive en interne.", detail: "L'équipe sait tout de suite qu'un rendez-vous est pris.", visuel: { sorte: "objet", objet: "telephone-notification" } },
    { titre: "La confirmation", ligne: "Une confirmation part à l'invité.", detail: "Elle part depuis l'adresse de l'entreprise, pas depuis un agenda.", visuel: { sorte: "objet", objet: "e-mail" } },
    { titre: "Le rappel de la veille", ligne: "Un rappel part la veille.", detail: "Un message court, avec l'heure et le lien.", visuel: { sorte: "objet", objet: "calendrier" } },
    { titre: "Le dernier rappel", ligne: "Un dernier rappel part une heure avant.", detail: "Le visiteur n'oublie plus.", visuel: { sorte: "objet", objet: "chrono" } },
  ],
  resteHumain: "Tenir le rendez-vous.",
  resteHumainApresEtape: 5,
  resultat: "Chaque rendez-vous est confirmé et rappelé.",
  faits: [
    { id: "detection-moins-d-une-minute", enonce: "Une réservation est détectée en moins de 60 secondes.", valeurs: [60], source: "code", preuve: "src/server/queue/workers/calendly-poll-worker.ts : latence de détection mesurée le 09/08/2026." },
    { id: "trois-messages", enonce: "Trois messages partent : confirmation, veille, une heure avant.", valeurs: [3, 1], source: "code", preuve: "src/server/calendly/rappels-appel.ts, ligne 7." },
  ],
  documentPromis: { nom: "Structure des rappels de rendez-vous", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "RAPPEL",
  vigilance: ["Ne pas annoncer de baisse des absents sans mesure.", "Ne pas filmer une vraie boîte de réception."],
  enServiceVerifie: { le: "2026-10-11", source: "Relecture du code : aucun interrupteur pour les trois e-mails (rappels-appel.ts). Mise en service non constatée en production." },
};
