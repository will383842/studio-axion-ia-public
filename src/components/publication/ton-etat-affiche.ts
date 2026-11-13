import type { Tonalite } from "@/domaine/libelles";

/**
 * Ton affiché d'un état de publication (habillage seul, maquettes M0 et M5 de la refonte) :
 * « Programmée » en vert, « Publiée » en contour neutre, et aucun orange dans « À publier ».
 * Le libellé et l'état ne changent pas ; seule la couleur de la pastille est choisie ici.
 */
export function tonEtatAffiche(libelle: string, ton: Tonalite): Tonalite {
  if (libelle === "Programmée") return "sauge";
  if (libelle === "Publiée") return "contour";
  return ton === "orange" ? "ambre" : ton;
}
