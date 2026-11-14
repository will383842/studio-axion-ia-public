import "server-only";
import { entreeDepuisPublication, type EntreeApercu, type PublicationApercu } from "@/components/calendrier/apercu-reseau";

/**
 * Entrées de la semaine avec leur média (pont CAL-14P0 : version vide, la fiche CAL-14A y branche les pages signées).
 * Ne lève jamais : si le chargement du média échoue, les entrées sont rendues sans média.
 */
export async function entreesAvecMedias(semaine: PublicationApercu[]): Promise<EntreeApercu[]> {
  try {
    return semaine.map(entreeDepuisPublication);
  } catch {
    return semaine.map(entreeDepuisPublication);
  }
}
