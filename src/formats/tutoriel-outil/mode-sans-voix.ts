/**
 * T-EXT-SV : MODE « SANS VOIX » du tutoriel d'outil (décision de Williams, 20/11 : même vidéo, sans la voix).
 *
 * Feuille pure (aucun import) : le format, l'écran et la chaîne la lisent. Le mode avec voix reste le défaut ; le mode
 * sans voix n'existe que si l'utilisateur le choisit. Silence total : aucune voix, aucune musique, aucun appel HeyGen,
 * aucune ligne de coût « voix ». La règle L1-05 (seule la voix HeyGen maître parle) reste entière pour le mode avec voix.
 */
export const MODE_AVEC_VOIX = "avec-voix";
export const MODE_SANS_VOIX = "sans-voix";
export type ModeVoixTutoriel = typeof MODE_AVEC_VOIX | typeof MODE_SANS_VOIX;

export const LIBELLE_MODE_AVEC_VOIX = "Avec voix";
export const LIBELLE_MODE_SANS_VOIX =
  "Sans voix (sous-titres et texte à l'écran)";
export const AIDE_MODE_SANS_VOIX =
  "La vidéo est la même, sans la voix : les sous-titres et le texte à l'écran portent le sens. Aucun son, aucune musique.";
export const PHRASE_DISTRIBUTION_ABSENTE =
  "Choisissez qui parle, ou choisissez le mode sans voix.";

/** Clé de l'entrée du tutoriel (même objet que `commande.entrees.tutorielOutil`, lu en tolérant). */
export const CLE_ENTREE_MODE_VOIX = "modeVoix";

/** Lecture tolérante du mode : seul `"sans-voix"` exact l'allume ; tout le reste = avec voix (le défaut). */
export function lireModeVoix(entreeTutoriel: unknown): ModeVoixTutoriel {
  const o =
    entreeTutoriel && typeof entreeTutoriel === "object"
      ? (entreeTutoriel as Record<string, unknown>)
      : {};
  return o[CLE_ENTREE_MODE_VOIX] === MODE_SANS_VOIX
    ? MODE_SANS_VOIX
    : MODE_AVEC_VOIX;
}

/** Combien de personnages le format accepte : 0 SEULEMENT en mode sans voix ; en mode avec voix, exactement 1 (le double). */
export function bornesPersonnages(mode: ModeVoixTutoriel): {
  min: number;
  max: number;
} {
  return mode === MODE_SANS_VOIX ? { min: 0, max: 1 } : { min: 1, max: 1 };
}

export function distributionAdmise(
  mode: ModeVoixTutoriel,
  nombre: number,
): boolean {
  const { min, max } = bornesPersonnages(mode);
  return Number.isInteger(nombre) && nombre >= min && nombre <= max;
}

/** Ce que l'écran range dans `commande.entrees.tutorielOutil` pour le mode choisi (avec voix = rien : le défaut ne change pas). */
export function entreeModeVoix(mode: ModeVoixTutoriel): { modeVoix?: typeof MODE_SANS_VOIX } {
  return mode === MODE_SANS_VOIX ? { [CLE_ENTREE_MODE_VOIX]: MODE_SANS_VOIX } : {};
}
