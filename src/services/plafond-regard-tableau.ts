/**
 * S-10-PLAFOND-v20l : plafond PROPRE du regard de Claude sur le tableau, par vidéo (décision de Williams, Q7 : 0,65 € par
 * vidéo = 0,72 $ au taux du Studio 0,90, soit 0,648 €). Le montant vit ici, hors du fichier d'argent. Chargé
 * seulement par l'import dynamique de `regardeur-tableau.ts` ; aucun importeur en production tant que le regard n'est pas branché.
 */
import { PREFIXE_ETAPE_REGARD_TABLEAU, type PlafondPropre } from "./depense-claude-video";

export const PLAFOND_REGARD_TABLEAU_USD = 0.72;
export const PARAM_PLAFOND_REGARD_TABLEAU = "tableau.plafondRegardUsd";

export const PLAFOND_REGARD_TABLEAU: PlafondPropre = Object.freeze({ id: "tbreg", parametre: PARAM_PLAFOND_REGARD_TABLEAU, defautUsd: PLAFOND_REGARD_TABLEAU_USD, prefixeEtape: PREFIXE_ETAPE_REGARD_TABLEAU });
