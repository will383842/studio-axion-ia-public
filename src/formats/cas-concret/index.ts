import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";
import type { NatureCas, Offre } from "./cas";

/**
 * FORMAT « CAS CONCRET MD » (code CC) — plan cas concret, 01-PLAN-ARCHITECTE.md. Une phrase, une vidéo : une voix, des
 * écrans qui montrent une automatisation étape par étape, une fin qui appelle au diagnostic. Aucun visage.
 * Statut `masque` et NON inscrit dans `src/formats/index.ts` ni dans `registre-codes.ts` (raccords posés plus tard).
 * Moteur `montage-cas-concret`. Aucune musique. Sous-titres obligatoires ; mention IA au choix, coupée par défaut.
 */

/** Page du diagnostic en ligne (à faire soi-même, sans réservation) visée par le lien suivi (plan § 4-e). */
export const PAGE_DIAGNOSTIC = "https://axion-ia.com/fr/diagnostic";
/** Tempo appliqué à la voix assemblée. */
export const TEMPO_VOIX = 1.08;
/** Tenue de l'écran final après le dernier mot, en secondes. */
export const FIN_APRES_DERNIER_MOT_SEC = 2.1;
/**
 * Bande des sous-titres du format, en fraction de la hauteur : une seule ligne courte, 8 % (et non les 14 % par défaut de
 * la brique `ecrans-motion`). SEULE valeur du format, lue par la chaîne, les contrôles et la fiche témoin ; les
 * compositions, qui n'importent rien de ce dossier, en ont une copie comparée par un test.
 */
export const BANDE_SOUS_TITRES_CAS_CONCRET = 0.08;
/**
 * Zone « pleine image » du format (V4-2, décision de Will du 14/10, « option 1 comme la v4 ») : les écrans occupent TOUT
 * l'écran comme la v4, et non la zone sûre commune des réseaux (bas 30 %). En pourcentages de l'image 1080 × 1920 :
 * texte sur 40–1 040 px (centre exact, v4 `.mm`), marque à 143 px pour que l'étiquette d'étape tombe à 250 px (v4), bas
 * de la zone de texte à 1 744 px : objets jusqu'à 1 590 px (≈ 83 %), puis la bande des sous-titres (8 %). Les boutons
 * des réseaux peuvent recouvrir une partie du bas : Will l'accepte (la v4 a été publiée telle quelle).
 */
export const ZONE_PLEINE_IMAGE_CAS_CONCRET = Object.freeze({ haut: (143 / 1920) * 100, droite: (40 / 1080) * 100, bas: (176 / 1920) * 100, gauche: (40 / 1080) * 100 });
/** Bas du fil des étapes, en fraction de la hauteur : 1 770 px, soit un fil de 6 px à 1 764 px (v4 : 150 px du bas). */
export const BAS_FIL_CAS_CONCRET = 1770 / 1920;
/** Format dont la voix est reprise (désignée explicitement). */
export const FORMAT_VOIX_DE_REFERENCE = "avocat";
/**
 * Fournisseur de la voix du format : TOUJOURS la voix HeyGen déjà en service (ordre de Will du 12/10). Une voix d'un
 * autre fournisseur n'est jamais choisie ; seule la voix simulée passe, et un serveur de production la refuse.
 */
export const FOURNISSEUR_VOIX_CAS_CONCRET = "heygen";
/** Le fournisseur d'une voix est-il permis pour le format ? (`simulation` : essais seulement, refusée en production.) */
export function fournisseurVoixPermis(fournisseur: string): boolean {
  return fournisseur === FOURNISSEUR_VOIX_CAS_CONCRET || fournisseur === "simulation";
}
/** Refus quand cette voix manque : ce qu'il faut faire, en une phrase (la feuille « Votre vidéo » y ajoute le lien). */
export const CONSIGNE_VOIX_CAS_CONCRET = "Votre voix n'est pas prête : dans Personnages, Voix, désignez la voix du format « Vidéo type avocat ».";
/** Durée de validité d'une validation de cas par Will. */
export const VALIDITE_CAS_JOURS = 180;

export type ReseauCas = "facebook" | "instagram" | "tiktok" | "linkedin";

/**
 * Cadeau annoncé par une offre : identifiant de la table `TABLE_FINS_DIAGNOSTIC` (`src/briques/fins/table-diagnostic.ts`).
 * Un seul cadeau « intégration » : la phrase validée « toute la structure de cette automatisation » pour un cas dont la
 * nature est une automatisation, « le schéma de cette intégration » (non validée) sinon. Le coaching n'a pas de cadeau.
 */
export function cadeauDeLOffre(offre: Offre, nature?: NatureCas): string | undefined {
  if (offre === "integration") return nature === "automatisation" ? "fin-if-cadeau-automatisation" : "fin-if-cadeau-integration";
  if (offre === "formation") return "fin-if-cadeau-formation";
  if (offre === "audit") return "fin-if-cadeau-audit";
  return undefined;
}

/** Fin « diagnostic » de chaque réseau (X6, 12/10/2026) : une seule demande, puis la phrase du lien du réseau. */
export const FINS_DIAGNOSTIC: Readonly<Record<ReseauCas, readonly string[]>> = Object.freeze({
  facebook: ["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"],
  instagram: ["fin-if-diagnostic-gratuit", "fin-ig-lien-profil"],
  tiktok: ["fin-ty-diagnostic-gratuit", "fin-tt-lien-profil"],
  linkedin: ["fin-li-diagnostic-gratuit", "fin-li-lien-commentaire"],
});
/** Fin au mot de Facebook : le mot, puis l'envoi ; aucun lien annoncé. */
export const FIN_AU_MOT: readonly string[] = Object.freeze(["fin-if-mot", "fin-if-envoi-structure"]);
/**
 * Fin au mot d'Instagram (X7, décision de Will du 12/10/2026 : l'abonnement est obligatoire pour recevoir le cadeau) :
 * « Abonnez-vous et écrivez {MOT} en commentaire : je vous l'envoie. », en une phrase ; aucun lien annoncé.
 */
export const FIN_AU_MOT_INSTAGRAM: readonly string[] = Object.freeze(["fin-ig-mot-abonnement"]);

/**
 * Suite de fins par réseau (plan § 4-d, puis X6), en identifiants de `TABLE_FINS_DIAGNOSTIC`. `motSur` : les réseaux où
 * le mot est dit (Will a coché « Avec le mot » ET le mot est branché sur ce compte). Là : la fin au mot, sauf pour une
 * offre sans cadeau (coaching). Partout ailleurs, et toujours sur TikTok et LinkedIn : la fin « diagnostic ».
 */
export function finsParReseau(offre: Offre, motSur: readonly ReseauCas[], nature?: NatureCas): Record<ReseauCas, string[]> {
  const auMot = (r: "facebook" | "instagram") => motSur.includes(r) && !!cadeauDeLOffre(offre, nature);
  return {
    facebook: [...(auMot("facebook") ? FIN_AU_MOT : FINS_DIAGNOSTIC.facebook)],
    instagram: [...(auMot("instagram") ? FIN_AU_MOT_INSTAGRAM : FINS_DIAGNOSTIC.instagram)],
    tiktok: [...FINS_DIAGNOSTIC.tiktok],
    linkedin: [...FINS_DIAGNOSTIC.linkedin],
  };
}

export const formatCasConcret: DefinitionFormat = {
  id: "cas-concret",
  version: 1,
  nom: "Cas concret MD",
  nomCourt: "Cas concret MD",
  accroche: "Une phrase, une vidéo.",
  description: "Une voix, des écrans qui montrent une automatisation étape par étape, puis un appel au diagnostic. Aucun visage.",
  icone: "eclair",
  adresseCreation: "/cas-concret",
  statut: "actif",
  /** Vidéos sur le site (lot S1) : conseil du plan, la décision est le réglage `siteGenerateurs.cas-concret`. */
  site: "oui",
  famille: "motion",
  codeClassement: "CC",
  declinaison: "aucune",
  durees: { mode: "depuis-script", zoneSec: [40, 60], zoneOrangeSec: [60, 65], ciblesGenerationSec: [45, 50, 55], cibleParDefautSec: 50 },
  ratios: ["9:16"],
  ratioMaitre: "9:16",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "9:16": "plein-ecran" },
  // La voix seule : aucun visage n'est rendu (pas de capacité « visage »).
  personnages: { min: 1, max: 1, roles: ["voix"], sources: ["double"] },
  entrees: [],
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "La promesse du cas, en huit mots au plus.", dureeCibleSec: [2, 3] },
      { id: "etape", nom: "Étape", couleur: "sauge", consigne: "Une étape à la fois, dite simplement et montrée à l'écran.", dureeCibleSec: [4, 8], repetable: true },
      { id: "resultat", nom: "Résultat", couleur: "orange-vif", consigne: "Ce que le cas change, en une phrase.", dureeCibleSec: [4, 6] },
      { id: "question", nom: "Question", couleur: "ambre", consigne: "Une question au public, sans appel : la fin vient de la table des fins.", dureeCibleSec: [3, 5] },
    ],
    regles: [...REGLES_COMMUNES, "Vouvoiement : toujours « vous »."],
    // Pas de critère « appel » : le format n'écrit aucune phrase d'appel.
    criteres: CRITERES_STANDARD.filter((c) => c.id !== "appel"),
    references: [],
    motsParSeconde: 3.4,
    modesDiction: ["voix-off"],
    modeParDefaut: "voix-off",
    annotations: ["titreEcran", "emphase", "illustration"],
    partiesDeclinaison: { ouverture: [], fin: [] },
  },
  briques: { "sous-titres": "active", "mention-ia": "au-choix-coupee" },
  musique: "interdite",
  stylesParDefaut: {},
  illustrations: { mode: "aucune", couvertureCiblePct: 0, dureePlanSec: 3, sourcesAutorisees: [], affichage: "plein-ecran" },
  capacitesRequises: ["voix", "motion"],
  moteur: "montage-cas-concret",
  reseauxConseilles: ["facebook", "instagram", "tiktok", "linkedin"],
  exemples: [],
  aFournir: ["Un cas du catalogue"],
  migrerReglages: migrationIdentite,
  pieces: {
    habillage: "charte-duo/1",
    sons: ["chiffre", "document", "telephone", "illustration-forte", "impact"],
    fin: "appels",
    voix: "voix-maitre",
    rendu: "par-scenes",
    controleImage: true,
  },
  ecranVideo: { attente: "generique", retouche: "aucune", monteur: false, coutsVisibles: true, publication: "aucune" },
};
