/** X1-00 : 10 lignes `prevu` du catalogue « tendances 2027 ». Jamais permises ; les 4 objets partent en X1-00b. */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

const ids = [
  ID.textePoidsVariable, ID.texteMinimalDynamique, ID.ecranFenetreInclinee, ID.fondVerreDepoli,
  ID.transitionZoomMot, ID.transitionRaccordForme, ID.accrocheApercuFin, ID.accrocheMotCle,
  ID.mentionIa, ID.rythmeBoucle,
] as const;

export const LIGNES_TENDANCES_2027: readonly LigneCatalogue[] = Object.freeze(
  ids.map((id): LigneCatalogue => ({ id, etat: "prevu", chantier: "X1" })),
);
