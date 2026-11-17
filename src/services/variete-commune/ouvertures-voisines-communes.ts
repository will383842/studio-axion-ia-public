/**
 * Ouvertures des voisines du réseau, prêtes pour la consigne (E2, fiche X2-14b-b-a) : réglage `varieteCommune`, voisines
 * des réseaux, puis `ouverturesVoisines`, en un seul appel. Éteint par défaut : seul `true` (ou `{ seuil }`) allume ;
 * éteint, rend `undefined` après une seule lecture (celle du réglage). Lecture seule, aucun appel à Claude, aucune date,
 * aucun hasard. Aucun appelant à ce stade (X2-14b-b branchera). Ne bloque jamais : une lecture qui lève rend `undefined`.
 */
import "server-only";
import { lireReglageVarieteCommune } from "@/briques/variete-commune/reglage";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { ouverturesVoisines } from "./ouvertures-voisines";
import { voisinesDuReseau } from "./voisines";

export async function ouverturesVoisinesCommunes(d: {
  reseaux: readonly string[];
  videoIdEnCours?: string;
  lire: (cle: string) => Promise<unknown>;
  max?: number;
  lireVoisines?: typeof voisinesDuReseau;
}): Promise<string[] | undefined> {
  const reglage = await lireReglageVarieteCommune(d.lire);
  if (!reglage.actif || d.reseaux.length === 0) return undefined;
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
    // Plus récentes d'abord ; égalité : ordre reçu (tri stable).
    const triees = [...parVideo.values()].sort((a, b) => (b.le ?? "").localeCompare(a.le ?? ""));
    return ouverturesVoisines(triees, d.max ?? 3);
  } catch (e) {
    console.warn("[studio] ouvertures des voisines communes : voisines illisibles, consigne inchangée :", e instanceof Error ? e.message : e);
    return undefined;
  }
}
