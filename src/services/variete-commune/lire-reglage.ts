/**
 * Lecteur PARTAGÉ du réglage `varieteCommune` (BR-TABLEAU-STYLE-b2). SEUL endroit du Studio qui lit cette clé en base ;
 * les branchements (tableau, avocat, face caméra…) l'importent sans toucher à l'inventaire des interrupteurs.
 * ALLUMÉ par défaut (ALLUMER-VARIETE-COMMUNE-v21o, décision du 21/11 07:20) : absent ou `null` = `true` ; `false` écrit en base l'éteint ; c'est `lireReglageVarieteCommune` (briques) qui décide (seul `true` ou `{ seuil }` allume ; lecture en échec = éteint).
 */
import "server-only";
import { lireParametre } from "../_commun";

export const lireVarieteCommune = (cle: string): Promise<unknown> => lireParametre<unknown>(cle, true);
