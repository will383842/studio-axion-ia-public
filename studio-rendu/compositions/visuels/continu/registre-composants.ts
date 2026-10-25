/**
 * Registre des composants de la toile : plaquettes par `type` (familles `gabarits/<famille>/index.ts`), calques de parcours par identifiant,
 * raccords par `type`. Des fonctions seulement : aucun JSX au chargement du module.
 */
import { PLAQUETTES_APPELS } from "./gabarits/appels";
import { PLAQUETTES_CAS } from "./gabarits/cas";
import { PLAQUETTES_COMPARAISONS } from "./gabarits/comparaisons";
import { PLAQUETTES_COUVERTURES } from "./gabarits/couvertures";
import { PLAQUETTES_DONNEES } from "./gabarits/donnees";
import { PLAQUETTES_ESSAI } from "./gabarits/essai";
import { PLAQUETTES_LISTES } from "./gabarits/listes";
import { COMPOSANTS_PARCOURS } from "./parcours";
import { COMPOSANTS_RACCORDS } from "./raccords";
import type { ComposantPlaquette } from "./types";

export const COMPOSANTS_PLAQUETTES: Record<string, ComposantPlaquette> = {
  ...PLAQUETTES_COUVERTURES,
  ...PLAQUETTES_LISTES,
  ...PLAQUETTES_COMPARAISONS,
  ...PLAQUETTES_CAS,
  ...PLAQUETTES_DONNEES,
  ...PLAQUETTES_APPELS,
  ...PLAQUETTES_ESSAI,
};

export { COMPOSANTS_PARCOURS, COMPOSANTS_RACCORDS };
