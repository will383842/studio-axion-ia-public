/**
 * Mémoire des cartes « commune » (E2, fiche X2-13b-a) : réglage `varieteCommune`, voisines du réseau, puis
 * `memoireAvecVoisines`, en un seul appel. Éteint par défaut : seul `true` (ou `{ seuil }`) allume ; éteint, la mémoire
 * d'entrée est rendue telle quelle (même référence), avec une seule lecture (celle du réglage).
 * Lecture seule, aucune écriture, aucun appel à Claude. Aucun appelant à ce stade (X2-13b-b branchera).
 * Ne bloque jamais : une lecture qui lève rend la mémoire d'entrée.
 */
import "server-only";
import { lireReglageVarieteCommune } from "@/briques/variete-commune/reglage";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { memoireAvecVoisines, type MemoireCartes } from "./cartes-voisines";
import { voisinesDuReseau } from "./voisines";

export async function memoireCartesCommune(d: {
  memoire: MemoireCartes;
  reseaux: readonly string[];
  videoIdEnCours?: string;
  lire: (cle: string) => Promise<unknown>;
  ouvertureDuJourLe?: string;
  lireVoisines?: typeof voisinesDuReseau;
}): Promise<MemoireCartes> {
  const reglage = await lireReglageVarieteCommune(d.lire);
  if (!reglage.actif || d.reseaux.length === 0) return d.memoire;
  const lireVoisines = d.lireVoisines ?? voisinesDuReseau;
  try {
    const groupes = await Promise.all(
      d.reseaux.map((reseau) => lireVoisines({ reseau, videoIdEnCours: d.videoIdEnCours, fenetre: reglage.fenetre, pretesNonPubliees: reglage.pretesNonPubliees })),
    );
    const parVideo = new Map<string, EmpreinteVideo>();
    for (const e of groupes.flat()) {
      const l = parVideo.get(e.videoId);
      if (!l || (e.le ?? "") > (l.le ?? "")) parVideo.set(e.videoId, e);
    }
    return memoireAvecVoisines(d.memoire, [...parVideo.values()], d.ouvertureDuJourLe);
  } catch (e) {
    console.warn("[studio] mémoire des cartes commune : voisines illisibles, mémoire d'entrée conservée :", e instanceof Error ? e.message : e);
    return d.memoire;
  }
}
