/**
 * X1-00 : 10 lignes du catalogue « tendances 2027 ». Jamais permises ; les 4 objets partent en X1-00b.
 * TENDANCES-2027-CAT-v20l (décision de Williams du 21/11 00:25) : les 7 effets validés sur planche passent à `eteint` (existent, pas ouverts) ;
 * zoom-mot (X1-05), fenetre-inclinee (X1-03) et mention.ia (X1-14) restent `prevu`. Jamais `prod` : rien n'est branché.
 */
import { ID } from "../noms";
import type { LigneCatalogue } from "./types";

const ids = [
  ID.textePoidsVariable, ID.texteMinimalDynamique, ID.ecranFenetreInclinee, ID.fondVerreDepoli,
  ID.transitionZoomMot, ID.transitionRaccordForme, ID.accrocheApercuFin, ID.accrocheMotCle,
  ID.mentionIa, ID.rythmeBoucle,
] as const;

const RESTENT_PREVU: ReadonlySet<string> = new Set([ID.ecranFenetreInclinee, ID.transitionZoomMot, ID.mentionIa]);

export const LIGNES_TENDANCES_2027: readonly LigneCatalogue[] = Object.freeze(
  ids.map((id): LigneCatalogue => ({ id, etat: (RESTENT_PREVU.has(id) ? "prevu" : "eteint"), chantier: "X1" })),
);
