/**
 * Tableau — garde du regard (variante A, S-10) : une enveloppe PURE autour du relecteur d'images clés.
 * Elle ne regarde que la sortie principale et compte ses appels réels : au plus 2 par vidéo (1 regard + 1 second regard
 * après une page refaite). Au-delà, ou hors sortie principale, ou en cas de panne : « images non relues », jamais
 * « rien à signaler ». Le compteur est le vrai arrêt (un plafond d'argent ne bloque pas en budget indicatif).
 * Sans IA, sans réglage, sans importeur : rien n'est branché. Types STRUCTURELS (aucun import).
 */

/** Texte de la remarque quand rien n'a été relu. */
export const RAISON_NON_RELUE = "images non relues";

/** Nombre maximal de regards réels par vidéo (variante A). */
export const MAX_REGARDS_PAR_VIDEO = 2;

interface VideoRegardee { cle: string; dureeSec: number; attendre?: () => Promise<void> }
interface RelectureRendue { imagesLues: number; remarques: readonly { image: number; raison: string }[] }

export interface OptionsGardeRegard {
  /** Clé de la sortie principale : la seule qui est regardée. */
  clePrincipale: string;
  /** Plafond d'appels réels, jamais au-dessus de 2. */
  maxAppels?: number;
}

const nonRelue = (): RelectureRendue => ({ imagesLues: 0, remarques: [{ image: 1, raison: RAISON_NON_RELUE }] });

/** Une garde PAR vidéo (le compteur vit dans la garde). Le relecteur est injecté. */
export function garderRegard<F, M>(
  relecteur: (fiche: F, miseEnPage: M, video: VideoRegardee) => Promise<RelectureRendue> | RelectureRendue,
  options: OptionsGardeRegard,
): (fiche: F, miseEnPage: M, video: VideoRegardee) => Promise<RelectureRendue> {
  // Plafond illisible (NaN, Infinity, texte) : sens prudent, 0 appel réel ; jamais sans plafond.
  const brut = options.maxAppels ?? MAX_REGARDS_PAR_VIDEO;
  const plafond = typeof brut === "number" && Number.isFinite(brut) ? Math.min(MAX_REGARDS_PAR_VIDEO, Math.max(0, Math.floor(brut))) : 0;
  let appels = 0;
  return async (fiche, miseEnPage, video) => {
    if (video.cle !== options.clePrincipale) return nonRelue();
    if (appels >= plafond) return nonRelue();
    appels += 1; // pris AVANT l'attente : des appels simultanés ne peuvent pas dépasser le plafond.
    try {
      return await relecteur(fiche, miseEnPage, video);
    } catch {
      return nonRelue();
    }
  };
}
