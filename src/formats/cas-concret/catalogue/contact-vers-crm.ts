import type { CasConcret } from "../cas";

/** Cas 16 du brouillon : posture « offre » (interrupteur de synchronisation non attesté). */
export const contactVersCrm: CasConcret = {
  id: "contact-vers-crm",
  version: 1,
  offre: "integration",
  nature: "outils-relies",
  posture: "offre",
  titre: "Un contact arrive, la fiche se crée dans le CRM",
  theme: "Fiche client",
  promesse: "Vos contacts arrivent dans le CRM sans ressaisie.",
  cible: "Une entreprise dont les formulaires du site et le CRM ne se parlent pas.",
  avant: { taches: ["Recopier chaque demande dans le CRM", "Perdre un contact entre les outils", "Ne pas savoir si la synchro a marché"] },
  etapes: [
    { titre: "Le formulaire", ligne: "Un visiteur envoie un formulaire.", detail: "Contact, audit, devis ou lettre d'information.", visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/contact", mouvement: "image", repli: "e-mail" } },
    { titre: "L'enregistrement", ligne: "La demande est enregistrée, protégée.", detail: "Anti-robot, limite de fréquence, données personnelles chiffrées.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
    { titre: "La boîte d'envoi", ligne: "Une ligne est posée dans une boîte d'envoi.", detail: "Interne, en attente de transmission.", visuel: { sorte: "objet", objet: "dossier-classe" } },
    { titre: "Le CRM", ligne: "Elle est transmise au CRM en quelques secondes.", detail: "La fiche se crée sans ressaisie.", visuel: { sorte: "objet", objet: "outils-relies" } },
    { titre: "Le balayage", ligne: "Un balayage reprend ce qui n'est pas passé.", detail: "Toutes les 10 minutes, en cas de panne ou de CRM injoignable.", visuel: { sorte: "objet", objet: "chrono" } },
  ],
  resteHumain: "Traiter la demande.",
  resteHumainApresEtape: 5,
  resultat: "Chaque contact a sa fiche, sans ressaisie.",
  faits: [
    { id: "balayage-dix-minutes", enonce: "Un balayage reprend ce qui n'est pas passé, toutes les 10 minutes.", valeurs: [10], source: "code", preuve: "src/server/queue/workers/crm-sync-worker.ts, lignes 4-12." },
    { id: "transmission-rapide", enonce: "La fiche est transmise au CRM en quelques secondes.", valeurs: [], source: "code", preuve: "src/server/queue/workers/crm-sync-worker.ts, lignes 4-12." },
  ],
  documentPromis: { nom: "Schéma de l'intégration", finCadeauId: "fin-if-cadeau-integration" },
  mot: "CRM",
  motDit: "C.R.M.",
  vigilance: ["La synchronisation est inerte sans son interrupteur : vérifier qu'il est allumé avant tout « on le fait ».", "Ne pas montrer le dépôt du CRM ni de donnée réelle."],
};
