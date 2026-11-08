/**
 * RÉGLAGES « PLAN DE SCÈNES » DES GÉNÉRATEURS EXISTANTS (lot R2). Un réglage par générateur, ÉTEINT par défaut : tant que
 * Williams n'a pas validé le rendu, rien ne change à l'écran. Allumé seulement si la valeur vaut exactement `true` ; toute
 * autre valeur, une absence ou une lecture en échec = éteint. PUR : la lecture est injectée (`lireParametre` côté service).
 */
export const GENERATEURS_PLAN = ["cas-concret", "facecam", "facecam-animee"] as const;
export type IdGenerateurPlan = (typeof GENERATEURS_PLAN)[number];

export const CLES_REGLAGE_PLAN_SCENES: Record<IdGenerateurPlan, string> = {
  "cas-concret": "planScenes.casConcret",
  facecam: "planScenes.facecam",
  "facecam-animee": "planScenes.facecamAnimee",
};

export type LireReglage = (id: string, defaut: unknown) => Promise<unknown>;

export async function planScenesActif(generateur: IdGenerateurPlan, lire: LireReglage): Promise<boolean> {
  try {
    return (await lire(CLES_REGLAGE_PLAN_SCENES[generateur], false)) === true;
  } catch {
    return false;
  }
}
