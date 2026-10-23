import type { CasConcret } from "../cas";

/** Cas 17 du brouillon : posture « offre » (flux d'arrière-plan, mise en service non attestée). */
export const devisSigneAlerte: CasConcret = {
  id: "devis-signe-alerte",
  version: 1,
  offre: "integration",
  nature: "outils-relies",
  posture: "offre",
  titre: "Un devis signé en ligne, le dossier avance, l'alerte arrive",
  theme: "Devis",
  promesse: "Vos devis signés en ligne, vos dossiers avancent.",
  cible: "Une entreprise qui fait signer devis ou contrats par courrier ou scan.",
  avant: { taches: ["Envoyer un PDF et attendre", "Scanner la page signée", "Mettre à jour le dossier à la main", "Ne pas savoir qu'un devis est signé"] },
  etapes: [
    { titre: "L'envoi", ligne: "Le devis part en signature électronique.", detail: "Depuis un outil de signature hébergé par l'entreprise.", visuel: { sorte: "objet", objet: "e-mail" } },
    { titre: "La signature", ligne: "Le client signe en ligne.", detail: "Sur son téléphone ou son ordinateur.", visuel: { sorte: "objet", objet: "contrat-signature" } },
    { titre: "Le signal", ligne: "L'outil prévient le site.", detail: "Un appel signé, vérifié, jamais rejoué.", visuel: { sorte: "objet", objet: "outils-relies" } },
    { titre: "Le dossier", ligne: "Le dossier avance dans le suivi interne.", detail: "Pour un devis, sans saisie.", visuel: { sorte: "objet", objet: "dossier-classe" } },
    { titre: "L'alerte", ligne: "Une alerte arrive sur le téléphone.", detail: "Courte, avec l'essentiel.", visuel: { sorte: "objet", objet: "telephone-notification" } },
  ],
  resteHumain: "Envoyer le document au départ, traiter un refus.",
  resteHumainApresEtape: 5,
  resultat: "Le dossier avance dès la signature.",
  faits: [
    { id: "signature-verifiee", enonce: "L'appel de l'outil de signature est signé, vérifié et jamais rejoué deux fois.", valeurs: [], source: "code", preuve: "src/app/api/docuseal/webhook/route.ts, lignes 1-22." },
    { id: "alerte-telephone", enonce: "Pour les autres documents, une alerte part sur le téléphone.", valeurs: [], source: "code", preuve: "src/app/api/docuseal/webhook/route.ts, lignes 1-22." },
  ],
  documentPromis: { nom: "Schéma de l'intégration", finCadeauId: "fin-if-cadeau-integration" },
  mot: "SIGNATURE",
  vigilance: ["Ne pas affirmer de valeur légale de la signature.", "Vérifier que le flux est en service avant tout « on le fait ».", "Le choix de l'outil de signature est une décision de Will."],
};
