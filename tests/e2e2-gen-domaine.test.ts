/**
 * Vérification E2E n° 2, parcours n° 10 : le filtre « Hors du domaine d'Axion-IA » laissait passer un sujet étranger
 * dès qu'il portait UN mot d'outil (Excel, IA, CRM, ChatGPT, automatiser) : « Automatiser avec Excel la déclaration
 * d'impôts de mon foyer », « Le CRM idéal pour gérer mon club de pétanque » (vus à l'écran), puis courses, CV, bac,
 * Spotify, Tinder (sonde). Après correction : des outils seuls ne font pas un sujet d'entreprise. Batterie de 40
 * formulations, étrangères ET légitimes (les vrais sujets d'Axion ne sont pas bloqués).
 */
import { describe, expect, it } from "vitest";
import { lectureDuSens, rattacherAuDomaine } from "@/donnees/generateur/domaine-axion";

/** Étrangers « habillés » d'un mot d'outil : tous arrêtés (0 €). */
const ETRANGERS = [
  "Automatiser avec Excel la déclaration d'impôts de mon foyer",
  "Le CRM idéal pour gérer mon club de pétanque",
  "Faire ses courses de la semaine avec ChatGPT",
  "ChatGPT pour écrire mon CV et trouver un emploi",
  "L'IA pour réviser le bac de mon fils",
  "L'IA pour réviser le bac du fils",
  "Créer mes playlists Spotify avec l'IA",
  "Réussir ses rencontres sur Tinder grâce à l'IA",
  "Un prompt ChatGPT pour faire annuler une amende",
  "Organiser mon mariage avec un tableur",
  "Les paris sportifs prédits par l'IA",
  "Planifier les vacances en famille avec ChatGPT",
  "Un tableau Excel pour suivre mon régime",
  "Automatiser l'arrosage de mon potager",
  "Une recette de cuisine générée par l'IA",
  "Mon budget familial dans un tableur",
  "L'IA et mes économies personnelles",
  "Automatiser ma maison avec un robot",
  "Un logiciel pour gérer mes photos de vacances",
  "Excel pour la liste de courses",
];

/** Vrais sujets d'Axion : aucun n'est bloqué. */
const LEGITIMES = [
  "Relancer automatiquement les devis qui dorment",
  "Une personne qui passe ses semaines à recopier des données dans des tableurs",
  "Former vos équipes à ChatGPT en une journée",
  "Automatiser la saisie des factures fournisseurs",
  "Le tableau de bord que votre DAF attend",
  "Pourquoi vos commerciaux perdent 2 heures par jour dans le CRM",
  "Un chatbot pour le service client d'une PME",
  "Par où commencer pour automatiser son entreprise",
  "Les comptes rendus de réunion écrits par l'IA",
  "Trier les CV avec l'IA sans perdre les bons candidats",
  "Excel coûte plus cher que vous croyez",
  "Vos fichiers Excel qui ne se parlent pas",
  "Prospection LinkedIn : ce que l'IA fait mieux qu'un stagiaire",
  "Rapprochement bancaire : trois jours gagnés par mois",
  "Ce que l'IA change pour un artisan du bâtiment",
  "Répondre aux mails clients en deux minutes",
  "Le standard téléphonique qui ne dort jamais",
  "Votre site web vous ramène-t-il des clients ?",
  "Pourquoi les PME ont peur de l'IA",
  "Combien coûte vraiment une tâche répétitive",
  "ChatGPT : les cinq erreurs qui vous font perdre vos clients",
];

describe("E2E-2 parcours n° 10 · un mot d'outil seul ne fait pas un sujet d'entreprise", () => {
  it.each(ETRANGERS)("arrêté : « %s »", (idee) => {
    expect(rattacherAuDomaine(idee, { valides: [] }).ok, JSON.stringify(lectureDuSens(idee))).toBe(false);
  });

  it.each(LEGITIMES)("rattaché : « %s »", (idee) => {
    expect(rattacherAuDomaine(idee, { valides: [] }).ok, JSON.stringify(lectureDuSens(idee))).toBe(true);
  });

  it("un pilier choisi ne fait pas passer des outils au service de la vie privée", () => {
    expect(rattacherAuDomaine("Automatiser avec Excel la déclaration d'impôts de mon foyer", { valides: [] }, "automatiser-administratif").ok).toBe(false);
    expect(rattacherAuDomaine("Le CRM idéal pour gérer mon club de pétanque", { valides: [] }, "automatiser-ventes").ok).toBe(false);
  });

  it("la batterie compte au moins 30 formulations", () => {
    expect(ETRANGERS.length + LEGITIMES.length).toBeGreaterThanOrEqual(30);
  });
});
