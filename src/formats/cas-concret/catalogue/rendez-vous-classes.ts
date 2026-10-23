import type { CasConcret } from "../cas";

/** Cas 22 du brouillon : chaque rendez-vous classé dans le bon dossier. */
export const rendezVousClasses: CasConcret = {
  id: "rendez-vous-classes",
  version: 1,
  offre: "integration",
  nature: "outils-relies",
  posture: "chez-nous",
  titre: "Chaque rendez-vous classé dans le bon dossier",
  theme: "Rendez-vous",
  promesse: "Chaque rendez-vous tombe dans le bon dossier.",
  cible: "Une entreprise dont le calendrier mélange clients, candidats, partenaires et salons.",
  avant: { taches: ["Trier les rendez-vous à la main", "Mélanger candidat et prospect", "Compter de faux rendez-vous", "Se tromper de dossier"] },
  etapes: [
    { titre: "La réservation", ligne: "Un rendez-vous est réservé dans le calendrier.", detail: "Dans l'outil de calendrier de l'entreprise.", visuel: { sorte: "objet", objet: "calendrier" } },
    { titre: "La lecture", ligne: "Le site lit son type une seule fois.", detail: "À l'enregistrement, pas ensuite.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "L'identifiant", ligne: "Il reconnaît le type par son identifiant.", detail: "Sinon par le nom, si l'identifiant manque.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "Le doute", ligne: "Dans le doute, il le range en autre.", detail: "Jamais de rendez-vous classé par supposition.", visuel: { sorte: "objet", objet: "dossier-classe" } },
    { titre: "Les effets", ligne: "Selon le type, e-mails et fiche changent.", detail: "Client, apporteur, formateur ou salon.", visuel: { sorte: "objet", objet: "e-mail" } },
  ],
  resteHumain: "Choisir le nom des types dans le calendrier.",
  resteHumainApresEtape: 1,
  resultat: "Chaque rendez-vous dans son dossier.",
  faits: [
    { id: "type-lu-une-fois", enonce: "Le site lit le type du rendez-vous une seule fois, à l'enregistrement.", valeurs: [], source: "code", preuve: "src/server/calendly/type-rendez-vous.ts, lignes 1-25." },
    { id: "rangement-autre", enonce: "Dans le doute, le rendez-vous est rangé dans la catégorie autre.", valeurs: [], source: "code", preuve: "src/server/calendly/type-rendez-vous.ts, lignes 1-25." },
  ],
  documentPromis: { nom: "Schéma du classement des rendez-vous", finCadeauId: "fin-if-cadeau-integration" },
  mot: "DOSSIER",
  vigilance: ["Sujet technique, faible pour une vidéo grand public.", "Ne montrer aucun vrai rendez-vous."],
  enServiceVerifie: { le: "2026-10-11", source: "Relecture du code (brouillon du catalogue, cas 22) : aucun interrupteur ; sans jeton de calendrier, aucune requête n'est émise. Mise en service non constatée en production." },
};
