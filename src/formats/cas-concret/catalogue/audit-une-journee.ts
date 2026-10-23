import type { CasConcret } from "../cas";

/** Cas 5 du brouillon : audit sur place d'une journée. */
export const auditUneJournee: CasConcret = {
  id: "audit-une-journee",
  version: 1,
  offre: "audit",
  posture: "offre",
  titre: "L'audit sur place d'une journée",
  theme: "Audit",
  promesse: "Un plan écrit sous 48 h ouvrées.",
  cible: "Le dirigeant d'une PME, sur un seul site, qui sent qu'il perd du temps mais ne sait pas par où commencer avec l'IA.",
  avant: { taches: ["Ne pas savoir quelles tâches prennent du temps", "Tester l'IA seul, sans méthode", "Hésiter entre tous les outils", "Ne pas pouvoir chiffrer"] },
  etapes: [
    { titre: "Le cadrage", ligne: "Un appel pour cadrer.", detail: "Le contexte et la zone prioritaire, en 15 minutes.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/audit/tpe-1-jour", mouvement: "image", repli: "calendrier" } },
    { titre: "La journée", ligne: "Une journée complète sur place.", detail: "De 9 h à 17 h, poste par poste.", visuel: { sorte: "objet", objet: "carte-taches" } },
    { titre: "Les essais", ligne: "L'IA testée en direct avec l'équipe.", detail: "Sur 2 ou 3 cas réels.", visuel: { sorte: "objet", objet: "outils-relies" } },
    { titre: "Le rapport", ligne: "Un rapport écrit.", detail: "De 8 à 15 pages, avec 3 à 5 actions rapides.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "La remise", ligne: "Remis sous 48 h ouvrées.", detail: "En règle générale ; 7 jours au plus tard.", visuel: { sorte: "objet", objet: "e-mail" } },
  ],
  resteHumain: "Vous tranchez seul ce que vous lancez en premier.",
  resteHumainApresEtape: 5,
  resultat: "Un plan écrit, prêt à être exécuté.",
  faits: [
    { id: "cadrage-quinze-minutes", enonce: "L'appel de cadrage dure 15 minutes.", valeurs: [15], source: "site", preuve: "src/content/audit-detail-configs.ts, lignes 189-300." },
    { id: "journee-neuf-dix-sept", enonce: "Une journée sur place, de 9 h à 17 h.", valeurs: [1, 9, 17], source: "site", preuve: "src/content/audit-detail-configs.ts, ligne 199." },
    { id: "cas-reels", enonce: "Des essais sur 2 ou 3 cas réels.", valeurs: [2, 3], source: "site", preuve: "src/content/audit-detail-configs.ts, lignes 189-300." },
    { id: "rapport-pages-actions", enonce: "Un rapport de 8 à 15 pages, avec 3 à 5 actions rapides.", valeurs: [8, 15, 3, 5], source: "site", preuve: "src/content/audit-detail-configs.ts, lignes 217 et 245-258." },
    { id: "remise-quarante-huit-heures", enonce: "Rapport remis sous 48 h ouvrées en règle générale, 7 jours au plus tard.", valeurs: [48, 7], source: "site", preuve: "src/content/audit-detail-configs.ts, lignes 217 et 251-258." },
  ],
  documentPromis: { nom: "Exemple de plan d'audit", finCadeauId: "fin-if-cadeau-audit" },
  mot: "AUDIT",
  vigilance: ["Le temps libéré est une estimation de travail, pas un engagement de résultat.", "Aucun gain chiffré, aucun prix.", "Ne pas parler de l'usage des données sans l'accord de Will."],
};
