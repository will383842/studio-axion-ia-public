import type { CasConcret } from "../cas";

/** Cas 11 du brouillon : les documents d'une formation partent au bon jour. */
export const documentsFormation: CasConcret = {
  id: "documents-formation",
  version: 1,
  offre: "integration",
  nature: "automatisation",
  posture: "chez-nous",
  titre: "Les documents d'une formation partent au bon jour",
  theme: "Documents",
  promesse: "Nos documents de formation partent tout seuls.",
  cible: "Un organisme de formation, ou un service qui produit et envoie à la main convocations, programmes et attestations.",
  avant: { taches: ["Faire chaque pièce à la main", "Chercher la pièce du jour", "Trouver à qui l'envoyer", "En oublier une"] },
  etapes: [
    { titre: "Le passage", ligne: "Toutes les heures, un passage lit chaque session.", detail: "Il voit ce qui est dû.", visuel: { sorte: "objet", objet: "chrono" } },
    { titre: "Les pièces dues", ligne: "Il voit quelles pièces sont dues ce jour.", detail: "Selon le type de client et le jour prévu.", visuel: { sorte: "objet", objet: "liste-taches" } },
    { titre: "Les pièces attendues", ligne: "Il ne fait que les pièces dues.", detail: "Jamais celles qui ne sont pas encore dues.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "Pas de doublon", ligne: "Aucune pièce n'est faite en double.", detail: "Chaque pièce n'existe qu'une fois.", visuel: { sorte: "objet", objet: "dossier-classe" } },
    { titre: "L'envoi", ligne: "Il fait la pièce et l'envoie.", detail: "À la bonne personne, selon le type de client.", visuel: { sorte: "objet", objet: "e-mail" } },
    { titre: "Le rattrapage", ligne: "Un passage manqué est repris au suivant.", detail: "Il suit où en est la session, pas la date.", visuel: { sorte: "objet", objet: "calendrier" } },
  ],
  resteHumain: "Devis, facture et avoir restent faits et validés par une personne.",
  resteHumainApresEtape: 2,
  resultat: "Chaque pièce part au bon jour.",
  faits: [
    { id: "passage-horaire", enonce: "Un passage a lieu toutes les heures.", valeurs: [], source: "code", preuve: "src/server/queue/workers/certifexemple-documents-worker.ts, lignes 1-5." },
    { id: "pieces-attendues", enonce: "Seules les pièces attendues sont produites, jamais celles seulement possibles.", valeurs: [], source: "code", preuve: "src/server/certifexemple/documents/production-au-jalon.ts, lignes 1-30." },
  ],
  documentPromis: { nom: "Calendrier des envois d'une session", finCadeauId: "fin-if-cadeau-automatisation" },
  mot: "PIECES",
  vigilance: ["Décision de Will du 26/08/2026 : le système génère ET envoie selon le type de client.", "Ne pas laisser croire qu'aucune pièce n'est revue.", "Ne pas dire « conforme ».", "Aucune vraie pièce à l'écran."],
  enServiceVerifie: { le: "2026-10-11", source: "Relecture du code (brouillon du catalogue, cas 11) : passage horaire piloté par l'état, aucun interrupteur repéré. Mise en service non constatée en production." },
};
