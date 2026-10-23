/**
 * FORMATS VOULUS D'UNE VIDÉO (plan « formats par réseau », T5). `format.ratios` dit ce que l'écran propose ; ce que le
 * générateur SAIT faire est lu dans les capacités du moteur. Les formats voulus d'une vidéo = ses formats (le format
 * maître à la création) + le format préféré de chaque réseau, limités à ces capacités (et, à la création d'une vidéo
 * ordinaire, à ce que l'écran propose : `creerBrouillon`) (`formatsVoulus`, `src/reseaux/sorties.ts`), posés à la
 * CRÉATION de la vidéo seulement (cochés par défaut, décochables) : la commande reprend ensuite `video.ratios` tels
 * quels, et le prix montré avant de lancer les compte.
 */
import "server-only";
import type { IdReseau, Ratio } from "@/domaine/types";
import { obtenirFormat } from "@/formats";
import { obtenirMoteur } from "@/moteurs";
import { lireParametre } from "./_commun";
import { moteurAuLancement } from "./reglages";

/**
 * Générateurs qui choisissent leurs formats à leur propre lancement (plan § 2.4 n° 4) : le face caméra (pastilles de
 * « Votre vidéo », pré-cochées d'après les réseaux à la tâche T11). Rien ne leur est ajouté ici.
 */
export const FORMATS_A_LANCEMENT_PROPRE: readonly string[] = Object.freeze(["facecam"]);

/**
 * Générateurs hors T5 : l'avocat. Décision de Will : T5 ne lui ajoute AUCUN format d'office (pas de 4:5 pour LinkedIn) ; une
 * session dédiée traitera l'avocat plus tard. Il garde le comportement d'avant : les formats du modèle, sinon le 9:16.
 */
export const FORMATS_EXCLUS_DE_T5: readonly string[] = Object.freeze(["avocat"]);

/** Réseaux par défaut (Réglages), la même valeur que le kit de publication. */
export async function reseauxParDefaut(): Promise<IdReseau[]> {
  return lireParametre<IdReseau[]>("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]);
}

/**
 * Formats que le générateur sait faire : capacités du moteur du lancement (`moteurId`, sinon `moteurAuLancement`),
 * limitées à celles du moteur du format quand le format en déclare un vrai (un essai simulé d'un tel format ne fait
 * jamais plus que son vrai moteur). Format dont le moteur déclaré est la simulation (l'avocat, le podcast…) : l'essai
 * simulé sait tout faire, il est donc borné à ce que le format propose (`format.ratios` : le podcast en 16:9 ne reçoit
 * jamais de 9:16 ni de 4:5 qu'il n'offre pas) ; la création borne de plus par `format.ratios` pour tous les formats
 * (`creerBrouillon`). Face caméra (`FORMATS_A_LANCEMENT_PROPRE`) et avocat (`FORMATS_EXCLUS_DE_T5`) : aucune, rien
 * ne leur est ajouté.
 */
export async function capacitesRatios(formatId: string, moteurId?: string): Promise<Ratio[]> {
  if (FORMATS_A_LANCEMENT_PROPRE.includes(formatId) || FORMATS_EXCLUS_DE_T5.includes(formatId)) return [];
  const format = obtenirFormat(formatId);
  const lancement = obtenirMoteur(moteurId ?? (await moteurAuLancement(formatId))).capacites.ratios;
  const duFormat = format.moteur === "simulation" ? format.ratios : obtenirMoteur(format.moteur).capacites.ratios;
  return lancement.filter((r) => duFormat.includes(r));
}
