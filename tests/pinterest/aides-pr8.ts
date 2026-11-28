/** Aides des tests PR 8 : lecture des bornes de mots-dièse et du profil de publication, sans réseau. */
import { PROFIL_PINTEREST } from "@/services/demande-publication-visuel";
import { placerHashtags } from "@/reseaux/placement-hashtags";

export const PROFIL_DESCRIPTION = (): number => PROFIL_PINTEREST.legendeMax;

/** Message de `placerHashtags` pour Pinterest avec ces mots-dièse (aucun : le message doit être vide). */
export function bornesMotsDiese(reseau: "pinterest", motsDiese: string[] = []): { message: string | undefined } {
  const s = placerHashtags({ reseau, texte: "Une description", motsDiese, placement: "texte", outil: "zernio" } as never);
  return { message: s.message };
}
