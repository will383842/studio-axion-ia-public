/**
 * Vérification E2E n° 1 du générateur, problème n° 2 (BLOQUANT) : le contrôle « Hors du domaine d'Axion-IA » se
 * contournait avec un seul mot générique (« dirigeant », « site », « équipe »…). Ordre de Will (03/10) : un sujet se
 * rattache à un pilier PAR LE SENS — au moins un mot d'activité d'Axion ET aucun domaine étranger prédominant ; en cas
 * de doute, arrêt GRATUIT « Ce sujet s'éloigne des activités d'Axion-IA », pilier le plus proche proposé.
 * Batterie de 50 sujets dedans / dehors, plus 21 formulations détournées (PV, amendes, permis, sujets voisins).
 */
import { describe, expect, it } from "vitest";
import { lectureDuSens, phraseHorsDomaine, PILIERS_ACTIVITES_AXION, rattacherAuDomaine } from "@/donnees/generateur/domaine-axion";
import { etapeZero, briefMinimal } from "@/generateur/etape-zero";

const DEDANS = [
  "Les relances de devis faites à la main chaque vendredi soir",
  "La saisie des factures à la main, et ce qu'elle coûte à une PME",
  "Vos fichiers Excel qui ne se parlent pas",
  "Former ses équipes à ChatGPT en une demi-journée",
  "Un chatbot pour répondre aux questions des clients le soir",
  "Automatiser le tri des mails du service client",
  "Le tableau de bord que le dirigeant ouvre chaque lundi",
  "Recopier les bons de commande dans l'ERP : deux heures par jour",
  "Pourquoi vos commerciaux oublient de relancer leurs prospects",
  "L'IA dans un cabinet comptable : ce qui change vraiment",
  "Savoir quoi automatiser en premier dans une PME de 40 salariés",
  "Le tri des CV pour un recrutement de 200 candidats",
  "Les comptes rendus de réunion écrits automatiquement",
  "Une DAF qui passe ses fins de mois sur le rapprochement bancaire",
  "Un site web qui répond aux clients grâce à l'IA",
  "Copilot dans Outlook : ce que vos équipes gagnent",
  "Le planning des techniciens refait à la main chaque matin",
  "Les données clients éparpillées dans cinq logiciels",
  "Un restaurant qui automatise ses commandes fournisseurs",
  "La prospection LinkedIn automatisée sans spam",
  "La documentation technique qu'on ne retrouve jamais",
  "Les tâches répétitives qui épuisent l'administratif",
  "Un audit IA en une journée : ce qu'on regarde",
  "Le chiffrage d'un chantier en dix minutes avec un outil",
  // Le droit comme CLIENT d'Axion (cabinet = PME) reste dedans ; le droit comme CONTENU reste dehors.
  "L'IA dans un cabinet d'avocats",
  "Automatiser les relances d'un cabinet d'avocats",
  "Le marketing digital pour les artisans",
  "Trouver des clients sur LinkedIn",
  "Automatiser le tri des mails du service client d'un traiteur de mariage",
];

/** Formulations DÉTOURNÉES (03/10) : un mot d'IA ou un mot d'activité « faible » collé à un sujet étranger. */
const DETOURNES = [
  "Un prompt ChatGPT pour faire annuler une amende",
  "Contester un PV avec l'aide d'un outil en ligne",
  "Payer ses amendes en ligne avec une appli",
  "Faire sauter un PV grâce à l'IA",
  "Contester un P.V. de stationnement",
  "Flashé par un radar : les démarches",
  "La procédure pour récupérer sa voiture à la fourrière",
  "Le permis de conduire de vos salariés",
  "Récupérer ses points de permis avec ChatGPT",
  "Mon patron peut-il lire mes mails ?",
  "Trouver un bon avocat pour son divorce",
  "Le site web de votre mariage",
  "Le diagnostic immobilier avant de vendre sa maison",
  "Atelier peinture pour les enfants des salariés",
  "Le planning des repas de la semaine",
  "Comment relancer son ex",
  "La procédure d'adoption d'un enfant",
  "Transformation physique en 30 jours",
  "Accompagnement de fin de vie",
  "Former son chien à la propreté",
  "Ma facture d'électricité qui explose",
];

const DEHORS = [
  "Comment un dirigeant peut contester un PV de stationnement",
  "Les meilleures recettes de cuisine pour un site de mariage",
  "Comment contester un PV",
  "Rupture conventionnelle en 3 étapes",
  "Licencié par SMS : c'est légal ?",
  "Mon employeur peut-il me géolocaliser ?",
  "Divorce : qui garde la maison ?",
  "Les chiffres du loto de la semaine",
  "Le meilleur gâteau au chocolat pour l'anniversaire de l'équipe",
  "Préparer ses vacances d'été en famille",
  "Perdre du poids avant l'été quand on est dirigeant",
  "Bitcoin : faut-il investir en bourse cette année ?",
  "Le match de football de dimanche",
  "Votre horoscope de la semaine",
  "Les décisions difficiles d'un patron",
  "Les chiffres qui comptent pour une équipe",
  "Un dirigeant fatigué",
  "Les fichiers de la mairie",
  "Bien choisir son vin pour un repas d'affaires",
  "Le jardinage pour les chefs d'entreprise stressés",
  "Utiliser ChatGPT pour contester une amende de stationnement",
  "Excès de vitesse : récupérer ses points de permis",
  "La succession chez le notaire après un décès",
  "Le loyer impayé d'un locataire",
];

describe("E2E-1 n° 2 · domaine d'Axion-IA par le sens", () => {
  it.each(DEDANS)("dedans : « %s »", (idee) => {
    const r = rattacherAuDomaine(idee, { valides: [] });
    expect(r.ok, JSON.stringify(lectureDuSens(idee))).toBe(true);
  });

  it.each(DEHORS)("dehors : « %s »", (idee) => {
    const r = rattacherAuDomaine(idee, { valides: [] });
    expect(r.ok, JSON.stringify(lectureDuSens(idee))).toBe(false);
    if (!r.ok) expect(PILIERS_ACTIVITES_AXION.map((p) => p.id)).toContain(r.plusProche.id);
  });

  it.each(DETOURNES)("détourné : « %s »", (idee) => {
    const r = rattacherAuDomaine(idee, { valides: [] });
    expect(r.ok, JSON.stringify(lectureDuSens(idee))).toBe(false);
  });

  it("un pilier choisi ne fait pas passer un sujet détourné (amende + ChatGPT)", () => {
    expect(rattacherAuDomaine("Un prompt ChatGPT pour faire annuler une amende", { valides: [] }, "former-equipes-ia").ok).toBe(false);
    expect(rattacherAuDomaine("Contester un PV avec l'aide d'un outil en ligne", { valides: [] }, "sites-logiciels-ia").ok).toBe(false);
  });

  it("un pilier choisi par Will ne fait pas passer un sujet étranger (PV, cuisine)", () => {
    expect(rattacherAuDomaine("Comment un dirigeant peut contester un PV de stationnement", { valides: [] }, "accompagnement-dirigeant").ok).toBe(false);
    expect(rattacherAuDomaine("Les meilleures recettes de cuisine pour un site de mariage", { valides: [] }, "sites-logiciels-ia").ok).toBe(false);
    // Un pilier choisi suffit quand rien d'étranger ne prédomine.
    expect(rattacherAuDomaine("Le vendredi soir des commerciaux", { valides: [] }, "automatiser-ventes").ok).toBe(true);
  });

  it("un mot générique seul (dirigeant, site, équipe, chiffres, fichiers, décisions) ne suffit plus", () => {
    for (const mot of ["dirigeant", "site", "équipe", "chiffres", "fichiers", "décisions"]) expect(rattacherAuDomaine(`Une histoire de ${mot}`, { valides: [] }).ok).toBe(false);
  });

  it("l'arrêt est GRATUIT à l'étape 0, avec la phrase « s'éloigne des activités d'Axion-IA » et le pilier le plus proche", () => {
    for (const idee of ["Comment un dirigeant peut contester un PV de stationnement", "Les meilleures recettes de cuisine pour un site de mariage"]) {
      const z = etapeZero({ maintenant: "2026-10-03T08:00:00.000Z", brief: briefMinimal({ idee, reseaux: ["tiktok"], formatId: "avocat" }), mode: "avatar", matieres: [], preuves: [] });
      expect(z.ok).toBe(false);
      if (!z.ok) {
        expect(z.manque.type).toBe("HORS_DOMAINE");
        expect(z.manque.etape).toBe(0);
        expect(z.manque.ceQuIlFaudrait).toMatch(/s'éloigne des activités d'Axion-IA\. Le thème le plus proche : « .+ »/);
      }
    }
    expect(phraseHorsDomaine({ nom: "X" })).toBe("Ce sujet s'éloigne des activités d'Axion-IA. Le thème le plus proche : « X ».");
  });
});

describe("E2E-1 n° 16 · vocabulaire des manques sans droit", () => {
  it("les libellés de la recette avocat ne parlent ni de loi ni de règle de loi", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/donnees/generateur/recette-avocat-v4.ts", "utf8");
    const libelles = [...src.matchAll(/libelle: "([^"]+)"/g)].map((m) => m[1]);
    expect(libelles.length).toBeGreaterThan(0);
    for (const l of libelles) expect(l).not.toMatch(/\bloi\b|règle de loi/i);
  });
});
