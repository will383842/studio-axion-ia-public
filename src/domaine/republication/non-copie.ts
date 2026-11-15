/**
 * L8-10 : contrôle de non-copie pour la republication. PUR : aucun réseau, aucune base, aucune donnée modifiée.
 * Une republication est un contenu neuf dérivé : on refuse un texte identique, 6 mots copiés d'affilée hors citation,
 * ou une proximité de 0,6 ou plus avec un texte d'origine. Une citation entre guillemets est tolérée.
 * Levée de la suspension « même raison que L8-08 » par la décision du fondateur du 15/11/2026.
 */
import { TAILLE_ALERTE_POST } from "@/domaine/ecriture-commune/memoire-posts";
import { blanchirExclusions, phrases, racine } from "@/domaine/ecriture-commune/ressemblance";
import { reprisesDAffilee, type Reprise } from "@/domaine/proximite-textes";

/** Taille de reprise refusée : la constante unique de L3-13, importée, jamais recopiée. */
export const TAILLE_COPIE_REPUBLICATION = TAILLE_ALERTE_POST;

/** Seuil de proximité (Jaccard sur les racines de mots) à partir duquel on refuse. Sans source réelle : hypothese. */
export const SEUIL_PROXIMITE_REPUBLICATION = { statut: "hypothese", valeur: 0.6 } as const;

export type MotifCopie = "identique" | "reprise" | "proximite";

export interface ResultatNonCopie {
  ok: boolean;
  motif: MotifCopie | null;
  /** Reprises d'affilée (hors citation) d'au moins `TAILLE_COPIE_REPUBLICATION` mots. */
  reprises: Reprise[];
  /** Proximité maximale (0 à 1) avec un texte d'origine, citations retirées. */
  proximite: number;
}

const CITATION = /«[^»]*»|"[^"]*"|“[^”]*”/g;

/** Texte sans ses citations : chaque citation devient un point (aucune séquence ne la traverse). */
function sansCitations(texte: string): string {
  return blanchirExclusions(texte, texte.match(CITATION) ?? []);
}

const empreinte = (texte: string): string => phrases(texte).flat().map((m) => m.cle).join(" ");

function racinesDe(texte: string): Set<string> {
  return new Set(phrases(texte).flat().map((m) => racine(m.cle)).filter(Boolean));
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (!a.size && !b.size) return 0;
  let commun = 0;
  for (const x of a) if (b.has(x)) commun++;
  return commun / (a.size + b.size - commun);
}

export function controlerNonCopie(nouveau: string, origines: readonly string[]): ResultatNonCopie {
  const cible = empreinte(nouveau);
  if (cible && origines.some((o) => empreinte(o) === cible)) return { ok: false, motif: "identique", reprises: [], proximite: 1 };

  const hors = sansCitations(nouveau);
  const reprises = reprisesDAffilee(hors, origines, TAILLE_COPIE_REPUBLICATION).filter((r) => r.mots >= TAILLE_COPIE_REPUBLICATION);
  const racinesNouveau = racinesDe(hors);
  const proximite = origines.reduce((max, o) => Math.max(max, jaccard(racinesNouveau, racinesDe(sansCitations(o)))), 0);

  if (reprises.length > 0) return { ok: false, motif: "reprise", reprises, proximite };
  if (proximite >= SEUIL_PROXIMITE_REPUBLICATION.valeur) return { ok: false, motif: "proximite", reprises, proximite };
  return { ok: true, motif: null, reprises, proximite };
}
