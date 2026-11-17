/**
 * Étiquettes d'usage (X4-05) : téléphone, écran, fond, preuve chiffrée (§ b.5 de l'étude E4).
 * Fonction pure, rien ne l'appelle encore. Aucune date du jour, aucun hasard.
 */
import type { Moment, Montre, UsageExtrait } from "./types";
import { usagesPermis } from "./sources-propres";

export interface OptionsUsages {
  /** Marque « chiffres réels » posée par Williams (X4-12). Seul `true` exact l'allume. */
  chiffresReels: boolean;
  /** Texte incrusté accepté pour le téléphone (P-4). Seul `true` exact l'allume. */
  texteIncrusteAccepte?: boolean;
}

const MONTRES_ECRAN: readonly Montre[] = ["interface", "chiffre", "demarche", "geste"];

export function usagesDe(moment: Moment, options: OptionsUsages): UsageExtrait[] {
  const duree = moment.finSec - moment.debutSec;
  const usages: UsageExtrait[] = [];

  const vertical = moment.ratio === "9:16" || moment.ratio === "4:5";
  const texteOk = !moment.texteIncruste || options?.texteIncrusteAccepte === true;
  if (vertical && duree >= 3 && duree <= 6 && texteOk) usages.push("telephone");

  if (MONTRES_ECRAN.includes(moment.montre) && !moment.avecVisage) usages.push("ecran");

  if (duree >= 5 && !moment.texteIncruste && moment.montre !== "chiffre") usages.push("fond");

  if (moment.montre === "chiffre" && options?.chiffresReels === true) usages.push("preuve-chiffree");

  return usagesPermis(moment, [...new Set(usages)].sort());
}
