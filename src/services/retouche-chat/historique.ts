import type { VersionVideo } from "@/domaine/types";

/**
 * G14-04 : historique des versions d'une vidéo et cible du « rétablir » (refaire). Fonctions pures, rien n'écrit :
 * la version d'origine et les branches ne sont jamais effacées (revenir et rétablir ne font que basculer `choisie`).
 */
export type LigneHistorique = Pick<VersionVideo, "id" | "numero" | "choisie" | "statut" | "creeLe"> & {
  parentVersionId?: string;
  noteRetouche?: string;
  /** Vrai si la version vient du chat de retouche. Le contenu de la retouche, lui, ne sort jamais. */
  retoucheChat: boolean;
};

type VersionLue = Pick<VersionVideo, "id" | "videoId" | "numero" | "choisie" | "statut" | "creeLe" | "parentVersionId" | "noteRetouche" | "projetMontage">;

/** Versions de CETTE vidéo, triées par `numero`, sans `commande` ni `projetMontage`. */
export function historiqueVersions(versions: readonly VersionLue[], videoId: string): LigneHistorique[] {
  return versions
    .filter((v) => v.videoId === videoId)
    .sort((a, b) => a.numero - b.numero)
    .map((v) => ({
      id: v.id,
      numero: v.numero,
      ...(v.parentVersionId !== undefined ? { parentVersionId: v.parentVersionId } : {}),
      choisie: v.choisie,
      statut: v.statut,
      ...(v.noteRetouche !== undefined ? { noteRetouche: v.noteRetouche } : {}),
      creeLe: v.creeLe,
      retoucheChat: !!v.projetMontage && typeof v.projetMontage === "object" && "retoucheChat" in v.projetMontage,
    }));
}

/** Enfant le plus récent (`numero` max) de la version choisie, ou `null` s'il n'y en a pas. */
export function versionARetablir(versions: readonly Pick<VersionVideo, "id" | "numero" | "parentVersionId">[], choisieId: string): string | null {
  let cible: Pick<VersionVideo, "id" | "numero"> | null = null;
  for (const v of versions) {
    if (v.parentVersionId === choisieId && (cible === null || v.numero > cible.numero)) cible = v;
  }
  return cible ? cible.id : null;
}
