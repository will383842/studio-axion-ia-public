import type { ComponentType } from "react";
import type { TypeMini } from "../../../../src/briques/visuels/registre-mini";
import type { ProprietesMini } from "./types";
import { W01 } from "./W01";
import { W02 } from "./W02";
import { W03 } from "./W03";
import { W06 } from "./W06";
import { W07 } from "./W07";
import { W25 } from "./W25";

/** Un composant par mini-visuel du registre (le typage et un test refusent tout oubli). */
export const COMPOSANTS_MINI: Record<TypeMini, ComponentType<ProprietesMini>> = { W01, W02, W03, W06, W07, W25 };
export type { ProprietesMini };
