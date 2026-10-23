import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { briquesAuChoix, CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";

const schema = z.object({
  plans: z.enum(["deux", "trois", "quatre"]).default("trois"),
  extraitsCourts: z.boolean().default(true),
  generique: z.boolean().default(true),
});

export const formatPodcast: DefinitionFormat = {
  id: "podcast",
  version: 1,
  nom: "Podcast type interview",
  nomCourt: "Podcast",
  accroche: "Interview à deux, plusieurs plans",
  description: "Un hôte, un invité, une vraie conversation. Et des extraits courts pour les réseaux.",
  icone: "micro",
  statut: "bientot",
  /** Vidéos sur le site (lot S1) : conseil du plan, la décision est le réglage `siteGenerateurs.podcast`. */
  site: "oui",
  chapitresWeb: { rattaches: ["relance"] },
  famille: "conversation",
  codeClassement: "PO",
  declinaison: "ouverture-fin",
  durees: { valeursSec: [180, 300, 600, 1200, 1800], parDefautSec: 600, extraitsCourtsSec: [30, 60] },
  ratios: ["16:9", "9:16"],
  ratioMaitre: "16:9",
  miseEnPage: "multi-plans",
  miseEnPageParRatio: { "16:9": "multi-plans", "9:16": "plein-ecran" },
  personnages: { min: 2, max: 2, roles: ["Hôte", "Invité"], sources: ["double", "rush"] },
  entrees: [],
  etapes: ["sujet", "script", "distribution", "reglages", "apercu", "fabrication"],
  reglages: {
    schema,
    champs: [
      {
        cle: "plans",
        libelle: "Nombre de plans",
        type: "choix",
        options: [
          { valeur: "deux", libelle: "2 plans" },
          { valeur: "trois", libelle: "3 plans" },
          { valeur: "quatre", libelle: "4 plans" },
        ],
      },
      { cle: "extraitsCourts", libelle: "Extraits courts pour les réseaux", type: "interrupteur" },
      { cle: "generique", libelle: "Générique de début", type: "interrupteur" },
    ],
  },
  recetteScript: {
    blocs: [
      { id: "ouverture", nom: "Ouverture", couleur: "orange", consigne: "L'hôte présente l'invité et l'enjeu.", dureeCibleSec: [20, 60], role: "Hôte" },
      { id: "question-hote", nom: "Question", couleur: "ambre", consigne: "Une question ouverte.", dureeCibleSec: [5, 20], repetable: true, role: "Hôte" },
      { id: "reponse-invite", nom: "Réponse", couleur: "sauge", consigne: "L'invité raconte, avec un exemple.", dureeCibleSec: [30, 180], repetable: true, role: "Invité" },
      { id: "relance", nom: "Relance", couleur: "texte-doux", consigne: "Creuser un point précis.", dureeCibleSec: [5, 15], repetable: true, role: "Hôte" },
      { id: "conclusion", nom: "Conclusion", couleur: "orange-vif", consigne: "Ce qu'on retient, où retrouver l'invité.", dureeCibleSec: [20, 60], role: "Hôte" },
    ],
    regles: [...REGLES_COMMUNES, "Alterner les voix toutes les 30 secondes au plus.", "Chaque réponse contient une anecdote."],
    criteres: CRITERES_STANDARD,
    references: ["script-ref-podcast-1"],
    motsParSeconde: 2.4,
    annotations: ["role", "angle", "emphase", "pause"],
  },
  briques: briquesAuChoix(["texte-ecran"]),
  stylesParDefaut: { lut: "lut-cinema", intensiteLut: 60, sousTitres: "st-sobre", styleMontage: "sm-calme", habillage: "hab-sobre", profilSon: "ps-podcast" },
  illustrations: { mode: "manuel", couvertureCiblePct: 5, dureePlanSec: 4, sourcesAutorisees: ["bibliotheque"], affichage: "incrustation" },
  capacitesRequises: ["voix", "visage", "multi-personnages"],
  moteur: "simulation",
  reseauxConseilles: ["youtube", "linkedin", "instagram"],
  exemples: [{ titre: "L'IA va-t-elle remplacer les avocats ?", vignette: "/demo/podcast-entretien.jpg", video: "/demo/podcast-entretien.mp4", ratio: "16:9" }],
  aFournir: ["Deux personnages (hôte et invité)", "Une liste de questions", "Un décor de studio"],
  migrerReglages: migrationIdentite,
};
