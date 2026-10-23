/**
 * CONTRÔLE DE RACCORD ET RETOUR DANS LE PIPELINE (lot L10). PUR.
 *
 * Chaque passage retouché est mesuré avant d'être gardé : écart audio / bouche (lèvres calées sur la VOIX D'ORIGINE),
 * ressemblance du visage, visage présent, durée inchangée. Les mesures viennent d'une fonction injectée (studio-aligneur,
 * route `/visages` appliquée à la sortie ; voir JOURNAL-E1) ; ce module ne fait que juger.
 *
 * Retour à 25 i/s SANS CHANGER LA VITESSE : Higgsfield rend du 24 i/s de même durée ; on repasse à 25 i/s par
 * duplication d'images (filtre `fps=25`), jamais par `setpts` (qui accélérerait la vidéo et décalerait la voix).
 * La voix reste TOUJOURS l'audio d'origine de la prise utile.
 */

export interface MesuresRaccord {
  /** Écart moyen entre l'ouverture de bouche et l'énergie de la voix d'origine (ms ; positif = image en retard). */
  ecartBoucheMs: number;
  /** Ressemblance du visage avec le passage d'origine (0 à 1). */
  ressemblanceVisage: number;
  /** Part des images où le visage est trouvé (0 à 100). */
  visageTrouvePct: number;
}

export interface SeuilsRaccord {
  ecartBoucheMaxMs: number;
  ressemblanceMin: number;
  visageTrouveMinPct: number;
  /** Écart de durée toléré entre l'entrée et la sortie (essai : 15,04 s pour 15 s). */
  ecartDureeMaxSec: number;
}

/** Seuils retenus : ±80 ms reste invisible en face caméra ; visage « le même » au-dessus de 0,85. */
export const SEUILS_RACCORD: SeuilsRaccord = { ecartBoucheMaxMs: 80, ressemblanceMin: 0.85, visageTrouveMinPct: 90, ecartDureeMaxSec: 0.12 };

export type RaisonRefusRaccord = "levres" | "visage" | "visage-absent" | "duree" | "mesure-impossible";

export interface VerdictRaccord {
  ok: boolean;
  raisons: RaisonRefusRaccord[];
}

export function controlerRaccord(entree: { dureeSourceSec: number; dureeSortieSec: number; mesures: MesuresRaccord | null }, seuils: SeuilsRaccord = SEUILS_RACCORD): VerdictRaccord {
  const raisons: RaisonRefusRaccord[] = [];
  if (Math.abs(entree.dureeSortieSec - entree.dureeSourceSec) > seuils.ecartDureeMaxSec) raisons.push("duree");
  const m = entree.mesures;
  if (!m || ![m.ecartBoucheMs, m.ressemblanceVisage, m.visageTrouvePct].every(Number.isFinite)) {
    raisons.push("mesure-impossible");
  } else {
    if (Math.abs(m.ecartBoucheMs) > seuils.ecartBoucheMaxMs) raisons.push("levres");
    if (m.visageTrouvePct < seuils.visageTrouveMinPct) raisons.push("visage-absent");
    else if (m.ressemblanceVisage < seuils.ressemblanceMin) raisons.push("visage");
  }
  return { ok: raisons.length === 0, raisons };
}

/** Cadence du studio (export facecam). */
export const IPS_STUDIO = 25;
/** Zoom maximal permis à la réalisation sur une vidéo au décor retouché (sortie 704×1248 agrandie ; v4 n° 32). */
export const ZOOM_MAX_APRES_DECOR = 1.1;

export interface ConversionCadence {
  /** Filtre vidéo ffmpeg : duplication d'images, vitesse inchangée. */
  filtreVideo: string;
  /** Toujours 1 : la durée et la vitesse ne changent jamais. */
  vitesse: 1;
  /** Coupe la sortie à la durée exacte du passage d'origine (raccord image à l'image). */
  dureeSec: number;
}

export function conversionVers25ips(dureeSourceSec: number, largeur = 1080, hauteur = 1920): ConversionCadence {
  return { filtreVideo: `fps=${IPS_STUDIO},scale=${largeur}:${hauteur}:flags=lanczos,setsar=1`, vitesse: 1, dureeSec: Math.round(dureeSourceSec * IPS_STUDIO) / IPS_STUDIO };
}

export interface MorceauAssemblage {
  index: number;
  debutSec: number;
  finSec: number;
  /** `decor` : passage retouché (clé R2) ; `origine` : la vidéo utile telle quelle sur cet intervalle. */
  source: "decor" | "origine";
  fichierCle?: string;
  conversion?: ConversionCadence;
}

/** Plan rendu au moteur pour la suite (réalisation) : quels morceaux, quel son, quelle cadence. */
export interface PlanDecor {
  decorApplique: boolean;
  morceaux: MorceauAssemblage[];
  /** La voix d'origine de la prise utile, jamais celle de Higgsfield. */
  audio: "origine";
  ips: typeof IPS_STUDIO;
  /** Zoom maximal permis ensuite ; absent : règles habituelles (décor non appliqué). */
  zoomMax?: number;
}
