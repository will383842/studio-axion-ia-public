import type { ComposantPlaquette } from "../../types";
import { A01 } from "./A01";
import { A02 } from "./A02";
import { A03 } from "./A03";

/** Plaquettes de la famille « appels » : A01 message privé, A02 à retenir, A03 enregistrer et partager. */
export const PLAQUETTES_APPELS: Record<string, ComposantPlaquette> = { A01, A02, A03 };
