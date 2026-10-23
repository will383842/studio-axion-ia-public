import type { CasConcret } from "../cas";

/** Cas 2 du brouillon : formation « IA pour bien commencer ». */
export const emailDifficile: CasConcret = {
  id: "email-difficile",
  version: 1,
  offre: "formation",
  posture: "offre",
  titre: "L'e-mail qu'on repousse depuis deux jours",
  theme: "E-mail",
  promesse: "Votre e-mail difficile, enfin écrit.",
  cible: "Un dirigeant ou une équipe qui n'a jamais vraiment ouvert un outil d'IA et craint de mal faire.",
  avant: { taches: ["Repousser l'e-mail délicat", "Réécrire à la main un compte rendu", "Recopier une réponse type", "Ne pas oser lire un devis reçu"] },
  etapes: [
    { titre: "Le cadre", ligne: "On pose le cadre avant de commencer.", detail: "Quel outil, et ce qui ne sort jamais de l'entreprise.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/formations/ia-pour-bien-commencer", mouvement: "image", repli: "programme" } },
    { titre: "La première demande", ligne: "Chacun écrit sa première demande.", detail: "Sur une de ses vraies tâches, reformulée sans nom de personne.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "Le bon ton", ligne: "Une première version au bon ton.", detail: "Puis une correction avec une grille de relecture.", visuel: { sorte: "objet", objet: "e-mail" } },
    { titre: "La synthèse", ligne: "Un document déposé, une synthèse en retour.", detail: "On apprend aussi à repérer quand le dépôt échoue sans prévenir.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "Le compte rendu", ligne: "Des notes éparses deviennent un compte rendu.", detail: "Structuré, puis relu avant diffusion.", visuel: { sorte: "objet", objet: "programme" } },
  ],
  resteHumain: "Relire et décider, à chaque fois.",
  resteHumainApresEtape: 5,
  resultat: "Chacun repart avec ses demandes testées et sa règle d'usage.",
  faits: [
    { id: "duree-quatre-heures", enonce: "La formation dure 4 heures, sans prérequis.", valeurs: [4], source: "site", preuve: "src/content/formations/catalog-v2.ts, lignes 160-185." },
    { id: "version-journee", enonce: "La version journée dure 7 heures et compte 4 modules.", valeurs: [7, 4], source: "site", preuve: "src/content/formations/modules/ia-pour-bien-commencer-journee.ts, lignes 1-5." },
  ],
  documentPromis: { nom: "Programme de la formation", finCadeauId: "fin-if-cadeau-formation" },
  mot: "MAIL",
  vigilance: ["Aucune promesse de résultat chiffré.", "Ne pas parler de financement.", "Ne pas dire « certifiante ».", "Ne jamais coller de données personnelles réelles."],
};
