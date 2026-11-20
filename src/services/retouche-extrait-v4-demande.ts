/**
 * R4-03-d1 : retouche gratuite v4 « Changer un extrait », le service qui relit la demande, la lie à la version choisie
 * et lance la retouche habituelle. Monté nulle part. Aucun réglage lu : l'interrupteur (`actif`) est OBLIGATOIRE et
 * fourni par l'appelant futur. Aucun montant ici : la garde d'argent est celle de `lancerRetouche`, dont l'erreur remonte
 * telle quelle.
 */
import "server-only";
import type { Id } from "@/domaine/types";
import { CLE_ENTREE_RETOUCHE_EXTRAIT_V4, lireDemandeExtraitV4 } from "@/moteurs/montage-facecam-animee/retouche-extrait-v4";
import { depots } from "./_commun";
import { lancerRetouche } from "./fabrication";

/** Version choisie d'une vidéo, vue par ce service : son id et les entrées de sa commande. */
export interface VersionChoisieV4 {
  id: Id;
  commande: { entrees?: Record<string, unknown> };
}

export interface DepsDemandeExtraitV4 {
  /** OBLIGATOIRE, sans défaut : faux ou qui lève → refusée. */
  actif: () => Promise<boolean>;
  lancer?: typeof lancerRetouche;
  /** Version choisie de la vidéo, ou `null` (vidéo ou version absente). */
  lireVideo?: (id: Id) => Promise<VersionChoisieV4 | null>;
}

export type ResultatDemandeExtraitV4 = { statut: "lancee"; travailId: Id } | { statut: "refusee"; raison: string };

const refus = (raison: string): ResultatDemandeExtraitV4 => ({ statut: "refusee", raison });

async function versionChoisieDe(videoId: Id): Promise<VersionChoisieV4 | null> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  return video?.versionChoisieId ? ((await d.versions.obtenir(video.versionChoisieId)) ?? null) : null;
}

export async function demanderRetoucheExtraitV4(videoId: Id, demande: unknown, deps: DepsDemandeExtraitV4): Promise<ResultatDemandeExtraitV4> {
  let allume = false;
  try {
    allume = (await deps.actif()) === true;
  } catch {
    allume = false;
  }
  if (!allume) return refus("retouche d'extrait éteinte");
  const lue = lireDemandeExtraitV4(demande);
  if (!lue) return refus("demande d'extrait illisible");
  const courante = await (deps.lireVideo ?? versionChoisieDe)(videoId);
  if (!courante) return refus("aucune version choisie pour cette vidéo");
  const entrees = { ...(courante.commande.entrees ?? {}), [CLE_ENTREE_RETOUCHE_EXTRAIT_V4]: { ...lue, pourVersionId: courante.id } };
  const r = await (deps.lancer ?? lancerRetouche)(videoId, [], "Changer un extrait", { entrees });
  return { statut: "lancee", travailId: r.travailId };
}
