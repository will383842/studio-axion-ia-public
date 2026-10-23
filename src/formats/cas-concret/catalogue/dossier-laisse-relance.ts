import type { CasConcret } from "../cas";

/** Cas 10 du brouillon : un dossier commencé et laissé, le kit part, puis deux rappels. */
export const dossierLaisseRelance: CasConcret = {
  id: "dossier-laisse-relance",
  version: 1,
  offre: "integration",
  nature: "automatisation",
  posture: "chez-nous",
  titre: "Un dossier commencé et laissé : le kit part, puis les rappels",
  theme: "Relance",
  promesse: "On relance sans jamais y penser.",
  cible: "Toute entreprise dont le formulaire en plusieurs étapes est souvent abandonné.",
  avant: { taches: ["Perdre ceux qui ne finissent pas", "Relancer à la main, ou pas", "Relancer quelqu'un qui a fini", "Oublier de relancer"] },
  etapes: [
    { titre: "Les coordonnées", ligne: "La personne laisse ses coordonnées.", detail: "Un formulaire en plusieurs étapes.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/apporteur-affaires", mouvement: "image", repli: "e-mail" } },
    { titre: "Le lien", ligne: "Elle reçoit le lien du dossier complet.", detail: "Une confirmation part aussitôt.", visuel: { sorte: "objet", objet: "bulle-lien" } },
    { titre: "Le kit", ligne: "Sans dossier fini, le kit part ensuite.", detail: "30 minutes après le premier écran validé.", visuel: { sorte: "objet", objet: "chrono" } },
    { titre: "Premier rappel", ligne: "Deux jours après, un premier rappel part.", detail: "Un message court, avec le lien du dossier.", visuel: { sorte: "objet", objet: "calendrier" } },
    { titre: "Second rappel", ligne: "Sept jours après, un second rappel part.", detail: "Le dernier, puis plus rien.", visuel: { sorte: "objet", objet: "telephone-notification" } },
    { titre: "La fin", ligne: "Si le dossier est terminé, les rappels s'arrêtent.", detail: "Les rappels en attente sont supprimés seuls.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
  ],
  resteHumain: "Rien sur ces rappels, l'appel reste un choix humain.",
  resteHumainApresEtape: 6,
  resultat: "Aucun dossier laissé, aucune relance en trop.",
  faits: [
    { id: "kit-trente-minutes", enonce: "Le kit part 30 minutes après le premier écran validé.", valeurs: [30], source: "code", preuve: "src/features/commercial-application/relances-lead-apporteur.ts, lignes 1 et 23-27." },
    { id: "rappel-deux-jours", enonce: "Un premier rappel part 2 jours après.", valeurs: [2], source: "code", preuve: "src/features/commercial-application/relances-lead-apporteur.ts, lignes 1 et 23-27." },
    { id: "rappel-sept-jours", enonce: "Un second rappel part 7 jours après.", valeurs: [7], source: "code", preuve: "src/features/commercial-application/relances-lead-apporteur.ts, lignes 1 et 23-27." },
  ],
  documentPromis: { nom: "Structure des relances d'un dossier", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "RELANCE",
  vigilance: ["Ne pas dire que cela fait gagner un nombre de candidats : rien de mesuré dans les fichiers lus.", "Les rappels portent sur une démarche que la personne a elle-même engagée.", "Ne montrer aucune adresse e-mail réelle."],
  enServiceVerifie: { le: "2026-10-11", source: "Relecture du code (brouillon du catalogue, cas 10) : relances et suppression à l'arrivée du dossier. Mise en service non constatée en production." },
};
