import type { CasConcret } from "../cas";

/** Cas 15 du brouillon : tri automatique de personnes, la décision reste humaine. Le sigle en capitales ne s'écrit pas dans ce qui est montré. */
export const cvTries: CasConcret = {
  id: "cv-tries",
  version: 1,
  offre: "integration",
  nature: "automatisation",
  posture: "offre",
  titre: "Les candidatures triées, chaque candidat répondu",
  theme: "Candidatures",
  promesse: "Chaque candidat a sa réponse, sans effort.",
  cible: "Un recruteur ou une PME qui reçoit trop de candidatures et laisse des candidats sans nouvelles.",
  avant: { taches: ["Lire chaque dossier à la main", "Noter les gens au flair", "Écrire chaque refus", "Oublier de répondre à tel ou tel"] },
  etapes: [
    { titre: "Le classement", ligne: "Chaque dossier reçu est lu, puis classé.", detail: "Selon ce que le poste demande.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/implementation/par-fonction/ressources-humaines", mouvement: "image", repli: "liste-taches" } },
    { titre: "Les raisons", ligne: "Chaque rang vient avec ses raisons.", detail: "Le recruteur voit pourquoi, pas juste un rang.", visuel: { sorte: "objet", objet: "carte-taches" } },
    { titre: "La présélection", ligne: "Une liste courte va ensuite au recruteur.", detail: "Elle donne la raison de chaque rang.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "Les refus", ligne: "Chaque refus dit pourquoi, en peu de mots.", detail: "Aucun candidat ne reste sans nouvelles.", visuel: { sorte: "objet", objet: "e-mail" } },
    { titre: "Les convocations", ligne: "Puis les rendez-vous et les relances partent seuls.", detail: "À partir du choix fait par le recruteur.", visuel: { sorte: "objet", objet: "calendrier" } },
    { titre: "La décision", ligne: "Un humain reste le seul à décider.", detail: "La décision et l'entretien sont à lui.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
  ],
  resteHumain: "La décision d'embauche et l'entretien.",
  resteHumainApresEtape: 5,
  resultat: "Chaque candidat a sa réponse, et un humain décide.",
  faits: [
    { id: "decision-humaine", enonce: "Un humain reste le décisionnaire.", valeurs: [], source: "site", preuve: "src/content/automatisations.ts, lignes 555-600." },
    { id: "intention-sans-deroule", enonce: "Le site donne l'intention de l'offre, pas son déroulé détaillé.", valeurs: [], source: "site", preuve: "src/content/automatisations.ts, lignes 555-600." },
  ],
  documentPromis: { nom: "Trame d'un tri de candidatures", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "CANDIDAT",
  vigilance: ["Décision humaine : tri automatique de personnes, la décision finale est toujours humaine.", "Sujet sensible : cadre des données personnelles à respecter.", "Ne pas dire « l'IA choisit le candidat ».", "Aucune donnée de candidat à l'écran.", "Ne pas reprendre le chiffre de tri annoncé sur le site : aucune source."],
};
