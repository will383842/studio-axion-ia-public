import type { ComposantPlaquette } from "../../types";
import { D01 } from "./D01";
import { D02 } from "./D02";
import { D03 } from "./D03";

/** Plaquettes de la famille « donnees » : grand chiffre, citation, trois barres. */
export const PLAQUETTES_DONNEES: Record<string, ComposantPlaquette> = { D01, D02, D03 };
