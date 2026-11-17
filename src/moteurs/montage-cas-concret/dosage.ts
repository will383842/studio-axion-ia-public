/**
 * Dosage de l'animation (X3-07a) : contraintes du cas concret selon le cran. PUR : aucun réseau, aucune date, aucun
 * hasard. Non branché (le branchement est X3-07b). Aucune valeur neuve : seulement des valeurs que le tirage produit déjà.
 */
import type { DosageMotion } from "@/briques/dosage-motion/types";
import type { Tirage } from "./variete";

/** Champs du tirage que le cran impose ; les autres ne sont jamais touchés. */
export interface ContraintesDosageCasConcret {
  sousTitres?: { intensite: Tirage["sousTitres"]["intensite"] };
  particules?: { densite: Tirage["particules"]["densite"] };
  fondFort?: Tirage["fondFort"];
}

/**
 * `undefined` sans cran et en équilibre. `aucun` n'est pas permis ici (`CRANS_PERMIS` : le cas concret est fait
 * d'animations, on peut les calmer, pas les retirer) : on lève une erreur claire plutôt que de l'ignorer en silence.
 */
export function contraintesDosageCasConcret(cran: DosageMotion | undefined): ContraintesDosageCasConcret | undefined {
  if (cran === undefined || cran === "equilibre") return undefined;
  if (cran === "aucun") throw new Error("Dosage « aucun » non permis pour le cas concret (CRANS_PERMIS) : choisir sobre, equilibre ou dynamique.");
  if (cran === "sobre") return { sousTitres: { intensite: "calme" }, particules: { densite: "legere" }, fondFort: 0 };
  return { sousTitres: { intensite: "vif" } };
}

/** Copie du tirage où seuls les champs contraints sont remplacés ; sans contrainte, une copie identique. Aucune mutation. */
export function appliquerContraintes(tirage: Tirage, contraintes: ContraintesDosageCasConcret | undefined): Tirage {
  const copie: Tirage = structuredClone(tirage);
  if (!contraintes) return copie;
  if (contraintes.sousTitres) copie.sousTitres = { ...copie.sousTitres, intensite: contraintes.sousTitres.intensite };
  if (contraintes.particules) copie.particules = { ...copie.particules, densite: contraintes.particules.densite };
  if (contraintes.fondFort !== undefined) copie.fondFort = contraintes.fondFort;
  return copie;
}
