/**
 * L8-08 : règles de republication par réseau, en constantes typées. Fonctions PURES : aucun réseau, aucun appel réel.
 * Une republication est TOUJOURS un contenu neuf dérivé (jamais une copie du contenu d'origine).
 * Toute valeur de délai ou de seuil sans source réelle porte le statut « hypothese » (décision du fondateur du 15/11/2026).
 */
import type { IdReseau } from "@/domaine/types";

export type ValeurSourcee<T> =
  | { readonly statut: "hypothese"; readonly valeur: T }
  | { readonly statut: "source"; readonly valeur: T; readonly source: string };

export interface RegleRepublication {
  /** Délai minimal entre la publication d'origine et sa republication. */
  readonly delaiMinJours: ValeurSourcee<number>;
  /** Seuil de performance (vues) en dessous duquel un contenu devient candidat à la republication. */
  readonly seuilPerformance: ValeurSourcee<number>;
  /** Toujours vrai : la republication est un contenu neuf dérivé. */
  readonly contenuNeufDerive: true;
  readonly refuseIdentique: boolean;
  readonly refuseFiligrane: boolean;
}

/** Les réseaux qui se republient. Pinterest volontairement absent : une épingle ne se republie pas (ADR-0015) ; `regleRepublication("pinterest")` lève, comme pour tout réseau sans règle. */
export type ReseauRepublicable = Exclude<IdReseau, "pinterest">;

export const RESEAUX_REPUBLICATION: readonly ReseauRepublicable[] = ["tiktok", "instagram", "youtube-shorts", "youtube", "linkedin", "facebook"];

const hyp = <T>(valeur: T): ValeurSourcee<T> => ({ statut: "hypothese", valeur });

export const REGLES_REPUBLICATION: Readonly<Record<ReseauRepublicable, RegleRepublication>> = Object.freeze({
  tiktok: { delaiMinJours: hyp(30), seuilPerformance: hyp(500), contenuNeufDerive: true, refuseIdentique: true, refuseFiligrane: true },
  instagram: { delaiMinJours: hyp(30), seuilPerformance: hyp(500), contenuNeufDerive: true, refuseIdentique: true, refuseFiligrane: false },
  "youtube-shorts": { delaiMinJours: hyp(60), seuilPerformance: hyp(1000), contenuNeufDerive: true, refuseIdentique: true, refuseFiligrane: false },
  youtube: { delaiMinJours: hyp(90), seuilPerformance: hyp(1000), contenuNeufDerive: true, refuseIdentique: true, refuseFiligrane: false },
  linkedin: { delaiMinJours: hyp(45), seuilPerformance: hyp(300), contenuNeufDerive: true, refuseIdentique: true, refuseFiligrane: false },
  facebook: { delaiMinJours: hyp(45), seuilPerformance: hyp(300), contenuNeufDerive: true, refuseIdentique: true, refuseFiligrane: false },
});

function reseauConnu(reseau: unknown): reseau is ReseauRepublicable {
  return typeof reseau === "string" && Object.prototype.hasOwnProperty.call(REGLES_REPUBLICATION, reseau);
}

/** Erreur explicite si le réseau est inconnu (donnée lue en base ou reçue d'une API). */
export function regleRepublication(reseau: IdReseau): RegleRepublication {
  if (!reseauConnu(reseau)) throw new Error(`réseau inconnu : ${String(reseau)}`);
  return REGLES_REPUBLICATION[reseau];
}

export type MotifRefusRepublication = "contenu-identique" | "filigrane" | "delai-trop-court" | "reseau-inconnu" | "date-invalide";

export interface EntreeRepublication {
  readonly reseau: IdReseau;
  /** Date de la publication d'origine (ms). */
  readonly datePublication: number;
  /** Instant courant (ms), fourni par l'appelant. */
  readonly maintenant: number;
  /** Le contenu proposé est identique à l'original. */
  readonly identique: boolean;
  /** Le contenu proposé porte un filigrane. */
  readonly filigrane: boolean;
}

export interface VerdictRepublication {
  readonly autorise: boolean;
  readonly motifs: readonly MotifRefusRepublication[];
}

const JOUR_MS = 24 * 3600 * 1000;

export function evaluerRepublication(e: EntreeRepublication): VerdictRepublication {
  // Prudence : une donnée invalide refuse la republication au lieu de la laisser passer ou de planter.
  if (!reseauConnu(e.reseau)) return { autorise: false, motifs: ["reseau-inconnu"] };
  if (!Number.isFinite(e.datePublication) || !Number.isFinite(e.maintenant)) return { autorise: false, motifs: ["date-invalide"] };
  const r = REGLES_REPUBLICATION[e.reseau];
  const motifs: MotifRefusRepublication[] = [];
  if (r.refuseIdentique && e.identique) motifs.push("contenu-identique");
  if (r.refuseFiligrane && e.filigrane) motifs.push("filigrane");
  if (e.maintenant - e.datePublication < r.delaiMinJours.valeur * JOUR_MS) motifs.push("delai-trop-court");
  return { autorise: motifs.length === 0, motifs };
}
