import type { CasConcret } from "../cas";

/** Cas 19 du brouillon : brancher l'IA sur les outils existants. Les ordres de grandeur du site ne sont pas repris. */
export const outilsBranches: CasConcret = {
  id: "outils-branches",
  version: 1,
  offre: "integration",
  nature: "outils-relies",
  posture: "offre",
  titre: "Brancher l'IA sur vos outils sans changer vos habitudes",
  theme: "Outils",
  promesse: "Vos outils restent, l'IA s'y branche.",
  cible: "Une PME qui a déjà ses outils de messagerie, de notes et de bureautique, et refuse d'en changer.",
  avant: { taches: ["Recopier les données entre outils", "Changer d'habitude pour l'IA", "Ne pas savoir où l'IA agit", "Tout refaire à chaque outil"] },
  etapes: [
    { titre: "La carte", ligne: "On cartographie vos outils et leurs accès.", detail: "Où l'IA lit, où elle écrit.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/implementation/integrations", mouvement: "image", repli: "outils-relies" } },
    { titre: "Les accès", ligne: "On conçoit les accès à portée limitée.", detail: "Les échanges sont cadrés, les droits limités.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "Les connecteurs", ligne: "On développe les connecteurs, un par un.", detail: "Chacun est validé en recette avant la suite.", visuel: { sorte: "objet", objet: "outils-relies" } },
    { titre: "La production", ligne: "Mise en production avec alertes et suivi des coûts.", detail: "Avec des limites de débit sur chaque flux.", visuel: { sorte: "objet", objet: "pile-notifications" } },
    { titre: "Le support", ligne: "Le support continue dans la durée.", detail: "Vous fournissez les accès et validez en recette.", visuel: { sorte: "objet", objet: "liste-taches" } },
  ],
  resteHumain: "Fournir les accès, valider en recette, arbitrer les coûts.",
  resteHumainApresEtape: 3,
  resultat: "L'IA agit dans vos outils actuels.",
  faits: [
    { id: "etapes-ecrites", enonce: "Les étapes de l'intégration sont écrites sur le site.", valeurs: [], source: "site", preuve: "src/content/implementation-fr-overrides.ts, lignes 1097-1116." },
    { id: "ordres-de-grandeur", enonce: "Les chiffres de livraison du site sont des ordres de grandeur, pas des performances constatées.", valeurs: [], source: "code", preuve: "src/content/implementation.ts, lignes 360-363." },
  ],
  documentPromis: { nom: "Schéma de l'intégration", finCadeauId: "fin-if-cadeau-integration" },
  mot: "OUTILS",
  vigilance: ["Ne citer aucun client.", "« Vos données restent chez vous » : à faire confirmer par Will avant de l'affirmer.", "Aucun prix, aucun chiffre de livraison du site."],
};
