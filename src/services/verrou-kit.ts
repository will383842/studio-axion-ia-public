/**
 * Verrou local du kit de publication (un seul processus studio). Partagé par `publications.ts` et `site-videos.ts` :
 * la création du kit, une retouche de Will, un texte de Claude et le passeport web ne s'effacent jamais l'un l'autre.
 */
import "server-only";
import { creerVerrou } from "./_commun";

export const sousVerrouKit = creerVerrou();
