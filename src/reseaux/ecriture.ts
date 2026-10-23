/**
 * RÈGLES D'ÉCRITURE PAR RÉSEAU (générateur, plan v5 B.5.1). PUR : importable côté client.
 *
 * Chaque valeur porte son `regleId` : l'identifiant d'une règle datée semée en base (`reglesDatees`, B.5.4). Une valeur
 * sans source de plateforme cite une règle `hyp-*` (niveau HYPOTHÈSE, n° 92) et s'affiche comme telle. Table lue par
 * `ecritureReseau` (chaîne du générateur, rôle publication, textes de publication) ; le générateur central ne connaît aucun nom de réseau : il lit cette table.
 */
import type { ReseauDeclinaison, TypeAppel } from "@/domaine/types";

export interface ValeurReglee<T> {
  valeur: T;
  regleId: string;
}

export interface EcritureReseau {
  reseau: ReseauDeclinaison;
  /** Styles d'accroche favorisés (identifiants de B.4.3) et leur poids. */
  famillesFavorisees: ValeurReglee<{ familles: string[]; poids: number }>;
  /** La fin rejoint-elle l'accroche ? */
  boucle: ValeurReglee<"oui" | "non" | "sauf-apres-question">;
  /** [min, max] de mots-dièse. */
  motsDiese: ValeurReglee<[number, number]>;
  /** Première ligne du texte de publication. */
  premiereLigne: ValeurReglee<{ consigne: string; caracteresMax?: number; motCleAvantCaractere?: number }>;
  /** Appels permis en plus de la table objectif × réseau (B.4.4). */
  appelsPermis?: ValeurReglee<TypeAppel[]>;
  /** PLAFOND de durée visé (s) : jamais un plancher. */
  zoneDureeSec: ValeurReglee<[number, number]>;
  /** Durée maximale acceptée par la plateforme (null : sans plafond). */
  dureeMaxSec: ValeurReglee<number | null>;
  /** Jour proposé après la première publication du sujet (B.6.12). */
  jourPublication: ValeurReglee<number>;
  /** Ce réseau peut retenir les segments facultatifs du corps (B.0 n° 5 et 86 : zone la plus longue). */
  segmentFacultatif: ValeurReglee<boolean>;
  particularites: ValeurReglee<string>[];
  /**
   * Équipe 7 : termes qui disent de quoi parle le compte. L'un d'eux est dit avant 5 s (C10) et écrit dans la
   * description (`avecTermeDuCompte`). Absent : aucune exigence.
   */
  termesDuCompte?: ValeurReglee<string[]>;
}

/** Longueur maximale d'un titre de vidéo (règle `ys-titre-indexe`) : la même pour tout champ titre du studio. */
export const TITRE_CARACTERES_MAX = 100;

export const ECRITURE_RESEAUX: Readonly<Record<ReseauDeclinaison, EcritureReseau>> = {
  tiktok: {
    reseau: "tiktok",
    famillesFavorisees: { valeur: { familles: ["contre-intuitif", "liste-boucle"], poids: 1.5 }, regleId: "hyp-familles-reseau" },
    boucle: { valeur: "oui", regleId: "hyp-ecriture-reseau" },
    // Équipe 7 : 3 à 5, piochés dans « Vos hashtags » (Réglages › Mes réseaux).
    motsDiese: { valeur: [3, 5], regleId: "hyp-ecriture-reseau" },
    premiereLigne: { valeur: { consigne: "Mot-clé exact, puis 2 ou 3 phrases descriptives (mot-clé, variante parlée, ce que la vidéo répond).", caracteresMax: 100 }, regleId: "tt-mots-cles-2026" },
    zoneDureeSec: { valeur: [25, 35], regleId: "hyp-zones-reseau" },
    dureeMaxSec: { valeur: 600, regleId: "tt-duree-2026" },
    jourPublication: { valeur: 0, regleId: "hyp-ordre-publication" },
    segmentFacultatif: { valeur: false, regleId: "hyp-zones-reseau" },
    particularites: [
      { valeur: "Mot-clé dit avant 5 s ; structure dite à voix haute quand elle s'y prête.", regleId: "tt-mots-cles-2026" },
      { valeur: "Mots-clés à déclarer et à bloquer, saisis à la main sur l'application.", regleId: "tt-mots-cles-2026" },
      { valeur: "Commentaire épinglé = la source (une question seulement si l'appel est une question d'expert).", regleId: "hyp-ecriture-reseau" },
      { valeur: "TikTok peut étiqueter le double de lui-même : information, le réglage reste coupé.", regleId: "tt-etiquetage-auto-2026" },
      { valeur: "Le compte parle d'IA : « intelligence artificielle », « IA en entreprise » ou « ChatGPT » dit avant 5 s.", regleId: "hyp-ecriture-reseau" },
    ],
    termesDuCompte: { valeur: ["intelligence artificielle", "IA en entreprise", "ChatGPT", "IA"], regleId: "hyp-ecriture-reseau" },
  },
  instagram: {
    reseau: "instagram",
    famillesFavorisees: { valeur: { familles: ["erreur-commune", "mise-en-garde-destinataire"], poids: 1.5 }, regleId: "hyp-familles-reseau" },
    boucle: { valeur: "oui", regleId: "hyp-ecriture-reseau" },
    motsDiese: { valeur: [0, 3], regleId: "ig-hashtags-5" },
    premiereLigne: { valeur: { consigne: "La question que tape le prospect ; mot-clé exact dans les 125 premiers caractères.", motCleAvantCaractere: 125 }, regleId: "hyp-ecriture-reseau" },
    zoneDureeSec: { valeur: [28, 40], regleId: "hyp-zones-reseau" },
    dureeMaxSec: { valeur: 180, regleId: "ig-reels-3min-2025" },
    jourPublication: { valeur: 1, regleId: "hyp-ordre-publication" },
    segmentFacultatif: { valeur: false, regleId: "hyp-zones-reseau" },
    particularites: [
      { valeur: "Jamais d'export portant le filigrane d'une autre plateforme.", regleId: "ig-reprises-filigrane" },
      { valeur: "Publier sa propre vidéo aussi sur Facebook n'est pas sanctionné.", regleId: "fb-rediffusion-2025" },
    ],
  },
  facebook: {
    reseau: "facebook",
    famillesFavorisees: { valeur: { familles: ["question", "erreur-commune"], poids: 1.5 }, regleId: "hyp-familles-reseau" },
    boucle: { valeur: "sauf-apres-question", regleId: "hyp-ecriture-reseau" },
    motsDiese: { valeur: [0, 3], regleId: "hyp-ecriture-reseau" },
    premiereLigne: { valeur: { consigne: "Une question en première ligne, différente de celle d'Instagram." }, regleId: "hyp-ecriture-reseau" },
    appelsPermis: { valeur: ["envoi"], regleId: "hyp-ecriture-reseau" },
    zoneDureeSec: { valeur: [28, 40], regleId: "hyp-zones-reseau" },
    dureeMaxSec: { valeur: null, regleId: "fb-tout-reels-2025" },
    jourPublication: { valeur: 4, regleId: "hyp-ordre-publication" },
    segmentFacultatif: { valeur: false, regleId: "hyp-zones-reseau" },
    particularites: [
      { valeur: "Accroche propre, différente d'Instagram : choix éditorial de Will, pas une protection.", regleId: "fb-rediffusion-2025" },
      { valeur: "Une question d'expert porte sur une pratique ou une quantité, jamais sur une personne.", regleId: "hyp-ecriture-reseau" },
    ],
  },
  linkedin: {
    reseau: "linkedin",
    famillesFavorisees: { valeur: { familles: ["dementi", "cible-nommee", "mise-en-garde-destinataire"], poids: 1.5 }, regleId: "hyp-familles-reseau" },
    boucle: { valeur: "non", regleId: "hyp-ecriture-reseau" },
    motsDiese: { valeur: [0, 3], regleId: "hyp-ecriture-reseau" },
    premiereLigne: { valeur: { consigne: "Les 2 premières lignes se lisent seules (exemptées du mot-clé) ; « Sources : » sans lien." }, regleId: "hyp-ecriture-reseau" },
    appelsPermis: { valeur: ["envoi"], regleId: "hyp-ecriture-reseau" },
    zoneDureeSec: { valeur: [32, 60], regleId: "hyp-zones-reseau" },
    dureeMaxSec: { valeur: 600, regleId: "li-video-2026" },
    jourPublication: { valeur: 3, regleId: "hyp-ordre-publication" },
    segmentFacultatif: { valeur: true, regleId: "hyp-zones-reseau" },
    particularites: [
      { valeur: "Vertical 9:16 par défaut.", regleId: "li-video-2026" },
      { valeur: "Post rédigé avec la vidéo, avec un détail vrai du sujet.", regleId: "li-ai-slop-2026" },
      { valeur: "Aucun lien par défaut ; lien suivi en premier commentaire seulement pour « Rendez-vous ».", regleId: "li-lien-commentaire" },
      { valeur: "Lisible sans le son.", regleId: "li-sous-titres" },
      { valeur: "Texte de couverture produit comme pour Instagram.", regleId: "li-miniature" },
      { valeur: "Jamais « commentez OUI ».", regleId: "li-engagement-2026" },
    ],
  },
  "youtube-shorts": {
    reseau: "youtube-shorts",
    famillesFavorisees: { valeur: { familles: ["chiffre-choc", "promesse"], poids: 1.5 }, regleId: "hyp-familles-reseau" },
    boucle: { valeur: "oui", regleId: "hyp-ecriture-reseau" },
    motsDiese: { valeur: [0, 2], regleId: "hyp-ecriture-reseau" },
    premiereLigne: { valeur: { consigne: "Deux titres de 100 caractères au plus avec le mot-clé exact ; sources dans la description.", caracteresMax: TITRE_CARACTERES_MAX }, regleId: "ys-titre-indexe" },
    zoneDureeSec: { valeur: [28, 40], regleId: "hyp-zones-reseau" },
    dureeMaxSec: { valeur: 180, regleId: "ys-shorts-3min-2024" },
    jourPublication: { valeur: 2, regleId: "hyp-ordre-publication" },
    segmentFacultatif: { valeur: false, regleId: "hyp-zones-reseau" },
    particularites: [
      { valeur: "Durée = le temps de raconter l'histoire.", regleId: "ys-duree-histoire" },
      { valeur: "Instant de couverture désigné (visage et encadré).", regleId: "ys-couverture-instant" },
      { valeur: "Sujet sensible : « vous en personne » au premier plan.", regleId: "ys-monetisation-modeles" },
      { valeur: "Cases de rappel : remix et détection de ressemblance.", regleId: "ys-remix-ressemblance" },
    ],
  },
};

export function ecritureReseau(reseau: ReseauDeclinaison): EcritureReseau {
  return ECRITURE_RESEAUX[reseau];
}

/** Tous les identifiants de règle cités par la table (contrôlés contre les règles semées). */
export function regleIdsEcriture(): string[] {
  const ids = new Set<string>();
  for (const e of Object.values(ECRITURE_RESEAUX)) {
    for (const v of [e.famillesFavorisees, e.boucle, e.motsDiese, e.premiereLigne, e.appelsPermis, e.zoneDureeSec, e.dureeMaxSec, e.jourPublication, e.segmentFacultatif, e.termesDuCompte, ...e.particularites]) {
      if (v) ids.add(v.regleId);
    }
  }
  return [...ids].sort();
}
