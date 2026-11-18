// VL-01 — modèle de description longue (PUR, 0 €, aucun appel à Claude). Aucune phrase n'est écrite ici : chaque bloc
// vient du script validé ou d'un choix de l'utilisateur, et reste « à valider » tant qu'il ne l'a pas validé.
import { chapitresYoutube } from "@/domaine/site-videos/youtube";
import type { ChapitreWeb } from "@/domaine/site-videos/types";

export type IdBlocDescription = "reponse-courte" | "chapitres" | "lien";

export interface BlocDescription {
  id: IdBlocDescription;
  titre: string;
  /** Vide tant que l'utilisateur n'a rien choisi : le bloc n'invente jamais de phrase. */
  texte: string;
  valide: boolean;
}

export interface EntreeDescription {
  /** Réponse courte choisie par l'utilisateur (phrase prise du script validé). Absente : bloc vide. */
  reponseCourte?: string;
  chapitres: readonly ChapitreWeb[];
  /** Lien de la page de la vidéo, s'il est connu. */
  lienPage?: string;
  /** Blocs déjà validés par l'utilisateur. */
  valides?: readonly IdBlocDescription[];
}

export function modeleDescription(e: EntreeDescription): BlocDescription[] {
  const valides = new Set(e.valides ?? []);
  const bloc = (id: IdBlocDescription, titre: string, texte: string): BlocDescription => ({
    id,
    titre,
    texte,
    valide: valides.has(id) && texte.trim() !== "",
  });
  return [
    bloc("reponse-courte", "Réponse courte", (e.reponseCourte ?? "").trim()),
    bloc("chapitres", "Chapitres", e.chapitres.length ? chapitresYoutube([...e.chapitres]) : ""),
    bloc("lien", "Lien de la page", (e.lienPage ?? "").trim()),
  ];
}

/** Description assemblée à partir des SEULS blocs validés, dans l'ordre. */
export function descriptionValidee(blocs: readonly BlocDescription[]): string {
  return blocs
    .filter((b) => b.valide && b.texte.trim() !== "")
    .map((b) => b.texte)
    .join("\n\n");
}
