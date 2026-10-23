import type { CasConcret } from "../cas";

/** Cas 1 du brouillon : le cycle d'une session de formation. */
export const cycleDeFormation: CasConcret = {
  id: "cycle-de-formation",
  version: 1,
  offre: "formation",
  posture: "chez-nous",
  titre: "Un cycle de formation qui se déroule tout seul",
  theme: "Formation",
  promesse: "Chaque formation suit son cours, sans relance.",
  cible: "Un organisme de formation, ou un dirigeant qui organise des sessions et court après convocations, présences et questionnaires.",
  avant: { taches: ["Écrire chaque convocation à la main", "Faire signer des feuilles", "Courir après les retours", "Oublier le suivi après coup"] },
  etapes: [
    { titre: "La session", ligne: "La session est créée dans la console.", detail: "Une personne la crée, et tout le reste suit.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/formations", mouvement: "image", repli: "calendrier" } },
    { titre: "La convocation", ligne: "Cinq jours avant, la convocation part.", detail: "Un rappel plus tôt est aussi prévu.", visuel: { sorte: "objet", objet: "e-mail" } },
    { titre: "La présence", ligne: "Le jour même, les liens de présence partent.", detail: "Chacun signe en ligne, sans papier.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "L'état", ligne: "La session passe seule en cours, puis faite.", detail: "Le jour qui suit la fin, elle est close.", visuel: { sorte: "objet", objet: "chrono" } },
    { titre: "Le questionnaire", ligne: "Le jour suivant, un retour est demandé.", detail: "La preuve de suivi part, si le test est fait.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "Le suivi", ligne: "Trente jours après, un mot de suivi part.", detail: "C'est le tout dernier, et nul ne l'a lancé.", visuel: { sorte: "objet", objet: "telephone-notification" } },
  ],
  resteHumain: "Créer la session, la faire vivre, valider ce qui compte.",
  resteHumainApresEtape: 1,
  resultat: "Chaque session se déroule sans relance.",
  faits: [
    { id: "convocation-cinq-jours", enonce: "La convocation part 5 jours avant la session.", valeurs: [5], source: "code", preuve: "src/server/queue/workers/certifexemple-formation-crons-worker.ts, lignes 16-21 et 104-124." },
    { id: "suivi-trente-jours", enonce: "Le questionnaire de suivi part 30 jours après la session.", valeurs: [30], source: "code", preuve: "src/server/queue/workers/certifexemple-formation-crons-worker.ts, lignes 16-21 et 104-124." },
    { id: "cloture-lendemain", enonce: "La session passe à réalisée le lendemain de sa fin.", valeurs: [], source: "code", preuve: "src/server/certifexemple/formations/crons.ts, lignes 12 et 42." },
  ],
  documentPromis: { nom: "Calendrier d'un cycle de formation", finCadeauId: "fin-if-cadeau-formation" },
  mot: "SESSION",
  vigilance: ["Ne pas dire « conforme Certifexemple » ni « certifié ».", "Ne pas afficher de vraie feuille de présence ni de vrai nom.", "Ne pas promettre que tout est automatique : une personne valide les pièces importantes.", "Aucun gain de temps chiffré."],
  enServiceVerifie: { le: "2026-10-11", source: "Relecture du code (brouillon du catalogue, cas 1) : aucun interrupteur global trouvé pour ce cycle. Mise en service non constatée en production." },
};
