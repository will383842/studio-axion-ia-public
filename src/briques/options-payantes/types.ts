/**
 * OPTIONS PAYANTES (lot J, décision de Will du 09/10). PUR.
 *
 * Le format face caméra n'affiche aucun prix, avec UNE exception : chaque fois qu'une option payante est demandée, le
 * studio prévient AVANT de dépenser (« Option payante — environ X € pris sur vos crédits <outil>. [Confirmer]
 * [Annuler] »). Sans confirmation, l'option n'est pas faite et la version gratuite sort.
 */

/** Les options qui dépensent de l'argent chez un fournisseur extérieur. */
/** Lot K : `effet-realiste-ia` = « Effet réaliste par IA » demandé au monteur (Higgsfield, un passage de 3 à 8 s). */
export type IdOptionPayante = "decor-ia" | "effets-main-ultra" | "multicamera-avocat" | "multicamera-facecam" | "effet-realiste-ia";

/** L'outil dont les crédits sont pris. */
export type OutilPayant = "higgsfield" | "heygen";

/** D'où vient la demande : la fabrication (option allumée), le fil du monteur, ou Réglages (allumer l'option). */
export type OrigineDemande = "fabrication" | "monteur" | "reglages";

/** Ce qu'il faut savoir de la vidéo pour estimer le coût. */
export interface ContexteOption {
  videoId: string;
  /** Version sur laquelle la demande est faite (la confirmation crée une nouvelle version à partir d'elle). */
  versionId: string;
  /** Durée utile de la vidéo (secondes). */
  dureeSec: number;
  /** Durées des passages à retoucher (décor, effets main) ; absent : toute la vidéo d'un seul tenant. */
  passagesSec?: number[];
  /** Modèle Higgsfield (décor, ultra réaliste). */
  modele?: "flux_3_video_edit" | "kling_video_edit";
  /** Nombre d'angles fabriqués (multicaméra) ; défaut 2. */
  angles?: number;
}

/** Tarifs servant au devis (réglables côté serveur). */
export interface Tarifs {
  /** Prix d'un crédit Higgsfield, en centimes d'euro. */
  prixCreditHiggsfieldCentimes: number;
  /** Taux dollar → euro du studio (HeyGen facture en dollars). */
  tauxUsdEur: number;
}

export type EtatDemande = "en-attente" | "confirmee" | "annulee" | "utilisee" | "expiree";

/** Une demande de confirmation, liée à UNE option, UNE vidéo et UNE version. */
export interface DemandeConfirmation {
  /** Jeton à usage unique (secret) : ce qui autorise, une seule fois, l'appel payant. */
  jeton: string;
  optionId: IdOptionPayante;
  outil: OutilPayant;
  libelle: string;
  videoId: string;
  /** Version sur laquelle la demande a été faite. */
  versionOrigineId: string;
  /**
   * Vérif V4 : la version lancée par « Confirmer » ; posée, seule CETTE version peut utiliser la confirmation (une
   * version suivante qui recopie le jeton est refusée, même s'il n'a pas encore servi).
   */
  versionCibleId?: string;
  /** Version qui a consommé la confirmation (posée à l'usage). */
  versionId?: string;
  /** Estimation (centimes d'euro). Montrée UNIQUEMENT dans la carte de confirmation. */
  montantCentimes: number;
  etat: EtatDemande;
  origine: OrigineDemande;
  /** Message dit au monteur qui a déclenché la demande (fil). */
  message?: string;
  /**
   * Lot K (facultatif) : ce que l'option fera, préparé AVANT la carte (effet réaliste : moment choisi, consigne vidéo,
   * durée, modèle). Repris tel quel à la confirmation ; jamais montré comme un prix.
   */
  details?: Record<string, unknown>;
  creeLe: string;
  expireLe: string;
  traiteeLe?: string;
}
