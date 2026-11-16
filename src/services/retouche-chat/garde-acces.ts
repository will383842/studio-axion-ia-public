import type { LireReglage } from "./generateurs";

/** C7-02 : réglage qui rouvre la voie du chat de retouche SANS générateur nommé. Éteint par défaut. */
export const CLE_REGLAGE_SANS_GENERATEUR = "retoucheChat.sansGenerateur";

/** Allumé seulement par `true` exactement ; toute autre valeur, une absence ou une lecture en échec = éteint. */
export async function sansGenerateurActif(lire: LireReglage): Promise<boolean> {
  try {
    return (await lire(CLE_REGLAGE_SANS_GENERATEUR, false)) === true;
  } catch {
    return false;
  }
}

/** `true` seulement si la version existe et appartient à cette vidéo ; une lecture en échec = `false`. */
export async function versionDeLaVideo(
  videoId: string,
  versionId: string,
  obtenir: (id: string) => Promise<{ videoId: string } | null | undefined>,
): Promise<boolean> {
  try {
    const v = await obtenir(versionId);
    return !!v && v.videoId === videoId;
  } catch {
    return false;
  }
}

/**
 * N-22 : `true` si la vidéo est programmée ou publiée (elle ne se retouche plus ici). Lit la seule vidéo ;
 * vidéo absente ou lecture en échec = `true` (prudent : refus).
 */
export async function videoEnDiffusion(
  videoId: string,
  obtenir: (id: string) => Promise<{ etapeEditoriale?: string } | null | undefined>,
): Promise<boolean> {
  try {
    const v = await obtenir(videoId);
    if (!v) return true;
    return v.etapeEditoriale === "programmee" || v.etapeEditoriale === "publiee";
  } catch {
    return true;
  }
}
