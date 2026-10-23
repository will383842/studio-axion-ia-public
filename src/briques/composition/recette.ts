/**
 * RECETTE DE COMPOSITION — ce qu'un FORMAT dit à la brique commune « composition » (centralisée le 02/10).
 *
 * La brique sait poser un décor, un double, un accessoire, recadrer, poser des illustrations et des incrustations,
 * placer un encadré de titre sous les sous-titres, choisir la LUT de chaque plan, régler le son et l'export, et écrire
 * la passe FFmpeg des calques image. Elle ne connaît AUCUN format : tout ce qui change d'un format à l'autre est ici,
 * en données. Un moteur de format fournit sa recette (ex. `moteurs/montage-avocat/recette-composition.ts`) et ne
 * réécrit rien de la mise en image.
 *
 * Ce qui n'est PAS dans la recette parce que la commande le porte déjà (choisi dans la console, figé au lancement) :
 * décor, accessoires, LUT et intensité, style des sous-titres, habillage (encadré), profil de son, export du format,
 * profil de réalisme, recette de montage (angles). La recette donne alors la valeur PAR DÉFAUT, quand la commande
 * n'en dit rien.
 */
import type { AngleVisage } from "@/domaine/types";
import type { EncadreOuverture } from "@/formats/types";
import type { DecorScene, RatioScene, ReductionLarge } from "./scene";

/** Géométrie des incrustations graphiques (calque 6 bis), en proportions de l'image. */
export interface GeometrieIncrustations {
  /** Haut de la bande des incrustations (% de la hauteur) ; le bas est la limite basse de la zone protégée. */
  hautPct: number;
  /** Taille du texte d'un montant (px à 1080 de large). */
  montantTaillePx: number;
  /** Largeur d'un objet détouré (% de la largeur). */
  objetLargeurPct: number;
  /** Une incrustation plus courte que cela (s) n'est pas posée. */
  dureeMinSec: number;
}

/**
 * Géométrie quand rien n'est dit : NEUTRE (bande à mi-hauteur, montant 96 px, objet au tiers de la largeur).
 * E2E-1 n° 10 (03/10) : les valeurs réglées pour l'avocat (52 %, 118 px, 35 %) sont dans SA recette.
 */
export const GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT: GeometrieIncrustations = { hautPct: 50, montantTaillePx: 96, objetLargeurPct: 33, dureeMinSec: 0.4 };

export interface RecetteComposition {
  /** Identifiant du format (journal, tests). */
  id: string;
  /** Angles du double quand la commande n'a pas de recette de montage (`commande.recetteMontage.angles` prime). */
  angles: { principal: AngleVisage; second?: AngleVisage };
  /** Encadré de titre quand ni le profil de rendu ni le format n'en donnent (absent : aucun encadré par défaut). */
  encadreParDefaut?: EncadreOuverture;
  /** Décor posé quand aucun n'est choisi, ou quand le décor choisi est fabriqué avec le double (Look encore simulé). */
  decorRepli: DecorScene;
  /** Nom du décor de repli, dit à Will dans l'alerte (« le fond Halo orange le remplace »). */
  nomDecorRepli: string;
  /** Correcteur réel 2 : fondu de fin au noir, au plus ces secondes, jamais avant le dernier mot. Absent : aucun. */
  fonduFinMaxSec?: number;
  /**
   * 11/10, tableau animé (ajout pur) : bords sûrs à l'export — conversion RVB sûre (`ParametresExport.conversionRvbSure`,
   * contre la bande noire de 8 px au bord droit du FFmpeg 8.1.1) et mesure des bords noirs du fichier exporté
   * (`ParametresExport.mesurerBords`). Absent : export d'avant, inchangé.
   */
  exportBordsSurs?: boolean;
  /**
   * 14/10, « la vidéo s'arrête net » (ajout pur) : fin propre à l'export — image finale tenue puis fondu image + son
   * (`ParametresExport.finPropre`). Absent : coupe sèche d'avant (face caméra : sa boucle en dépend).
   */
  finPropre?: { fonduSec: number; tenueSec: number; couleur: string };
  /** Réduction du double en plan « large » hors 9:16 (9:16 : toujours 1). */
  reductionLarge: ReductionLarge;
  /** Centre des sous-titres hors 9:16 (% de la hauteur) ; en 9:16, le style des sous-titres décide. */
  centreSousTitres: Record<Exclude<RatioScene, "16:9">, number> & Partial<Record<"16:9", number>>;
  /** Taille de référence des sous-titres (px à 1080) pour estimer leur bas quand rien n'est dessiné. */
  tailleSousTitresPx: number;
  incrustations: GeometrieIncrustations;
  /** Grain, taille du grain et vignette quand le profil de réalisme n'en dit rien. */
  realisme: { grainPct: number; grainTaillePx: number; vignettePct: number };
  /** Intensité de la LUT (%) quand le style n'en dit rien. */
  lutIntensiteParDefaut: number;
  /**
   * 11/10, tableau animé style « blocs/2 » (ajout pur, FACULTATIF) : bruitages déclarés par le plan des scènes (instant
   * et famille), à mixer sous la voix. Absent : aucun (comportement d'avant).
   */
  bruitagesPlan?: RecetteBruitagesPlan;
  /**
   * 11/10, tableau animé style « blocs/2 » (ajout pur, FACULTATIF) : l'écran de fin reste `apresVoixSec` après la fin
   * de la voix, puis l'image fond au noir en `fonduImageSec`. Absent : comportement d'avant.
   */
  finTenue?: { apresVoixSec: number; fonduImageSec: number };
}

/** Bruitages posés par le plan des scènes : fichier et gain de chaque famille, écart minimal, marge sous la voix. */
export interface RecetteBruitagesPlan {
  sons: Readonly<Record<string, { cleStockage: string; gainDb: number }>>;
  /** Le son reste au moins à ce nombre de dB sous la voix (en crête). */
  sousVoixDbMin: number;
  /** Deux sons d'une même famille jamais plus proches (s). */
  ecartMemeFamilleSec: number;
  /** Aucune musique. */
  musique: false;
}
