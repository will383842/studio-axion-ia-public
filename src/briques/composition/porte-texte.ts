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

/** BR-SORTIE-ANIMEE : les groupes de sous-titres sortent en glissant (fondu 0,2 s) au lieu de disparaître net. */
export function sortieAnimeePermise(entrees: unknown): boolean {
  try {
    const p = porteCapacite(entrees, ID.texteSortieAnimee);
    return p.bibliotheque === true && p.permis === true;
  } catch {
    return false;
  }
}

/** BR-FACECAM-TEXTE : les groupes d'une même phrase s'empilent en escalier (AM-09), seulement si la capacité est permise. */
export function escalierPermis(entrees: unknown): boolean {
  try {
    const p = porteCapacite(entrees, ID.texteEscalier);
    return p.bibliotheque === true && p.permis === true;
  } catch {
    return false;
  }
}

/** BR-FACECAM-TEXTE : le mot fort arrive sur une plaque animée posée sur une marque (Q2), seulement si la capacité est permise. */
export function pavePermis(entrees: unknown): boolean {
  try {
    const p = porteCapacite(entrees, ID.textePave);
    return p.bibliotheque === true && p.permis === true;
  } catch {
    return false;
  }
}

/** K2-T2-b2 : sous-titres sélectifs (les groupes sans nombre ni mot fort n'affichent plus de mots), seulement si la capacité est permise. */
export function selectifPermis(entrees: unknown): boolean {
  try {
    const p = porteCapacite(entrees, ID.texteSelectif);
    return p.bibliotheque === true && p.permis === true;
  } catch {
    return false;
  }
}
