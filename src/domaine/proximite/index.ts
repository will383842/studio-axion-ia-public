/** API publique de la proximité : deux fonctions, rien d'autre (les autres fichiers du dossier restent internes). */
import { empreinte } from "./empreinte";
import { scoreProximite } from "./score";

/** Empreinte de proximité d'une publication. */
export const empreinteDe = empreinte;
/** Score de proximité entre deux empreintes : 1 si identiques, 0 sans axe commun. */
export const proximite = scoreProximite;
