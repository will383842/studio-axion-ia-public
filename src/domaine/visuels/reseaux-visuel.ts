/**
 * Lecteur (PUR) de `Visuel.reseaux` et de la famille du visuel : n'écrit rien, ne déduit aucun réseau.
 * Un ancien visuel sans réseau donne une liste vide (le classement le range alors dans « non précisé »).
 */
import type { IdReseau } from "../types";
import type { TypeContenu } from "../taxonomie-contenu";
import type { Visuel } from "./visuel";

/** Réseaux du visuel, sans doublon, dans l'ordre d'origine ; vide si absent. */
export function reseauxDuVisuel(v: Pick<Visuel, "reseaux">): IdReseau[] {
  return [...new Set<IdReseau>(v.reseaux ?? [])];
}

/** Type de contenu d'un visuel : les carrousels (pages ou continu) sont des carrousels, l'infographie est une image. */
export function typeContenuDuVisuel(v: Pick<Visuel, "famille">): TypeContenu {
  return v.famille === "infographie" ? "image" : "carrousel";
}
