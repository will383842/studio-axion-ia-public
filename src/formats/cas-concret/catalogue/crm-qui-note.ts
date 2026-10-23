import type { CasConcret } from "../cas";

/** Cas 20 du brouillon : scoring des affaires dans un CRM. Aucune preuve d'usage interne. */
export const crmQuiNote: CasConcret = {
  id: "crm-qui-note",
  version: 1,
  offre: "integration",
  nature: "outils-relies",
  posture: "offre",
  titre: "Un CRM qui note vos affaires et remplit ses fiches",
  theme: "CRM",
  promesse: "Vos commerciaux appellent d'abord les bons comptes.",
  cible: "Une équipe commerciale dont le CRM ou l'ERP est mal rempli et qui ne sait pas quelles affaires prioriser.",
  avant: { taches: ["Trier les affaires au flair", "Remplir les fiches à la main", "Écrire chaque compte rendu", "Prévoir les ventes sans base"] },
  etapes: [
    { titre: "Le cadrage", ligne: "On cadre l'instance commerciale.", detail: "Objets, champs, droits d'accès et cas prioritaire.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/implementation/crm-erp", mouvement: "image", repli: "outils-relies" } },
    { titre: "Le modèle", ligne: "On relie le CRM à un modèle entraîné.", detail: "Il apprend de l'historique des affaires gagnées et perdues.", visuel: { sorte: "objet", objet: "outils-relies" } },
    { titre: "Les scores", ligne: "Les scores arrivent dans les champs existants.", detail: "Mise en production progressive, sans doublon.", visuel: { sorte: "objet", objet: "dossier-classe" } },
    { titre: "Les synthèses", ligne: "Les synthèses de comptes remplissent les fiches.", detail: "Au même endroit que vos informations actuelles.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "Le recalibrage", ligne: "Le scoring est recalibré dans la durée.", detail: "Il suit l'évolution de vos affaires.", visuel: { sorte: "objet", objet: "barres-avant-apres" } },
  ],
  resteHumain: "La vente, l'appel, la décision.",
  resteHumainApresEtape: 3,
  resultat: "Les bons comptes en haut de la liste.",
  faits: [
    { id: "scores-champs-existants", enonce: "Les scores et synthèses arrivent dans les champs existants, sans doublon.", valeurs: [], source: "site", preuve: "src/content/implementation-fr-overrides.ts, lignes 633-680." },
  ],
  documentPromis: { nom: "Schéma de l'intégration", finCadeauId: "fin-if-cadeau-integration" },
  mot: "SCORE",
  vigilance: ["Aucun gain de ventes annoncé.", "Ne citer aucun client.", "Écran à redessiner : aucune interface publique montrable."],
};
