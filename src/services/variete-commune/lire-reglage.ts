/**
 * Lecteur PARTAGÉ du réglage `varieteCommune` (BR-TABLEAU-STYLE-b2). SEUL endroit du Studio qui lit cette clé en base ;
 * les branchements (tableau, avocat, face caméra…) l'importent sans toucher à l'inventaire des interrupteurs.
 * Éteint par défaut : absent = `false`, et c'est `lireReglageVarieteCommune` (briques) qui décide (seul `true` ou `{ seuil }` allume).
 */
import "server-only";
import { lireParametre } from "../_commun";

export const lireVarieteCommune = (cle: string): Promise<unknown> => lireParametre<unknown>(cle, false);
