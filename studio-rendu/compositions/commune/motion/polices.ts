/**
 * Police du motion design : Manrope (charte Axion 2026, SIL OFL 1.1), chargée EN LOCAL dans Remotion (aucune dépendance
 * réseau au rendu). Le rendu attend son chargement (`delayRender`) : jamais une image avec une police de secours.
 */
import { chargerPoliceManrope } from "../../visuels/police-manrope";

/** Charge Manrope (axe variable 200 à 800) une fois par page de rendu. */
export function chargerPolicesMotion(): void {
  chargerPoliceManrope();
}
