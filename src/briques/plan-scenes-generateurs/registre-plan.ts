/**
 * REGISTRE OUVERT DES RÉGLAGES « PLAN DE SCÈNES » (G2-11). Donne le nom de l'interrupteur et son état pour n'importe
 * quel générateur, sans allonger la liste fermée de `reglage.ts`. Les trois générateurs actuels : même réponse
 * qu'avant (délégation). Tout autre générateur bien formé : ÉTEINT par défaut, seul le booléen `true` allume.
 * PUR : la lecture est injectée. Personne ne l'appelle encore : aucune vidéo ne change.
 */
import { CLES_REGLAGE_PLAN_SCENES, GENERATEURS_PLAN, planScenesActif, type IdGenerateurPlan, type LireReglage } from "./reglage";

const ID_BIEN_FORME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function estConnu(generateur: string): generateur is IdGenerateurPlan {
  return (GENERATEURS_PLAN as readonly string[]).includes(generateur);
}

function bienForme(generateur: unknown): generateur is string {
  return typeof generateur === "string" && ID_BIEN_FORME.test(generateur);
}

export function cleReglagePlanScenesDe(generateur: string): string | null {
  if (!bienForme(generateur)) return null;
  if (estConnu(generateur)) return CLES_REGLAGE_PLAN_SCENES[generateur];
  return "planScenes." + generateur.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

export async function planScenesActifDe(generateur: string, lire: LireReglage): Promise<boolean> {
  const cle = cleReglagePlanScenesDe(generateur);
  if (cle === null) return false;
  if (estConnu(generateur)) return planScenesActif(generateur, lire);
  try {
    return (await lire(cle, false)) === true;
  } catch {
    return false;
  }
}
