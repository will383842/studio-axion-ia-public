import type { CasConcret } from "../cas";

/** Cas 14 du brouillon : le site décrit la trame du processus, pas un déroulé constaté. */
export const devisRelances: CasConcret = {
  id: "devis-relances",
  version: 1,
  offre: "integration",
  nature: "automatisation",
  posture: "offre",
  titre: "Les devis non signés se relancent tout seuls",
  theme: "Devis",
  promesse: "Plus aucun devis oublié dans un tiroir.",
  cible: "Un artisan, une PME de services ou un cabinet qui envoie des devis sans toujours relancer.",
  avant: { taches: ["Noter les devis à la main", "Oublier de relancer", "Relancer trop tôt ou trop tard", "Rédiger chaque relance"] },
  etapes: [
    { titre: "Le flux", ligne: "On cartographie le flux réel du devis.", detail: "De l'envoi du devis jusqu'à la signature.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/implementation/par-fonction/ventes-prospection", mouvement: "image", repli: "carte-taches" } },
    { titre: "Les relances", ligne: "On conçoit le déclencheur et les relances.", detail: "Les délais et le ton sont fixés ensemble.", visuel: { sorte: "objet", objet: "chrono" } },
    { titre: "Le feu vert", ligne: "On fixe ce que l'IA fait seule.", detail: "Le reste attend un feu vert.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "Le branchement", ligne: "On branche vos outils, puis on teste.", detail: "Sur des cas réels, avant toute bascule.", visuel: { sorte: "objet", objet: "outils-relies" } },
    { titre: "La bascule", ligne: "On bascule flux par flux.", detail: "Sans tout changer d'un coup.", visuel: { sorte: "objet", objet: "dossier-classe" } },
    { titre: "Le suivi", ligne: "Le suivi, puis la remise de la documentation.", detail: "On suit le volume de relances.", visuel: { sorte: "objet", objet: "barres-avant-apres" } },
  ],
  resteHumain: "Traiter les exceptions et conclure la vente.",
  resteHumainApresEtape: 6,
  resultat: "Chaque devis envoyé est suivi jusqu'à la réponse.",
  faits: [
    { id: "trame-sans-resultat", enonce: "Le site décrit la trame du processus, pas un résultat constaté.", valeurs: [], source: "site", preuve: "src/content/implementation-fr-overrides.ts, lignes 349-366." },
  ],
  documentPromis: { nom: "Trame d'une relance de devis", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "DEVIS",
  vigilance: ["Ne pas dire « on l'a fait chez un client ».", "Ne pas reprendre le taux de signature annoncé sur le site : aucune source derrière.", "Aucun prix."],
};
