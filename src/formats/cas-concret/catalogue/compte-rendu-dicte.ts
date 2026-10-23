import type { CasConcret } from "../cas";

/** Cas 3 du brouillon : formation « IA pour les commerciaux ». */
export const compteRenduDicte: CasConcret = {
  id: "compte-rendu-dicte",
  version: 1,
  offre: "formation",
  posture: "offre",
  titre: "Le compte rendu de rendez-vous dicté",
  theme: "Compte rendu",
  promesse: "Compte rendu fait avant de quitter le parking.",
  cible: "Un commercial ou un dirigeant qui vend lui-même et écrit ses comptes rendus le soir, ou jamais.",
  avant: { taches: ["Préparer un rendez-vous au vol", "Écrire le compte rendu le soir", "Classer sa tournée sans critères", "Subir l'objection sur le prix"] },
  etapes: [
    { titre: "La préparation", ligne: "Une fiche de rendez-vous prête.", detail: "À partir des seuls documents publics du prospect.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/formations/ia-pour-les-commerciaux", mouvement: "image", repli: "programme" } },
    { titre: "La dictée", ligne: "On dicte en sortant du rendez-vous.", detail: "Trois minutes de dictée suffisent.", visuel: { sorte: "objet", objet: "telephone-capture" } },
    { titre: "Le compte rendu", ligne: "Tout sort d'un coup.", detail: "Le compte rendu interne, le mail de suivi et les prochaines étapes datées.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "Le tri", ligne: "Le portefeuille est trié sur des critères posés avant.", detail: "On regarde de combien le classement bouge une fois corrigé.", visuel: { sorte: "objet", objet: "carte-taches" } },
    { titre: "Les objections", ligne: "Une réponse écrite pour chaque objection.", detail: "On s'entraîne sur celles de son marché.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "Les chiffres", ligne: "Chaque chiffre est vérifié.", detail: "Source ouverte : on garde ce qu'elle porte, on barre le reste.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
  ],
  resteHumain: "Relire ce qui part sous sa signature.",
  resteHumainApresEtape: 6,
  resultat: "Le compte rendu est fait avant le retour au bureau.",
  faits: [
    { id: "duree-un-jour", enonce: "La formation dure une journée.", valeurs: [1], source: "site", preuve: "src/content/formations/catalog-v2.ts, lignes 1906-1912." },
    { id: "dictee-trois-minutes", enonce: "La dictée dure trois minutes.", valeurs: [3], source: "site", preuve: "src/content/formations/catalog-v2.ts, cas d'usage, environ ligne 1936." },
  ],
  documentPromis: { nom: "Programme de la formation", finCadeauId: "fin-if-cadeau-formation" },
  mot: "DICTEE",
  vigilance: ["Ne pas promettre « plus de ventes ».", "Aucun chiffre de marché sans source."],
};
