/**
 * DÉCLINAISONS DE FORMAT DU FACE CAMÉRA (lot F1, élément reporté après la v1 : « Les ratios 4:5, 1:1 et 16:9, avec
 * l'écran partagé 45/55 »). PUR.
 *
 * Le 9:16 reste la vidéo de référence, toujours fabriquée et toujours par défaut : rien de ce qui le concerne ne change.
 * Les autres formats sont des DÉCLINAISONS de la même vidéo : mêmes coupes, même son, même passe image 10 bits
 * (jamais refaite par ratio), mêmes cartes et mêmes sous-titres ; seuls le cadrage (recalculé depuis la piste du
 * visage), la mise en page des écrans partagés, la place des sous-titres et la composition finale changent.
 *
 * Où Will les demande, sans aucun réglage :
 *  - sur « Votre vidéo », une ligne de pastilles (9:16 toujours cochée) ;
 *  - au monteur, à l'oral pendant le tournage ou dans le fil : « Monteur, fais-moi aussi une version carrée ».
 * Les formats voulus sont gardés dans `entrees.facecamFormats` (clé sœur de `entrees.facecam`) : une nouvelle version
 * de la vidéo les fabrique d'office.
 */
import type { Ratio } from "@/domaine/types";
import { ratiosDeLaMere } from "@/briques/declinaison";
import { dimensions } from "@/reseaux/sorties";

export const VERSION_FORMATS_FACECAM = "formats-facecam-1";

/** Les 4 formats d'image du face caméra, dans l'ordre d'affichage (9:16 d'abord, toujours). */
export const RATIOS_FACECAM = ["9:16", "4:5", "1:1", "16:9"] as const satisfies readonly Ratio[];
export type RatioFacecam = (typeof RATIOS_FACECAM)[number];
/** Les déclinaisons (tout sauf le 9:16 de référence). */
export type RatioDeclinaison = Exclude<RatioFacecam, "9:16">;
export const RATIOS_DECLINAISON: RatioDeclinaison[] = ["4:5", "1:1", "16:9"];

/** Taille de l'image par format, lue dans le registre des réseaux (`dimensions`) ; 25 i/s pour tous, comme le reste du studio. */
export const DIMENSIONS_FACECAM: Record<RatioFacecam, { largeur: number; hauteur: number }> = Object.fromEntries(RATIOS_FACECAM.map((r) => [r, dimensions(r)])) as Record<RatioFacecam, { largeur: number; hauteur: number }>;

/** Rapport largeur / hauteur. */
export const rapportRatio = (r: RatioFacecam): number => DIMENSIONS_FACECAM[r].largeur / DIMENSIONS_FACECAM[r].hauteur;

/** Nom de fichier d'un format (« 4x5 »). */
export const nomRatio = (r: Ratio): string => r.replace(":", "x");

/** Une pastille de l'écran « Votre vidéo » : un nom simple et où la version sert (aucun prix, aucune option). */
export interface PastilleFormat {
  ratio: RatioFacecam;
  nom: string;
  usage: string;
  /** Le 9:16 ne se décoche pas : c'est la vidéo de référence. */
  verrouille: boolean;
}

export const PASTILLES_FORMATS: PastilleFormat[] = [
  { ratio: "9:16", nom: "Vertical", usage: "TikTok, Reels, Shorts", verrouille: true },
  { ratio: "4:5", nom: "Portrait", usage: "Instagram", verrouille: false },
  { ratio: "1:1", nom: "Carré", usage: "LinkedIn, Facebook", verrouille: false },
  { ratio: "16:9", nom: "Horizontal", usage: "YouTube, LinkedIn bureau", verrouille: false },
];

export const estRatioFacecam = (r: unknown): r is RatioFacecam => typeof r === "string" && (RATIOS_FACECAM as readonly string[]).includes(r);

/**
 * Formats d'une vidéo, dans l'ordre : le 9:16 toujours en premier, puis les déclinaisons demandées, sans doublon.
 * Réutilise la règle de la brique `declinaison` (`ratiosDeLaMere` : 9:16 + options 4:5 et carré) et y ajoute le 16:9.
 */
export function formatsDemandes(...sources: (readonly unknown[] | undefined)[]): RatioFacecam[] {
  const voulus = sources.flatMap((s) => (s ?? []).filter(estRatioFacecam));
  const verticaux = ratiosDeLaMere(voulus) as RatioFacecam[];
  return [...verticaux, ...(voulus.includes("16:9") ? (["16:9"] as const) : [])];
}

/** Les seules déclinaisons (sans le 9:16), dans l'ordre. */
export function declinaisonsDemandees(...sources: (readonly unknown[] | undefined)[]): RatioDeclinaison[] {
  return formatsDemandes(...sources).filter((r): r is RatioDeclinaison => r !== "9:16");
}

/** Ce qui est gardé dans `Video.entrees.facecamFormats` (absent : 9:16 seul, comme avant). */
export interface EntreesFormatsFacecam {
  version: 1;
  /** Déclinaisons voulues (le 9:16 n'y figure jamais : il est toujours fait). */
  ratios: RatioDeclinaison[];
}

/** Lecture tolérante de `entrees.facecamFormats` (jamais d'exception ; valeur inconnue écartée). */
export function lireFormatsFacecam(entrees: unknown): EntreesFormatsFacecam {
  const brut = (entrees as { facecamFormats?: { ratios?: unknown } } | undefined)?.facecamFormats;
  const ratios = Array.isArray(brut?.ratios) ? declinaisonsDemandees(brut.ratios) : [];
  return { version: 1, ratios };
}

/** Entrées d'une version avec ces déclinaisons (les autres clés restent telles quelles). */
export function entreesAvecFormats(entrees: Record<string, unknown> | undefined, ratios: readonly unknown[]): Record<string, unknown> {
  const { facecamFormats: _ancien, ...reste } = entrees ?? {};
  void _ancien;
  const voulus = declinaisonsDemandees(ratios);
  return voulus.length ? { ...reste, facecamFormats: { version: 1, ratios: voulus } satisfies EntreesFormatsFacecam } : reste;
}
