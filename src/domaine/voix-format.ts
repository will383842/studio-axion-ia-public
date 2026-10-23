/**
 * VOIX PAR DÉFAUT PAR FORMAT (posé par l'architecte le 02/10, `docs/LOT-INTENSITE-CREDITS-EXECUTION.md` ; propriétaire D2).
 * Will enregistre une voix « avocat » rapide : dans la fiche personnage, chaque format reçoit SA voix
 * (`Personnage.voixParFormat`), modifiable ensuite vidéo par vidéo (`Distribution.voixId`).
 * Le SEUL point de résolution : la création d'un brouillon (`nouvelle/[format]/page.tsx`), l'assistant
 * (`Distribution.tsx`, `express/logique.ts#voixInitiale`) et la fiche personnage l'appellent. PUR.
 *
 * Ordre : choix de la vidéo (s'il est prêt) > voix du format > voix par défaut du personnage > la première prête.
 */
import type { Personnage, Voix } from "./types";
import { visageParDefaut } from "./distribution";

export function voixPourFormat<V extends Pick<Voix, "id" | "statut">>(
  voix: V[],
  personnage: Pick<Personnage, "voixParDefautId" | "voixParFormat">,
  formatId: string,
  choixVideo?: string,
): V | undefined {
  const prete = (id?: string) => (id ? voix.find((v) => v.id === id && v.statut === "pret") : undefined);
  return prete(choixVideo) ?? prete(personnage.voixParFormat?.[formatId]) ?? visageParDefaut(voix, personnage.voixParDefautId);
}
