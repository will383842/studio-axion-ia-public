/**
 * Service de refus commun (X2-10a). Éteint par défaut : seul `true` exact (ou `{ seuil }`) allume.
 * La garde est facultative : par défaut `verifier` (X2-04, X2-10b).
 * Lecture seule, aucune écriture, aucun appelant à ce stade.
 */
import "server-only";
import { verifier } from "@/briques/variete-commune/garde";
import { lireReglageVarieteCommune } from "@/briques/variete-commune/reglage";
import type { EmpreinteVideo, ResultatGarde, Voisine } from "@/briques/variete-commune/types";
import { voisinesDuReseau } from "./voisines";

export type GardeCommune = (e: EmpreinteVideo, voisines: readonly Voisine[], o: { seuil: number }) => ResultatGarde;

const ACCEPTE: ResultatGarde = { ok: true, score: null, axesCommuns: [], phrase: "" };

/** Le pire : refus d'abord, puis score le plus haut. */
function pire(a: ResultatGarde, b: ResultatGarde): ResultatGarde {
  if (a.ok !== b.ok) return a.ok ? b : a;
  return (b.score ?? -1) > (a.score ?? -1) ? b : a;
}

export async function refusCommunPour(d: {
  videoId: string;
  reseaux: readonly string[];
  lire: (cle: string) => Promise<unknown>;
  garde?: GardeCommune;
  lireVoisines?: typeof voisinesDuReseau;
}): Promise<((e: EmpreinteVideo) => ResultatGarde) | undefined> {
  const reglage = await lireReglageVarieteCommune(d.lire);
  if (!reglage.actif) return undefined;
  const lireVoisines = d.lireVoisines ?? voisinesDuReseau;
  let groupes: Voisine[][];
  try {
    groupes = await Promise.all(
      d.reseaux.map(async (reseau) => {
        const empreintes = await lireVoisines({ reseau, videoIdEnCours: d.videoId, fenetre: reglage.fenetre, pretesNonPubliees: reglage.pretesNonPubliees });
        return empreintes.map((empreinte, rang) => ({ empreinte, reseau, rang }));
      }),
    );
  } catch (e) {
    console.warn("[studio] refus commun : voisines illisibles, tout est accepté :", e instanceof Error ? e.message : e);
    return () => ACCEPTE;
  }
  return (e) => {
    let rendu: ResultatGarde | undefined;
    for (const voisines of groupes) {
      if (!voisines.length) continue;
      const r = (d.garde ?? verifier)(e, voisines, { seuil: reglage.seuil });
      rendu = rendu ? pire(rendu, r) : r;
    }
    return rendu ?? ACCEPTE;
  };
}
