/**
 * RÉGLAGES « PLAN DE SCÈNES » DES GÉNÉRATEURS EXISTANTS (lot R2). Un réglage par générateur. Depuis GV2-55, le plan est
 * ALLUMÉ par défaut pour le cas concret et le face caméra (`false` coupe : le réglage reste un coupe-circuit) ; la face
 * caméra animée reste ÉTEINTE par défaut (seul `true` l'allume : son rendu v4 est validé). Toute autre valeur, une absence
 * ou une lecture en échec = le défaut du générateur. PUR : la lecture est injectée (`lireParametre` côté service).
 */
export const GENERATEURS_PLAN = ["cas-concret", "facecam", "facecam-animee"] as const;
export type IdGenerateurPlan = (typeof GENERATEURS_PLAN)[number];

export const CLES_REGLAGE_PLAN_SCENES: Record<IdGenerateurPlan, string> = {
  "cas-concret": "planScenes.casConcret",
  facecam: "planScenes.facecam",
  "facecam-animee": "planScenes.facecamAnimee",
};

export type LireReglage = (id: string, defaut: unknown) => Promise<unknown>;

/** Défaut de chaque générateur : allumé pour le cas concret et le face caméra, éteint pour la face caméra animée. */
export const ALLUME_PAR_DEFAUT: Record<IdGenerateurPlan, boolean> = { "cas-concret": true, facecam: true, "facecam-animee": false };

export async function planScenesActif(generateur: IdGenerateurPlan, lire: LireReglage): Promise<boolean> {
  const defaut = ALLUME_PAR_DEFAUT[generateur];
  try {
    const v = await lire(CLES_REGLAGE_PLAN_SCENES[generateur], defaut);
    // Allumé par défaut : seul le booléen exact `false` éteint. Éteint par défaut : seul `true` allume.
    return defaut ? v !== false : v === true;
  } catch {
    return defaut;
  }
}
