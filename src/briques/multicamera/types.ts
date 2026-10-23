/**
 * BRIQUE MULTICAMÉRA — types communs (lot F4, décision de Will du 09/10). PUR.
 *
 * Une seule prise est filmée, DE FACE. Le studio fabrique avec le double HeyGen deux angles de plus, sur le MÊME son
 * (même voix, même texte, même durée) : un peu de côté, et légèrement d'en bas (contre-plongée douce). Le montage passe
 * de l'un à l'autre comme sur un plateau à trois caméras.
 */

/** Les trois « caméras » : la prise d'origine (de face) et les deux angles fabriqués. */
export type AngleMulticamera = "face" | "cote" | "contre-plongee";

/** Angles fabriqués par le double (la face est la prise filmée, jamais refaite). */
export type AngleGenere = Exclude<AngleMulticamera, "face">;

export const ANGLES_MULTICAMERA: readonly AngleMulticamera[] = ["face", "cote", "contre-plongee"];
export const ANGLES_GENERES: readonly AngleGenere[] = ["cote", "contre-plongee"];

/** Pourquoi un plan est sur cet angle (lisible dans le projet de montage, jamais affiché tel quel). */
export type RaisonAngle = "accroche" | "explication" | "phrase-forte" | "appel" | "neutre" | "repli";

/** Un plan de caméra : quelle source on montre entre deux instants (la voix, elle, ne change jamais). */
export interface PlanCamera {
  angle: AngleMulticamera;
  debutSec: number;
  finSec: number;
  raison: RaisonAngle;
  /** Index du premier et du dernier mot couverts (-1 : aucun mot, silence). */
  premierMot: number;
  dernierMot: number;
}

/**
 * Ce que le montage garde : les plans de caméra et la vidéo de chaque angle retenu. Couche AU-DESSUS des plans du
 * format (zooms, illustrations, sous-titres inchangés) : elle ne choisit que la source du visage.
 */
export interface PisteMulticamera {
  version: 1;
  plans: PlanCamera[];
  /** Clé de stockage de la vidéo de chaque angle retenu (la face = la prise d'origine). */
  sources: Partial<Record<AngleMulticamera, string>>;
  /** Angles écartés et pourquoi (phrase simple pour Will). */
  replis: { angle: AngleGenere; raison: string }[];
  /**
   * Mission H (ajout pur) : angles fabriqués par le double de SIMULATION (clés fictives). Une composition réelle ne
   * les lit jamais : la vidéo reste à une caméra. Absent : angles réels (ou face seule).
   */
  simulation?: true;
}
