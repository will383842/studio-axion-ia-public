import type { CasConcret } from "../cas";

/** Cas 8 du brouillon : le cas de la vidéo de référence validée par Will (11/10/2026). Texte de la vidéo : tests/cas-concret/temoin/reference/texte.txt. */
export const recrutementApporteurs: CasConcret = {
  id: "recrutement-apporteurs",
  // V4-3 : version 2 (place de la partie humaine, faits des pastilles et du rappel de la v4).
  version: 2,
  offre: "integration",
  nature: "automatisation",
  posture: "chez-nous",
  titre: "Recruter des apporteurs d'affaires, de l'annonce au contrat",
  theme: "Recrutement",
  promesse: "On recrute nos collaborateurs en 15 minutes.",
  cible: "Un dirigeant qui reçoit des candidatures et passe des heures à les trier, relancer et faire signer.",
  avant: {
    taches: ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous", "Envoyer le contrat", "Courir après la signature"],
    total: "Plus d'une heure",
  },
  etapes: [
    {
      titre: "L'annonce",
      ligne: "La personne voit notre annonce.",
      detail: "La publicité envoie sur la page vidéo des apporteurs d'affaires.",
      // L'annonce de la v4 (`docs/formats/v4-reference/rushes/pub.png`), à déposer à cette clé (voir LISEZ-MOI-IMAGES.md).
      visuel: { sorte: "objet", objet: "telephone-capture", image: { cle: "visuels-cas-concret/recrutement-apporteurs/annonce.png", largeur: 1080, hauteur: 1920 } },
    },
    {
      titre: "L'inscription",
      ligne: "Elle s'inscrit toute seule, en vingt secondes.",
      detail: "Un formulaire court : coordonnées, puis téléphone et une question.",
      visuel: {
        sorte: "ecran",
        adresse: "https://axion-ia.com/fr/apporteur-affaires/video",
        mouvement: "frappe",
        saisies: [
          { champ: "vsl-prenom", texte: "Camille" },
          { champ: "vsl-email", texte: "camille@exemple.fr" },
        ],
        cocher: ["vsl-consent"],
        repli: "telephone-notification",
      },
    },
    {
      titre: "Les e-mails",
      ligne: "Elle reçoit ses e-mails toute seule.",
      detail: "Le kit de présentation, puis des rappels si le dossier n'est pas terminé.",
      visuel: { sorte: "objet", objet: "pile-notifications" },
    },
    {
      titre: "Le rendez-vous",
      ligne: "Elle choisit elle-même son rendez-vous.",
      detail: "Le choix du créneau apparaît juste après l'inscription.",
      visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/appel", mouvement: "image", repli: "calendrier" },
    },
    {
      titre: "Le rappel",
      ligne: "Si elle oublie, le rappel part tout seul.",
      detail: "Un premier rappel, puis un dernier, et plus rien.",
      visuel: { sorte: "objet", objet: "telephone-notification" },
    },
    {
      titre: "Le contrat",
      ligne: "Le contrat part tout seul, elle signe sur son téléphone.",
      detail: "Une fois la signature faite, le dossier est classé.",
      visuel: { sorte: "objet", objet: "contrat-signature" },
    },
  ],
  resteHumain: "Nous, on arrive pour la visio : quinze minutes.",
  // V4-3 : dans le vrai fonctionnement, la visio a lieu après le rappel (étape 5), avant le contrat (étape 6).
  resteHumainApresEtape: 5,
  resultat: "Des heures gagnées, à chaque recrutement.",
  faits: [
    { id: "visio-quinze-minutes", enonce: "L'échange en visio dure 15 minutes.", valeurs: [15], source: "code", preuve: "src/features/commercial-application/invitation-auto.ts : invitation à l'échange de 15 minutes." },
    { id: "delai-invitation", enonce: "L'invitation part 15 à 20 minutes après la réception du dossier.", valeurs: [15, 20], source: "code", preuve: "invitation-auto.ts : délai de 15 minutes, balayage toutes les 5 minutes." },
    { id: "filet-vingt-quatre-heures", enonce: "Sans réservation après 24 heures, l'invitation part quand même.", valeurs: [24], source: "code", preuve: "invitation-auto.ts : filet à 24 heures." },
    { id: "rappels-invitation", enonce: "Sans réservation, un rappel au jour 3 puis un dernier au jour 7.", valeurs: [3, 7], source: "code", preuve: "src/features/commercial-application/relances-invitation-apporteur.ts." },
    { id: "relances-dossier", enonce: "Sans dossier terminé, des rappels aux jours 2 et 7.", valeurs: [2, 7], source: "code", preuve: "src/features/commercial-application/relances-lead-apporteur.ts." },
    { id: "inscription-vingt-secondes", enonce: "Elle s'inscrit toute seule, en vingt secondes.", valeurs: [20], source: "site", preuve: "L'écran du formulaire affiche « Parlons de vous · 20 secondes »." },
    { id: "zero-tri-manuel", enonce: "Zéro candidature à trier, zéro relance, zéro papier (pastilles « 0 » de la v4).", valeurs: [0], source: "will", preuve: "Pastilles du plan s2 de la vidéo de référence v4 (docs/formats/v4-reference/v4.html), validée par Will." },
    { id: "rappel-montre", enonce: "La notification de rappel montrée : « Rappel : notre échange demain à 14:00 » (heure d'exemple).", valeurs: [14, 0], source: "will", preuve: "Notification du plan s11 de la vidéo de référence v4 (docs/formats/v4-reference/v4.html), validée par Will." },
    { id: "quinze-minutes-de-notre-temps", enonce: "On recrute nos collaborateurs en quinze minutes : c'est tout le temps que nous y passons (l'échange en visio), le reste est automatique.", valeurs: [15], source: "will", preuve: "Promesse de la vidéo de référence v4, confirmée par Will le 14/10/2026 (choix A)." },
    { id: "plus-d-une-heure", enonce: "Plus d'une heure, pour chaque personne.", valeurs: [1], source: "estimation", preuve: "Phrase de la vidéo de référence validée par Will le 11/10/2026, dite telle quelle." },
  ],
  conformite: {
    rgpd: { phrase: "Tout est conforme au R.G.P.D. : cent pour cent automatique, sans aucune intervention manuelle.", source: "will", le: "2026-10-11" },
  },
  documentPromis: { nom: "Structure de l'automatisation", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "IA",
  motDit: "I.A.",
  vigilance: [
    "Ne pas dire « tout est automatique » : les e-mails d'issue de l'échange sont relus avant envoi.",
    "Aucun nom de candidat à l'écran, aucune promesse de revenus.",
    "Le contrat lui-même se signe dans un autre espace, non montré ici.",
  ],
  enServiceVerifie: { le: "2026-10-11", source: "Vidéo de référence v10 validée par Will, qui décrit cette chaîne en service." },
  valideParWill: { le: "2026-10-11", source: "texte de la vidéo de référence v10, validé par Will" },
};
