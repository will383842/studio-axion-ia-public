/**
 * SOCLE QUALITÉ · LA SEULE SOURCE DES SEUILS COMMUNS, par réseau × durée. PUR.
 *
 * Arbitrages de Will (audit § 2.3, adoptés tels que proposés le 17/10/2026) :
 *  - la 1re phrase fait 12 mots au plus et finit avant 3 s ; l'accroche entière peut aller jusqu'à 5 s ;
 *  - phrase longue : alerte au-delà de 14 mots, refus au-delà de 22 (l'image → vidéo garde 12 dans sa recette) ;
 *  - le débit est déclaré par la recette, les seuils sont en secondes ;
 *  - changement à l'écran toutes les 2,5 s au plus, sauf face caméra.
 * Fonctions minimales (règles de Will) : gain livré avant 40 % de la durée, relance entre 50 et 70 %.
 * Durées (recherche 2026-2027, section C) : points de départ à tester, pas des vérités de plateforme.
 */
import type { ReseauDeclinaison } from "@/domaine/types";
import type { RecetteQualite, SeuilsCommuns } from "./types";

export const SEUILS_COMMUNS: Readonly<SeuilsCommuns> = {
  premierePhraseMotsMax: 12,
  premierePhraseFinSec: 3,
  accrocheFinSecMax: 5,
  phraseAlerteMots: 14,
  /**
   * CALIBRAGE du 18/10/2026 (`docs/ecriture/CALIBRAGE-SOCLE-2026-10-18.md`) : AVANT 18. Une seule phrase de 19 mots rendait
   * le voyant rouge, même sur un script conforme aux règles de Will (3 bons sur 3 étaient rouges pour cette seule raison).
   * 22 mots, c'est environ 5 s au débit de l'avocat (4,5 mots/s), la durée d'une accroche entière (`accrocheFinSecMax`) :
   * au-delà, la phrase est vraiment illisible. De 15 à 22 mots, l'alerte reste affichée (`phraseAlerteMots`, inchangé à 14).
   */
  phraseRefusMots: 22,
  changementEcranSec: 2.5,
  gainAvantPart: 0.4,
  relanceDebutPart: 0.5,
  relanceFinPart: 0.7,
  motsEcritsMax: 8,
  /** La cible (métier, taille, situation d'entreprise) est nommée dans les 10 premières secondes. */
  ciblePremieresSec: 10,
};

/**
 * Seuils du voyant (note d'un thème sur 10). CALIBRAGE du 18/10/2026 : AVANT, le 7 de l'ambre était écrit en dur dans
 * `rapport.ts` et il n'y avait pas de seuil rouge par thème : un script sans valeur ni preuve (thème à 3/10) restait
 * « ambre » comme un script à 6/10, et seule une règle bloquante pouvait le rendre rouge.
 */
export const SEUIL_THEME_AMBRE = 7;
/** Un thème mesuré sous cette note (donc 3/10 ou moins) rend le voyant rouge. */
export const SEUIL_THEME_ROUGE = 4;

export type Relance = "aucune" | "facultative" | "obligatoire";

/** Classes de durée (recherche, section C : 15-20 s, 30 s, 45 s, 60-75 s ; long au-delà). */
export const CLASSES_DUREE = [
  { id: "court-20", viseeSec: 20, bornesSec: [12, 25], relance: "aucune" },
  { id: "court-30", viseeSec: 30, bornesSec: [24, 38], relance: "facultative" },
  { id: "court-45", viseeSec: 45, bornesSec: [36, 54], relance: "obligatoire" },
  { id: "court-60", viseeSec: 60, bornesSec: [48, 75], relance: "obligatoire" },
  { id: "long-90", viseeSec: 90, bornesSec: [72, 100], relance: "obligatoire" },
] as const satisfies readonly { id: string; viseeSec: number; bornesSec: readonly [number, number]; relance: Relance }[];

export type ClasseDuree = (typeof CLASSES_DUREE)[number];

/** Plafond de chaque réseau (s) : au-delà, la vidéo n'est plus un format court de ce réseau. */
export const PLAFOND_RESEAU_SEC: Readonly<Record<ReseauDeclinaison, number>> = {
  linkedin: 600,
  instagram: 180,
  facebook: 180,
  tiktok: 600,
  "youtube-shorts": 180,
};

/** La classe de durée : celle de la durée visée si elle est connue, sinon la plus proche de la durée estimée. */
export function classeDuree(dureeSec: number, dureeViseeSec?: number): ClasseDuree {
  const cible = dureeViseeSec ?? dureeSec;
  return CLASSES_DUREE.reduce((a, b) => (Math.abs(b.viseeSec - cible) < Math.abs(a.viseeSec - cible) ? b : a));
}

/** Les seuils d'un écrivain : les seuils communs, puis ses écarts (chacun avec sa raison). */
export function seuilsDe(recette: RecetteQualite): SeuilsCommuns {
  const s: SeuilsCommuns = { ...SEUILS_COMMUNS };
  for (const [cle, ecart] of Object.entries(recette.ecarts ?? {}) as [keyof SeuilsCommuns, { valeur: number; raison: string } | undefined][]) {
    if (ecart && ecart.raison.trim()) s[cle] = ecart.valeur;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Appels par réseau (règle de Will, table de code)                    */
/* ------------------------------------------------------------------ */

/** Formes d'appel reconnues dans la dernière demande. */
export type TypeAppelSocle = "commentez-mot" | "message-prive" | "question" | "diagnostic" | "envoi" | "lien" | "abonnement";

export interface AppelsReseau {
  permis: readonly TypeAppelSocle[];
  /** Pourquoi une forme est écartée sur ce réseau. */
  ecartes: Partial<Record<TypeAppelSocle, string>>;
}

/**
 * LinkedIn : question ouverte, « écrivez-moi DIAGNOSTIC en message privé » ET mot à commenter (réponse automatique par
 * Waalaxy : décision de Will du 17/10, risque assumé ; portée possiblement réduite selon une étude tierce, À MESURER).
 * Instagram et Facebook : « Commentez PLAN » permis (réponse privée par
 * l'API officielle de Meta). TikTok : « Commentez MOT » avec réponse à la main, ou le lien du profil. Shorts : abonnement,
 * lien de la chaîne ou question (recherche 2026-2027, section C et P2-P3).
 */
export const APPELS_PAR_RESEAU: Readonly<Record<ReseauDeclinaison, AppelsReseau>> = {
  linkedin: {
    permis: ["commentez-mot", "question", "message-prive", "diagnostic", "envoi", "lien"],
    ecartes: {
      abonnement: "Sur LinkedIn, l'abonnement n'amène pas de prospect : préférez une question ouverte.",
    },
  },
  instagram: { permis: ["commentez-mot", "message-prive", "question", "diagnostic", "envoi", "lien"], ecartes: {} },
  facebook: { permis: ["commentez-mot", "message-prive", "question", "diagnostic", "envoi", "lien"], ecartes: {} },
  tiktok: { permis: ["commentez-mot", "message-prive", "question", "diagnostic", "envoi", "lien"], ecartes: {} },
  "youtube-shorts": {
    permis: ["question", "abonnement", "lien", "diagnostic", "envoi"],
    ecartes: {
      "commentez-mot": "Sur YouTube Shorts, aucun message privé ne suit le commentaire : préférez une question ou le lien de la chaîne.",
      "message-prive": "YouTube n'a pas de messages privés : préférez une question ou le lien de la chaîne.",
    },
  },
};
