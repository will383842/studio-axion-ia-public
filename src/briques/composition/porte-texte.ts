/**
 * Portes des effets de texte de la composition (BR-ETIQUETTES-OUTIL). Une fonction PURE par capacité, rien d'autre.
 * Vraie seulement si l'entrée de la bibliothèque est présente ET que le réglage a permis la capacité dans le profil figé ;
 * ne lève jamais (en cas de doute : fermée).
 */
import { porteCapacite } from "@/briques/bibliotheque-video/moteur";
import { ID } from "@/briques/bibliotheque-video/noms";

/** Étiquette « HUBSPOT », « ZAPIER »… quand l'outil est dit (texte seul, sans logo). */
export function etiquettesOutilPermises(entrees: unknown): boolean {
  try {
    const p = porteCapacite(entrees, ID.texteNomOutilAutonome);
    return p.bibliotheque === true && p.permis === true;
  } catch {
    return false;
  }
}
