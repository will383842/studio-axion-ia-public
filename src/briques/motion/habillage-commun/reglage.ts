/**
 * C6-H4a : réglages de l'habillage commun, lus par une fonction injectée. ÉTEINTS : seul le booléen `true` exact
 * allume ; toute autre valeur, une absence ou une lecture en échec = éteint. Appelé par `services/cas-concret.ts` ;
 * ALLUMER-TRANSITIONS-CC-v20g · Williams 20/11 : `transitionsPlanScenes` allumé par défaut, seul `false` l'éteint. Aucun réglage de son (décision du 17/11). PUR, aucun import.
 */
export const CLES_REGLAGE_HABILLAGE = Object.freeze({
  transitionsPlanScenes: "habillage.transitionsPlanScenes",
  transitionsStyleMontage: "habillage.transitionsStyleMontage",
  lutsSupplementaires: "habillage.lutsSupplementaires",
} as const);

export type NomReglageHabillage = keyof typeof CLES_REGLAGE_HABILLAGE;

export type LireReglageHabillage = (id: string, defaut: unknown) => Promise<unknown>;

export const estAllume = (v: unknown): boolean => v === true;

export async function habillageActif(nom: NomReglageHabillage, lire: LireReglageHabillage): Promise<boolean> {
  if (!Object.prototype.hasOwnProperty.call(CLES_REGLAGE_HABILLAGE, nom)) return false;
  try {
    if (nom === "transitionsPlanScenes") return (await lire(CLES_REGLAGE_HABILLAGE[nom], true)) !== false;
    return estAllume(await lire(CLES_REGLAGE_HABILLAGE[nom], false));
  } catch {
    return false;
  }
}

export async function reglagesHabillage(lire: LireReglageHabillage): Promise<Readonly<Record<NomReglageHabillage, boolean>>> {
  const noms = Object.keys(CLES_REGLAGE_HABILLAGE) as NomReglageHabillage[];
  const valeurs = await Promise.all(noms.map((n) => habillageActif(n, lire)));
  const out = {} as Record<NomReglageHabillage, boolean>;
  noms.forEach((n, i) => {
    out[n] = valeurs[i];
  });
  return Object.freeze(out);
}
