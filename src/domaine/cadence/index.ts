/** API publique de la cadence : deux fonctions, rien d'autre (les autres fichiers du dossier restent internes). */
import { planifierLot } from "./planifier";
export { verifierEspacement } from "./verifier";

/** Plan de plusieurs sujets lancés le même jour (voir `planifierLot`). */
export const planifier = planifierLot;
