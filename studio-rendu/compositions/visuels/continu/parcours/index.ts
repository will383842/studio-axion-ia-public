import type { ComposantParcours } from "../types";
import { PX } from "./PX";

/** Calques des parcours, par identifiant de parcours (`registre-parcours.ts`). Les parcours de production viennent en P3h. */
export const COMPOSANTS_PARCOURS: Record<string, ComposantParcours> = { PX };
