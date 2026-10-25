import type { ComposantParcours } from "../types";
import { PA } from "./PA";
import { PB } from "./PB";
import { PC } from "./PC";
import { PD } from "./PD";
import { PE } from "./PE";
import { PF } from "./PF";
import { PG } from "./PG";
import { PH } from "./PH";
import { PX } from "./PX";

/** Calques des parcours, par identifiant de parcours (`registre-parcours.ts`) : PX (essai) et les huit parcours de production (P3h). */
export const COMPOSANTS_PARCOURS: Record<string, ComposantParcours> = { PA, PB, PC, PD, PE, PF, PG, PH, PX };
