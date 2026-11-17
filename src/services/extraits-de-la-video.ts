/**
 * X4-13b-a : lecture serveur des propriétés de la ligne « Extraits gardés de cette vidéo » (réglages + fiche).
 * Lecture seule, aucun appelant ; X4-13b (chef) posera la ligne dans `videos/[id]/page.tsx`.
 * Tout éteint : seul `true` exact allume ; archive éteinte = une seule lecture, rien d'autre.
 */
import "server-only";
import type { FicheSourceExtraits } from "@/domaine/archive-extraits";
import { lireNoteInteret, SEUILS_PAR_DEFAUT } from "@/briques/note-extraits/reglage";
import { ficheDeLaVideo, REGLAGE_INSCRIPTION } from "./archive-extraits";
import { lireParametre } from "./_commun";

export interface PortsExtraitsDeLaVideo {
  lire?: (id: string, defaut: unknown) => Promise<unknown>;
  fiche?: (videoId: string) => Promise<FicheSourceExtraits | null>;
}

export const LIEN_EXTRAITS = "/bibliotheque/source-extraits";

export interface ProprietesExtraitsDeLaVideo {
  fiche: FicheSourceExtraits | null;
  archiveActive: boolean;
  noteActive: boolean;
  seuilGarde: number;
  lien: string;
}

export async function proprietesExtraitsDeLaVideo(
  videoId: string,
  ports: PortsExtraitsDeLaVideo = {},
): Promise<ProprietesExtraitsDeLaVideo> {
  const lire = ports.lire ?? ((id: string, defaut: unknown) => lireParametre<unknown>(id, defaut));
  const eteint: ProprietesExtraitsDeLaVideo = {
    fiche: null, archiveActive: false, noteActive: false, seuilGarde: SEUILS_PAR_DEFAUT.garde, lien: LIEN_EXTRAITS,
  };

  let archive: unknown;
  try {
    archive = await lire(REGLAGE_INSCRIPTION, false);
  } catch {
    return eteint;
  }
  if (archive !== true) return eteint;

  const note = await lireNoteInteret(lire);
  if (!note.actif) return { ...eteint, archiveActive: true };

  let fiche: FicheSourceExtraits | null = null;
  try {
    fiche = await (ports.fiche ?? ((id: string) => ficheDeLaVideo(id)))(videoId);
  } catch (e) {
    console.warn("extraits-de-la-video : fiche illisible", e instanceof Error ? e.message : e);
  }
  return { fiche, archiveActive: true, noteActive: true, seuilGarde: note.seuils.garde, lien: LIEN_EXTRAITS };
}
