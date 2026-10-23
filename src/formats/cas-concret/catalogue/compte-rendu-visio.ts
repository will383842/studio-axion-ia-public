import type { CasConcret } from "../cas";

/** Cas 21 du brouillon : posture « offre » (enregistrement en pilote, encore fermé au public). */
export const compteRenduVisio: CasConcret = {
  id: "compte-rendu-visio",
  version: 1,
  offre: "integration",
  nature: "automatisation",
  posture: "offre",
  titre: "Le compte rendu d'une visio rédigé, puis validé",
  theme: "Visio",
  promesse: "Visio finie, compte rendu déjà prêt.",
  cible: "Un dirigeant ou un commercial qui enchaîne les visios et écrit les comptes rendus le soir.",
  avant: { taches: ["Prendre des notes pendant l'échange", "Les réécrire le soir", "Oublier une décision", "Ne pas savoir qui fait quoi"] },
  etapes: [
    { titre: "La transcription", ligne: "La visio est transcrite.", detail: "Un contrôle préalable précède l'extraction.", visuel: { sorte: "objet", objet: "champ-commentaire" } },
    { titre: "Les faits", ligne: "Les faits sont extraits, puis vérifiés.", detail: "Rattachés à la bonne fiche, puis consolidés.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "La rédaction", ligne: "L'ébauche, puis le compte rendu, sont rédigés.", detail: "À partir des seuls faits vérifiés.", visuel: { sorte: "objet", objet: "rapport" } },
    { titre: "La validation", ligne: "Le compte rendu est vérifié.", detail: "Puis proposé à une personne, à valider.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "L'audio", ligne: "L'audio est purgé à la validation.", detail: "Au plus tard 30 jours après.", visuel: { sorte: "objet", objet: "chrono" } },
  ],
  resteHumain: "Valider le compte rendu et informer les participants.",
  resteHumainApresEtape: 3,
  resultat: "Un compte rendu prêt, à valider.",
  faits: [
    { id: "purge-trente-jours", enonce: "L'audio est purgé à la validation, au plus tard 30 jours après.", valeurs: [30], source: "code", preuve: "src/server/visio/etapes.ts, lignes 2-4." },
    { id: "validation-humaine", enonce: "Le compte rendu est proposé à valider, jamais envoyé seul.", valeurs: [], source: "code", preuve: "src/server/visio/etapes.ts, lignes 2-4." },
  ],
  documentPromis: { nom: "Structure d'un compte rendu de visio", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "VISIO",
  vigilance: ["Sujet sensible : enregistrement d'une personne, accord préalable.", "L'enregistrement est en pilote, encore fermé au public d'après la mémoire de Will : ne pas dire « on enregistre tous nos rendez-vous ».", "Ne montrer aucun extrait réel."],
};
