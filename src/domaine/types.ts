/**
 * Modèle de données complet du Studio (PLAN B.7 + AVENANT 2 : AV2.2, AV2.3, AV2.4).
 *
 * Règles :
 * - Toutes les entités ont un `id` (chaîne) et des dates ISO 8601 (`creeLe`, `modifieLe`).
 * - Les fichiers sont toujours désignés par un `fichierId` (AV2.2-3), jamais par une URL.
 * - Les montants sont en CENTIMES avec la devise (AV2.2-9).
 * - `estDemo` repère les données de démonstration (AV2.4-7) : masquables, jamais supprimées.
 * - `marqueId` partout où un style s'applique (AV2.3-15). Une seule marque « Axion » en V1.
 *
 * Ce fichier est PUR (aucun import serveur) : il peut être importé côté client.
 */

/* ------------------------------------------------------------------ */
/* Briques de base                                                     */
/* ------------------------------------------------------------------ */

import type { SourceClaude } from "./source-claude";
import type { AccordPrix } from "./accord";
import type { PriseVoixMesuree, RapportRessemblanceVoix } from "@/briques/voix-maitre/types";
import type { EtatSite, PasseportWeb } from "./site-videos/types";
export type Id = string;
export type DateIso = string;

export type Ratio = "9:16" | "1:1" | "4:5" | "16:9";

/** Briques FACULTATIVES (AV2.7) : chaque format les déclare, chaque vidéo peut les couper. */
export type BriqueFacultative = "sous-titres" | "etalonnage" | "illustrations" | "son" | "habillage" | "texte-ecran" | "mention-ia";
export const BRIQUES_FACULTATIVES: BriqueFacultative[] = ["sous-titres", "etalonnage", "illustrations", "son", "habillage", "texte-ecran", "mention-ia"];
export const RATIOS: Ratio[] = ["9:16", "1:1", "4:5", "16:9"];

export type Devise = "EUR";
export interface Montant {
  centimes: number;
  devise: Devise;
}

export interface Horodate {
  creeLe: DateIso;
  modifieLe: DateIso;
}

export interface EntiteBase extends Horodate {
  id: Id;
  /** Donnée de démonstration (masquable via le réglage « Afficher les exemples »). */
  estDemo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Fichiers (AV2.2-3)                                                  */
/* ------------------------------------------------------------------ */

export type OrigineFichier = "depot" | "demo" | "fabrication" | "fournisseur" | "enregistrement";
export type StatutFichier = "en_attente" | "pret" | "refuse";

export interface Fichier extends EntiteBase {
  /** `studio/{env}/{type}/{entiteId}/{fichierId}.{ext}` — en V1 : chemin sous public/ (ex. `/demo/avocat-1.mp4`). */
  cleStockage: string;
  nom: string;
  mime: string;
  taille: number;
  sha256?: string;
  dureeSec?: number;
  largeur?: number;
  hauteur?: number;
  fps?: number;
  origine: OrigineFichier;
  statut: StatutFichier;
}

/* ------------------------------------------------------------------ */
/* Marque (AV2.3-15)                                                   */
/* ------------------------------------------------------------------ */

export interface Marque extends EntiteBase {
  nom: string;
  logoFichierId?: Id;
  couleurs: { nom: string; jeton: string; valeur: string }[];
  polices: { titre: string; texte: string };
  signature?: string;
}

/* ------------------------------------------------------------------ */
/* Personnages, visages, voix, prononciations                          */
/* ------------------------------------------------------------------ */

export type NaturePersonnage = "moi" | "reel" | "invente";

export interface Accord {
  /** Case « J'ai l'accord écrit de cette personne » cochée. */
  case: boolean;
  documentFichierId?: Id;
  date?: DateIso;
  /** Résumé lisible de l'accord (périmètre, durée). */
  perimetre?: string;
}

export interface Personnage extends EntiteBase {
  nom: string;
  nature: NaturePersonnage;
  role?: string;
  photoFichierId?: Id;
  /** Obligatoire et bloquant si nature = "reel" (PLAN B.4-6). */
  accord?: Accord;
  principal: boolean;
  couleurAccent?: "orange" | "sauge" | "ambre";
  /** Double proposé en premier (moteur avocat B.0 §5). Absent : le premier prêt. */
  visageParDefautId?: Id;
  /** Voix proposée en premier (moteur avocat B.0 §5). Absente : la première prête. */
  voixParDefautId?: Id;
  /**
   * Lot « intensité · crédits · calage » (02/10, D2, ajout pur) : voix par défaut PAR FORMAT (identifiant de format →
   * voix de ce personnage), ex. { avocat: "voix-avocat" }. Résolution : choix de la vidéo > ce format > `voixParDefautId`
   * > la première prête (`voixPourFormat`, `domaine/voix-format.ts`). Modifiable vidéo par vidéo.
   */
  voixParFormat?: Record<string, Id>;
  /**
   * Correcteur 4 (03/10, ajout pur) : avatar (visage principal) par défaut PAR FORMAT, ex. { avocat: "vis-costume-34" }.
   * Résolution : choix de la vidéo > ce format > `visageParDefautId` > le premier prêt (`visagePourFormat`,
   * `domaine/distribution.ts`). Absent (anciens personnages) : comportement d'avant. Modifiable vidéo par vidéo.
   */
  visageParFormat?: Record<string, Id>;
}

export type AngleVisage = "face" | "trois-quarts" | "profil";
/** `a_verifier` : prêt chez le fournisseur mais pas encore validé par Will sur un essai (look généré, B.0 §4). */
export type StatutPreparation = "brouillon" | "en_preparation" | "pret" | "a_verifier" | "echec";

export interface NoteQualiteVisage {
  note: number; // /100
  conseils: string[];
  /** Justesse des lèvres en français /100 (sous 85 : plan poitrine plafonné à 112 %, B.2). */
  levres?: number;
}

export type PostureVisage = "assis" | "debout";
/** `filme` : appris d'une vidéo de Will ; `genere` : look fabriqué depuis une image (gestes non appris) ; `photo` : premier essai. */
export type OrigineVisage = "filme" | "genere" | "photo";

export interface Visage extends EntiteBase {
  personnageId: Id;
  nom: string;
  angle: AngleVisage;
  /** Libellé affiché de la tenue (« Chemise noire »). */
  tenue: string;
  /** Tenue NORMALISÉE (identifiant stable, B.0 §3) : deux visages de même tenue la partagent. */
  tenueId?: string;
  /** Fond devant lequel le double a été filmé (le décor, lui, est posé par le studio). Ancien champ `decor`. */
  fondTournage: string;
  posture?: PostureVisage;
  origine?: OrigineVisage;
  statut: StatutPreparation;
  qualite?: NoteQualiteVisage;
  fichierIds: Id[];
  vignetteFichierId?: Id;
  /** Image détourée (PNG transparent) pour l'aperçu du plateau. */
  detoureFichierId?: Id;
  fournisseur: string;
  versionFournisseur?: string;
  /** LUT propre à ce visage (priorité plan > vidéo > visage > format, AV2.3-5). */
  lutId?: Id;
}

export interface ReglagesVoix {
  vitesse: number; // 0.5 – 1.5
  stabilite: number; // 0 – 100
  emotion: number; // 0 – 100
}

/** Type de copie de voix : HeyGen ne le renvoie pas, il est déduit des moteurs disponibles (B.0 §9). */
export type TypeClone = "instant" | "pro" | "inconnu";

export interface Voix extends EntiteBase {
  personnageId: Id;
  nom: string;
  langue: "fr-FR" | "en-US" | "es-ES";
  minutesEnregistrees: number;
  statut: StatutPreparation;
  reglages: ReglagesVoix;
  fichierIds: Id[];
  /** Fournisseur de CETTE voix (« heygen », « elevenlabs », « simulation ») : il prime sur le réglage global. */
  fournisseur: string;
  versionFournisseur?: string;
  echantillonFichierId?: Id;
  typeClone?: TypeClone;
}

export interface Prononciation extends EntiteBase {
  /** Graphie imposée à l'écran et dans les sous-titres (AV2.3-3). */
  mot: string;
  prononciation: string;
  note?: string;
  /** Rangée (jamais supprimée : ordre permanent « rien n'est purgé »). */
  archiveLe?: string;
  /* --- Ajouts purs du lot A (prononciations, `PRONONCIATIONS-SYSTEME.md`), figés par l'architecte le 02/10 --- */
  /**
   * Façon d'ÉCRIRE dans les sous-titres (n° 7) ; absente : `mot` tel quel. Exemple : mot « 35 h », écriture « 35 h »,
   * prononciation « trente-cinq heures ». `prononciation` reste la façon de DIRE (texte envoyé à la voix).
   */
  ecriture?: string;
  /** Portée (n° 8) : absente = toutes les voix ; sinon réservée à une voix ou à un personnage. */
  portee?: { voixId?: Id; personnageId?: Id };
  /** D'où vient l'entrée (n° 2, 3, 4, 10). */
  source?: SourcePrononciation;
  /** Will l'a écoutée et validée (liste de départ : « à valider à l'écoute »). */
  ecouteeLe?: DateIso;
  /** Nombre de vidéos fabriquées qui contiennent le mot (n° 5), recalculé par le service. */
  utilisations?: number;
}

/** Origine d'une prononciation : saisie, pastille du script, fiche vidéo (« Mal prononcé ? »), collage en lot, liste de départ. */
export type SourcePrononciation = "manuel" | "script" | "video" | "lot" | "depart";

/* ------------------------------------------------------------------ */
/* Bibliothèque                                                        */
/* ------------------------------------------------------------------ */

export type TypeElement =
  | "couleurs"
  | "logo"
  | "police"
  | "lut"
  | "style-sous-titres"
  | "illustration-image"
  | "illustration-video"
  | "musique"
  | "bruitage"
  | "habillage"
  | "style-montage"
  | "profil-son"
  | "decor"
  | "accessoire"
  /** Ancien type, lisible le temps de la migration vers `decor` (mode teinte). N'est plus proposé. */
  | "fond";

export type TypeLicence = "propriete" | "libre" | "abonnement" | "achat" | "generee-ia" | "a-verifier";

/** Droits et licences détaillés (AV2.3-12). */
export interface Licence {
  type: TypeLicence;
  usageCommercial: boolean;
  /** Réseaux autorisés ; vide = tous. */
  reseaux: IdReseau[];
  creditObligatoire?: string;
  expireLe?: DateIso;
  preuveFichierId?: Id;
  source?: string;
}

export type EtatLicence = "ok" | "a-verifier" | "expiree";

/** Valeurs typées selon le type d'élément (union discriminée sur `type`). */
export type ValeurElement =
  | { type: "couleurs"; couleurs: { nom: string; valeur: string }[] }
  | { type: "logo"; variante: "clair" | "sombre" | "monochrome" }
  | { type: "police"; famille: string; usage: "titre" | "texte" }
  | { type: "lut"; formatFichier: "cube"; tailleCube: number; intensiteParDefaut: number; avantFichierId?: Id; apresFichierId?: Id }
  | ValeurStyleSousTitres
  | { type: "illustration-image" | "illustration-video" }
  | { type: "musique"; ambiance: string; tempoBpm: number; dureeSec: number }
  | {
      type: "bruitage";
      categorie: "transition" | "impact" | "notification" | "ambiance";
      dureeSec: number;
      /* --- Lot « intensité · bruitages » (02/10, D1, ajouts purs) --- */
      /** Ce que le son accompagne À L'IMAGE (absent : ancien bruitage, jamais posé automatiquement). */
      declencheur?: DeclencheurBruitage;
      /** Variante (1 à 5) d'un même son : tirage sans répétition consécutive. */
      variante?: number;
      /** Écouté et validé par Will : AUCUN son n'est posé automatiquement tant qu'il est « a_verifier » (ou absent). */
      ecoute?: "a_verifier" | "validee";
      /** Sonie mesurée à l'import (LUFS), normalisée ensuite. */
      sonieLufs?: number;
    }
  | {
      type: "habillage";
      intro: boolean;
      fin: boolean;
      logoAnime: boolean;
      carteFinale?: { titre: string; appel: string };
      grandTitre: boolean;
      /** Encadré d'ouverture (format avocat : 0-3 s). */
      encadreOuverture?: { de: number; a: number };
      /** L'appel à l'action apparaît pendant la dernière phrase. */
      appelSurDernierePhrase?: boolean;
    }
  | ValeurStyleMontage
  | ValeurProfilSon
  | ValeurDecor
  | ValeurAccessoire
  | { type: "fond"; teinte: string };

/** Style des sous-titres (B.5). Les champs facultatifs viennent du moteur avocat. */
export interface ValeurStyleSousTitres {
  type: "style-sous-titres";
  police: string;
  tailleRelative: number;
  motsParLigne: number;
  casse: "normale" | "majuscules";
  animation: "aucune" | "mot-par-mot" | "pop" | "surlignage";
  couleurAccent: "orange" | "creme";
  position: "haut" | "centre" | "bas";
  /** Centre vertical de la ligne, en % de la hauteur (avocat : 48). */
  positionPct?: number;
  /** Taille en px pour une image de 1080 de large (avocat : 80). */
  taillePx?: number;
  /** Mots par ligne au minimum (avocat : 2). */
  motsParLigneMin?: number;
  /** Épaisseur NOMINALE du contour, tracé sous le remplissage (avocat : 7 → 3-4 px visibles). */
  contourPx?: number;
  ombrePx?: number;
  /** Largeur maximale d'une ligne en % ; absente = calculée depuis les zones protégées. */
  largeurMaxPct?: number;
  /** Emphase sur un mot ou sur le groupe entier. */
  modeEmphase?: "mot" | "groupe";
  /** Jeton de couleur de l'emphase (jamais une couleur en dur). */
  jetonEmphase?: string;
  dureeMinGroupeSec?: number;
  dureeMaxGroupeSec?: number;
  /** Chiffres alignés et à chasse fixe (`lnum`, `tnum`). */
  chiffresAlignes?: boolean;
  /** Lot M2 (ajout pur) : gabarit du catalogue (un seul moteur de rendu, le style est une donnée). */
  gabarit?: GabaritSousTitres;
  /**
   * Style « Encre » (tableau animé, ajout pur, essai réel du 11/10) : texte et emphase de la couleur `texte`, ni contour
   * ni ombre, police de la charte, posé sur la page `page`. Absent : couleurs de la marque et ombre du gabarit (inchangé).
   * `accent` (charte Axion du tableau « reference/3 », ajout pur) : couleur du mot mis en avant (absente : `texte`).
   */
  encre?: { texte: string; page: string; accent?: string };
  /**
   * Style nommé « Pastille Axion » (tableau « reference/3 », ajout pur, 15/10/2026 : `briques/sous-titres/pastille.ts`) :
   * le groupe dans une pastille pleine, le mot dit en orange clair. Absent : inchangé.
   */
  pastille?: "axion" | "axion-ardoise";
}

/** Style de montage (B.2). */
export interface ValeurStyleMontage {
  type: "style-montage";
  rythme: "calme" | "rythme" | "tres-rythme";
  dureePlanMoyenneSec: number;
  zooms: "aucun" | "doux" | "frequents";
  transitions: "coupe" | "fondu" | "glissement";
  bruitagesTransitions: boolean;
  dureePlanMinSec?: number;
  dureePlanMaxSec?: number;
  /** Plus long qu'un plan ne peut durer, jamais dépassé. */
  dureePlanPlafondSec?: number;
  /** Plage des plans pendant l'ouverture (6 premières secondes). */
  dureePlanOuvertureSec?: [number, number];
  /** Durée de l'ouverture serrée, en secondes. */
  ouvertureSec?: number;
  /** Une rupture forte toutes les N secondes au-delà de 30 s. */
  ruptureForteToutesLesSec?: [number, number];
  /** Écart minimal entre deux cadrages qui se suivent, en %. */
  ecartCadrageMinPct?: number;
}

/** Profil de son (B.4, B.7). */
export interface ValeurProfilSon {
  type: "profil-son";
  volumeMusique: number; // 0-100
  baisseSousVoixDb: number;
  traitementVoix: "naturel" | "radio" | "chaud" | "sec";
  densiteBruitages: "aucun" | "leger" | "rythme";
  niveauCibleLufs: number; // ex. -14
  /** Tolérance autour du niveau cible (LU). */
  toleranceLufs?: number;
  /** Crête vraie maximale (dBTP). */
  creteVraieMaxDbtp?: number;
  ecartMaxLU?: number;
  /** Élément `bruitage` du ton de pièce, posé sous la voix. */
  tonPieceId?: Id;
  tonPieceDb?: [number, number];
  passeHautHz?: number;
  ratioCompression?: number;
}

export type ModeDecor = "teinte" | "image" | "boucle";

/** Décor posé derrière le double détouré (B.0 §6). Fusion des anciens types `decor` et `fond`. */
export interface ValeurDecor {
  type: "decor";
  mode: ModeDecor;
  teinte?: string;
  imageFichierId?: Id;
  ambiance?: string;
  /** Flou du décor en px (1080 de large). */
  profondeurFlou: number;
  teinteLumiere?: string;
  directionLumiere: "gauche" | "droite" | "face";
  /** Position horizontale du sujet, 0-1. */
  positionSujet: number;
  /* --- Ajouts purs du lot M3 (catalogue des décors, `decors/CATALOGUE-DECORS.md`) --- */
  /**
   * Qui fabrique le décor (méthode hybride) : fond neutre Axion posé par le studio derrière le double détouré,
   * Look HeyGen (Will généré DANS la pièce, lumière cohérente), ou photo réelle floutée posée par le studio (repli).
   * Absent : `neutre-incruste`.
   */
  methode?: MethodeDecor;
  /** Place dans le catalogue : code (N1… R8), mis en avant (validé par Will), en réserve (jamais proposé en premier). */
  catalogue?: { code: string; ordre: number; misEnAvant?: boolean; reserve?: boolean };
  /** Décor clair (crème, mur clair) : ombre des sous-titres renforcée, sinon style Bandeau. */
  clair?: boolean;
  /** `a_verifier` : Look pas encore validé par Will sur une capture (jamais lancé sans son accord). */
  statut?: "valide" | "a_verifier";
  /** Look HeyGen par angle (Looks réalistes), une fois générés. */
  lookIdParAngle?: Partial<Record<AngleVisage, string>>;
  /** Description donnée au générateur de Looks (décors réalistes). */
  description?: string;
  /** LUT conseillées sur ce décor (noms ; fond clair : Doux ou Naturel). */
  lutsConseillees?: string[];
  /* --- Ajouts purs du lot B (décors réalistes), figés par l'architecte le 02/10 --- */
  /** Vignette du décor SUR le double de Will (jamais sur un décor vide) : calculée pour les fonds neutres, générée une fois pour les Looks. */
  vignetteDoubleFichierId?: Id;
  /** Demande de Will en une phrase (« un bureau avec une bibliothèque ») qui a produit ce décor. */
  demande?: { texte: string; le: DateIso; propositionIds?: Id[]; retenu?: boolean };
}

/** Méthode de fabrication d'un décor (`decors/CATALOGUE-DECORS.md`). */
export type MethodeDecor = "neutre-incruste" | "look-heygen" | "photo-incrustee";

/** Accessoire détouré (micro de podcast…), posé du côté où regarde l'orateur (B.3). */
export interface ValeurAccessoire {
  type: "accessoire";
  imageFichierId?: Id;
  positionParAngle: Partial<Record<AngleVisage, { x: number; y: number; largeurPct: number }>>;
  flouPx: number;
  cote: "regard";
}

export interface ElementBibliotheque extends EntiteBase {
  type: TypeElement;
  nom: string;
  motsCles: string[];
  valeur: ValeurElement;
  fichierId?: Id;
  vignetteFichierId?: Id;
  licence: Licence;
  /** Formats dont c'est le style par défaut. */
  formatsParDefaut: string[];
  marqueId: Id;
  favori?: boolean;
  /** Élément rangé (jamais supprimé : ordre permanent « rien n'est purgé »). */
  archiveLe?: string;
  /** Nombre de vidéos qui l'ont utilisé (réutilisation des illustrations, B.6 étape 0 bis). */
  utilisations?: number;
  /** Dernière vidéo qui l'a utilisé : pas de répétition à moins de 10 vidéos d'écart. */
  derniereVideoId?: Id;
  /** Rang de la dernière vidéo qui l'a utilisé (compteur des vidéos fabriquées). */
  dernierRangVideo?: number;
  /** Élément fabriqué par le studio (illustration générée et payée), réutilisable gratuitement. */
  fabrique?: boolean;
  /** Version d'un élément versionné (LUT : `lut-avocat-v1`, `v2`…). */
  version?: number;
  /* --- Ajouts purs du lot A (« Mes images », `MES-IMAGES-ORGANISATION.md`), figés par l'architecte le 02/10 --- */
  /** D'où vient une illustration : image personnelle de Will, banque gratuite, fabriquée (payée), exemple. */
  origine?: OrigineIllustration;
  /** Mes images : une seule catégorie, proposée par le modèle de vision, corrigée par Will. */
  categorieImage?: CategorieMesImages;
  /** Une ligne, proposée à l'import (recherche des illustrations). */
  description?: string;
  /** Mots-clés en anglais (requêtes des banques) ; `motsCles` reste en français. */
  motsClesEn?: string[];
  /** Point d'intérêt pour le recadrage 9:16 (0-1) ; `tientEnVertical: false` = le sujet ne tient pas en vertical. */
  cadrageVertical?: { x: number; y: number; tientEnVertical: boolean };
  /** Contrôles de confidentialité (obligatoires) : tant que `statut` ≠ `prete`, le moteur ne l'utilise pas. */
  confidentialite?: ConfidentialiteImage;
  /** Netteté, lumière, résolution : une image floue ou trop petite est signalée. */
  qualiteImage?: { note: number; nette: boolean; assezGrande: boolean; remarques: string[] };
  /** Empreinte du contenu (doublons : jamais réimportés, rien n'est supprimé). */
  empreinte?: string;
  /** Comment le fichier est arrivé. */
  importeDepuis?: "fichier" | "dossier" | "drive" | "site";
  /** Validée par Will (validation en série). */
  valideLe?: DateIso;
  /** Source axion-ia.com (03/10) : capture d'une page du site ; seules les verticales (9:16) entrent dans la cascade. */
  sourceSite?: { url: string; pageId: Id; format: FormatCaptureSite; mouvement?: "defilement" | "survol"; captureLe: DateIso };
}

export type OrigineIllustration = "personnelle" | "banque" | "fabriquee" | "exemple";

/** Les 7 catégories de « Mes images ». */
export type CategorieMesImages = "bureau" | "consoles" | "interventions" | "evenements" | "clients" | "objets" | "marque";

/** Zone sensible repérée sur une image (px de l'image d'origine). */
export interface ZoneSensible {
  type: "nom" | "email" | "numero" | "montant" | "logo-client" | "visage";
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Floutée dans le fichier utilisé par le moteur (l'original est gardé). */
  floutee: boolean;
}

export interface ConfidentialiteImage {
  statut: "a_verifier" | "prete";
  zones: ZoneSensible[];
  /** Fichier flouté (l'original reste sous `fichierId`, jamais remplacé). */
  fichierFlouteId?: Id;
  /** Visage d'un tiers : accord nécessaire, image non utilisée sans cette case. */
  accordTiers?: boolean;
  /** Catégorie Clients : accord du client. */
  accordClient?: boolean;
}

/* ------------------------------------------------------------------ */
/* Scripts (recette annotée, AV2.3-7)                                  */
/* ------------------------------------------------------------------ */

export type AnnotationSegment =
  | "angle"
  | "titreEcran"
  | "emphase"
  | "illustration"
  | "zoom"
  | "pause"
  | "role"
  | "incrustation";

/** Incrustation posée sur le torse (B.2) : un objet détouré ou un montant coloré. */
export interface Incrustation {
  type: "objet" | "montant";
  elementId?: Id;
  texte?: string;
  /** Montant : vert pour un gain, rouge pour une perte. */
  sens?: "gain" | "perte";
  /**
   * Lot « intensité » (02/10, D1, ajout pur) : apparition retardée de N secondes dans son plan, décidée par le chef
   * d'orchestre (respiration après un effet fort). Absent : dès le début du plan, comme avant.
   */
  decalageSec?: number;
}

export interface SegmentScript {
  id: Id;
  texte: string;
  angle?: AngleVisage;
  titreEcran?: string;
  /** Mots mis en valeur (sous-titres colorés). */
  emphase?: string[];
  /** Intention d'illustration (« un tribunal vide »), sert de requête au moteur. */
  intentionIllustration?: string;
  zoom?: "aucun" | "leger" | "fort";
  pauseApresSec?: number;
  /** Rôle qui parle (podcast : « hôte », « invité »). */
  role?: string;
  /** Incrustation (PV, permis, « −4 pts », « 67 000 € »). Ne se dérive plus d'`emphase`. */
  incrustation?: Incrustation;
  /* --- Générateur de scripts, lot G1a (plan v5 B.2.2, ajouts purs). `texte` = forme AFFICHÉE ; `texteDit` est calculé. --- */
  /** Qui dit ce segment. Absent : le personnage principal. `joue: true` = acteur ou double déclaré (C54). */
  intervenant?: { personnageId: Id; role: "principal" | "invite" | "voix-off" | "client"; joue?: boolean };
  /** Ce qu'on voit pendant ce segment (familles écran partagé, motion, témoignage). */
  ecran?: { type: "action" | "texte-porteur" | "capture"; description: string; accordRequis?: boolean; fichierId?: Id };
  /** Matrice « qui parle » (C32). */
  nature?: NatureSegment;
  marqueurs?: MarqueurScript[];
  preuveIds?: Id[];
  matiereIds?: Id[];
  /** Segment facultatif retenu seulement sur ce réseau (avocat : LinkedIn). */
  facultatif?: ReseauDeclinaison;
  /** Annotations de la recette (clés limitées à `recette.annotations`, C20). */
  annotations?: Record<string, unknown>;
  changementVisuel?: boolean;
  coupeCourteVoulue?: boolean;
  /** Texte cité mot pour mot depuis une matière (C32). */
  sourceTexte?: { matiereId: Id };
  /** Phrase écrite ou modifiée par Will à la relecture : contrôlée au barème « will » (les autres : « machine »). */
  ecritPar?: "will";
}

/** Tutoiement ou vouvoiement du spectateur, choisi à chaque vidéo (B.0 §15). */
export type Adresse = "tu" | "vous";

export type TypeAccroche = "erreur-commune" | "chiffre-choc" | "contre-intuitif" | "question" | "promesse";

export interface BlocScript {
  id: Id;
  /** Identifiant du bloc dans la recette du format (« accroche », « question »…). */
  blocRecette: string;
  segments: SegmentScript[];
}

export interface NoteScript {
  globale: number; // /100
  criteres: Record<string, number>; // id critère → /100
  commentaire?: string;
}

export type StatutEditorialScript = "brouillon" | "valide";

export interface Script extends EntiteBase {
  formatId: string;
  versionFormat: number;
  sujet: string;
  cible?: string;
  ton?: string;
  /** Tu ou vous (B.0 §15). Absent : la valeur de « Ma façon de parler ». */
  adresse?: Adresse;
  /** Accroche retenue : son type et sa note (apprentissage, B.9 bis). */
  accroche?: { type: TypeAccroche; note: number };
  dureeCibleSec?: number;
  version: number;
  parentId?: Id;
  blocs: BlocScript[];
  notes?: NoteScript;
  favori: boolean;
  /** Script de référence (sert d'exemple au futur générateur). */
  reference: boolean;
  statutEditorial: StatutEditorialScript;
  ideeId?: Id;
  marqueId: Id;
  /* --- Générateur de scripts, lot G1a (plan v5 B.2.2, ajouts purs) --- */
  /** Sujet auquel ce texte appartient (niveau 1). Rattaché : `statutEditorial` est DÉRIVÉ des versions par réseau (B.2.5). */
  scriptMaitreId?: Id;
  /** Qui parle : FAIT FOI. Un autre mode = un autre Script (corps distinct). Absent : `avatar`. */
  mode?: ModeDiction;
  /** Version de la recette d'écriture qui a produit ce texte. */
  versionRecette?: number;
  /** Plan validé par le code avant la prose (étape 6). */
  plan?: PlanScript;
  archiveLe?: DateIso;
  /**
   * Provenance : script créé POUR cette vidéo seule (copie assemblée d'une version, texte écrit depuis son brouillon).
   * Seule preuve qu'il peut partir avec elle à la suppression définitive ; absent (ancien script, « Mes scripts ») : gardé.
   */
  creePourVideoId?: Id;
}

/* ------------------------------------------------------------------ */
/* Vidéos, versions, plans, pistes                                     */
/* ------------------------------------------------------------------ */

/** Statut TECHNIQUE (fabrication). `maquette` = aperçu rapide (AV2.3-10). `annulee` = arrêtée par Will (« Reprendre » la remet en brouillon). */
export type StatutVideo = "brouillon" | "maquette" | "en_file" | "en_fabrication" | "prete" | "echec" | "annulee" | "archivee";
/** Statut ÉDITORIAL, distinct (AV2.4-1). */
export type EtapeEditoriale = "a_relire" | "validee" | "programmee" | "publiee";

export interface MentionIA {
  incrustee: boolean;
  position: "haut-gauche" | "haut-droite" | "bas-gauche" | "bas-droite";
  dureeSec: number; // 0 = toute la vidéo
  texte: string;
  dansLegende: boolean;
}

export interface NoteQualite {
  /** Estimation /100 tirée des alertes (ce n'est pas une mesure). */
  globale: number;
  /**
   * Audit 4.3 : anciennes sous-notes, dérivées de la note globale par des constantes (jamais mesurées). Gardées en base
   * pour les vidéos d'avant (rien n'est effacé), plus produites par le moteur avocat ni affichées.
   */
  levres?: number;
  son?: number;
  sousTitres?: number;
  realisme?: number;
  alertes: AlerteQualite[];
}

export type CodeAlerteQualite =
  | "synchronisation"
  | "niveau-sonore"
  | "debordement-sous-titres"
  | "zone-protegee"
  | "duree"
  | "licence"
  | "defaut-visuel"
  | "vitesse-lecture"
  | "montant"
  | "rythme"
  | "fin"
  | "image-noire"
  | "chevauchement"
  | "export"
  | "mention-ia"
  /** Lot « intensité » (02/10) : plafond d'une fenêtre de 3 s dépassé, ou deux effets forts en même temps. */
  | "intensite"
  /** Tableau animé (12/10) : un bruitage introuvable a été retiré, la vidéo est fabriquée sans lui. */
  | "bruitage";

export interface AlerteQualite {
  code: CodeAlerteQualite;
  gravite: "info" | "attention" | "bloquant";
  message: string;
  planId?: Id;
  reseau?: IdReseau;
}

/** Choix de distribution d'un rôle (AV2.3-8 : double OU images filmées). */
export interface Distribution {
  role: string;
  personnageId?: Id;
  source: "double" | "rush";
  /** Visage principal (angle principal). */
  visageId?: Id;
  /** Un visage par angle (B.0 §3) ; absent pour un angle = « 1 angle, effet 2 caméras par recadrage ». */
  visagesParAngle?: Partial<Record<AngleVisage, Id>>;
  /** Part du temps par angle (défaut avocat : 0,85 principal / 0,15 second). */
  repartitionAngles?: { principal: number; second: number };
  voixId?: Id;
  rushIds?: Id[];
}

export type CibleLut = "personnage" | "illustrations" | "rushs" | "decor" | "accessoire";

/** Styles choisis : identifiants d'éléments de Bibliothèque. Absents = défaut du format. */
export interface StylesChoisis {
  lutId?: Id;
  intensiteLut?: number; // 0-100
  cibleLut?: CibleLut[];
  sousTitresId?: Id;
  habillageId?: Id;
  styleMontageId?: Id;
  profilSonId?: Id;
  musiqueId?: Id;
  /** Décor posé derrière le double (ancien `fondId`, migré). */
  decorId?: Id;
  /** Accessoires (micro…) allumés pour cette vidéo. */
  accessoireIds?: Id[];
  /** Lot M2 (ajout pur) : base des sous-titres de cette vidéo (Karaoké ou Minimal). */
  sousTitresBase?: BaseSousTitres;
  /** Lot M2 (ajout pur) : intensité du mélange (Sobre, Équilibré, Très dynamique). */
  sousTitresIntensite?: IntensiteSousTitres;
  /**
   * Lot « intensité · bruitages » (02/10, D1, ajout pur) : réglage GLOBAL de la vidéo (tous les effets le consultent ;
   * les sous-titres aussi). Absent : `sousTitresIntensite`, puis le profil du format, puis « equilibre ».
   */
  intensite?: NiveauIntensite;
  /** Bruitages de la vidéo : « discrets » ou « aucun » (tuile Style). Absent : le défaut du format. */
  bruitages?: ReglageBruitages;
}

export interface Video extends EntiteBase {
  titre: string;
  sujet?: string;
  formatId: string;
  versionFormat: number;
  profilRenduVersion: number;
  marqueId: Id;
  statut: StatutVideo;
  /** Statut au moment de l'archivage : remis tel quel à la restauration. */
  statutAvantArchive?: StatutVideo;
  /** Mise à la corbeille (18/10) : la vidéo est `archivee` ET supprimée 30 jours après cette date, restaurable avant. Absent : archivée simple, jamais purgée. */
  corbeilleLe?: DateIso;
  etapeEditoriale?: EtapeEditoriale;
  dureeCibleSec: number;
  ratios: Ratio[];
  scriptId?: Id;
  distribution: Distribution[];
  entrees: Record<string, unknown>;
  reglages: Record<string, unknown>;
  styles: StylesChoisis;
  /** Son brut d'une maquette tombée en panne APRÈS la lecture de la voix (payé, déjà compté) : repris par la suivante. */
  voixMaquettePayee?: VoixBrutePayee;
  /** Briques coupées pour CETTE vidéo (AV2.7), parmi celles « active » ou « au-choix » du format. */
  briquesCoupees?: BriqueFacultative[];
  /** Briques « au choix, coupées par défaut » (mention IA) allumées pour CETTE vidéo. */
  briquesAllumees?: BriqueFacultative[];
  mentionIA: MentionIA;
  /** Tu ou vous pour CETTE vidéo (B.0 §15). */
  adresse?: Adresse;
  /** Posture voulue (assis / debout), résolue en visages par angle. */
  posture?: PostureVisage;
  noteQualite?: NoteQualite;
  coutEstime?: Montant;
  coutReel?: Montant;
  /** Version courante choisie (VersionVideo.id). */
  versionChoisieId?: Id;
  miniatureChoisieId?: Id;
  modeleId?: Id;
  serieId?: Id;
  /** Équipe 7 : numéro d'épisode dans `serieId` (une vidéo d'un sujet en série prend celui du sujet). */
  episodeSerie?: number;
  /** Équipe 7 : « Cette vidéo met en avant Axion IA » (choix de Will) ; absent : déduit du texte. */
  metEnAvantAxion?: boolean;
  ideeId?: Id;
  /** Vidéo dérivée (AV2.4-8). */
  sourceVideoId?: Id;
  /** `variante-reseau` (générateur, G6) : début et fin refaits pour un autre réseau, `sourceVideoId` = la mère. */
  typeDerive?: "extrait" | "traduction" | "autre-ratio" | "variante-accroche" | "variante-reseau";
  langue: string;
  /** Étape de l'assistant où le brouillon s'est arrêté. */
  etapeAssistant?: string;
  terminee?: DateIso;
  /**
   * Lot « crédits » (02/10, D2, ajout pur) : brouillon gardé faute de crédit, avec « lancer dès que possible » coché.
   * La boucle de fond le lance seule après la recharge (déclarée ou lue), dans l'ordre de `depuis`.
   * `moteurId` : le moteur annoncé quand Will a confirmé (correcteur R8 n° 1 ; absent sur les anciennes attentes).
   * `scriptRelu` : empreinte du texte relu dans l'assistant (brique 6) ; la relance l'exige de nouveau (absente : rien).
   */
  lancementEnAttente?: { depuis: DateIso; fournisseur: string; confirme: AccordPrix; moteurId?: string; scriptRelu?: string };
  /* --- Générateur de scripts, lot G1a (plan v5 B.2.2, ajouts purs) --- */
  /** Réseau de la version d'où vient cette vidéo. */
  reseau?: IdReseau;
  /** Version par réseau (VarianteReseau) : son état d'écriture FAIT FOI, `etapeEditoriale` n'en est qu'une copie. */
  varianteId?: Id;
}

export type StatutVersion = "maquette" | "en_fabrication" | "prete" | "echec" | "annulee";

export interface VersionVideo extends EntiteBase {
  videoId: Id;
  /** Rang de la version dans SA vidéo (affiché « V{n} »). Ne sert plus au lien suivi. */
  numero: number;
  /**
   * Numéro du lien suivi (`utm_campaign`, « 0001-CC-IG »), unique dans tout le studio (ajout pur). Absent sur les
   * anciennes versions : le lien garde alors `numero`, comme avant.
   */
  numeroSuivi?: number;
  parentVersionId?: Id;
  /** Commande figée (AV2.2-1) : permet de refaire la vidéo à l'identique. */
  commande: CommandeFabrication;
  statut: StatutVersion;
  travailId?: Id;
  coutReel?: Montant;
  choisie: boolean;
  /** Ligne de temps du montage (AV2.2-5), opaque pour les écrans. */
  projetMontage?: Record<string, unknown>;
  noteRetouche?: string;
  /** Lot « intensité » (02/10, D1, ajout pur) : courbe et dépassements, montrés sous la bande de plans. */
  rapportIntensite?: RapportIntensite;
}

export type SourceImage = "double" | "rush" | "illustration" | "motion";

export interface IllustrationPlan {
  source: "bibliotheque" | "generee-ia" | "banque" | "aucune";
  elementId?: Id;
  /** Requête issue du script. */
  requete?: string;
  /** Choix de Will : le moteur ne l'écrase JAMAIS (AV2.3-6). */
  verrouille: boolean;
  candidats: Id[];
}

export interface TexteEcran {
  texte: string;
  position: "haut" | "centre" | "bas";
  style: "grand-titre" | "etiquette" | "chiffre" | "encadre";
  /** Centre vertical en % de la hauteur (prime sur `position`). */
  positionPct?: number;
}

export interface CadragePlan {
  pointInteret: { x: number; y: number };
  zoom: number;
  /** Zoom lent : zoom en fin de plan (100 → 106 %). */
  zoomFin?: number;
  valeur?: "large" | "poitrine";
}

export interface Plan extends EntiteBase {
  videoId: Id;
  versionId: Id;
  ordre: number;
  debutSec: number;
  finSec: number;
  texte: string;
  /** Segment du script couvert : identité du plan après un redécoupage (B.2). */
  segmentId?: Id;
  personnageId?: Id;
  angle?: AngleVisage;
  sourceImage: SourceImage;
  illustration?: IllustrationPlan;
  texteEcran?: TexteEcran;
  motsEnValeur: string[];
  /** Cadrage par ratio (AV2.3-9). */
  cadrage: CadragePlan;
  transition: "coupe" | "fondu" | "glissement";
  lutId?: Id;
  vignetteFichierId?: Id;
  incrustation?: Incrustation;
  /** Illustration : index du mot de l'audio maître sur lequel elle commence (B.2, contiguïté). */
  motAncre?: number;
  /** Lot « intensité · bruitages » (02/10, D1, ajout pur) : « retirer le son » ou « ajouter un son » sur CE plan. */
  bruitage?: ChoixBruitagePlan;
}

export type TypePiste =
  | "voix"
  | "plan-double"
  | "illustration"
  | "musique"
  | "bruitage"
  | "mixage"
  | "master"
  /** Sortie des couleurs, avant l'encadré et les sous-titres (recalque gratuit). */
  | "master-sans-texte"
  /** Son de la voix, blancs raccourcis : seule source des deux angles, des sous-titres et du mixage. */
  | "audio-maitre";

/** Éléments intermédiaires conservés (AV2.2-5). */
export interface Piste extends EntiteBase {
  versionId: Id;
  type: TypePiste;
  planId?: Id;
  fichierId?: Id;
  fournisseur: string;
  cout?: Montant;
  /** Empreinte de ce qui a produit la piste (texte, voix, prononciations) : `audio-maitre` réutilisée tant qu'elle ne change pas. */
  empreinte?: string;
  /** Mots horodatés de la piste `audio-maitre`. */
  mots?: MotHorodate[];
  /**
   * Correcteur R6 (ajout pur) : les mots de la piste `audio-maitre` ne suivent qu'une estimation, et pourquoi. Gardé avec
   * la piste pour que la fabrication qui la réutilise garde l'alerte « Sous-titres approximatifs » (absent : calés).
   */
  sousTitresApproximatifs?: CauseApproximation;
  /** Lot M4 (ajout pur) : format d'image d'une piste propre à un ratio (`master-sans-texte`, recalque gratuit). */
  ratio?: Ratio;
}

export type StatutRetouche = "demandee" | "en_cours" | "faite" | "echec";

export interface Retouche extends EntiteBase {
  videoId: Id;
  versionId: Id;
  planIds: Id[];
  consigne: string;
  statut: StatutRetouche;
  versionProduiteId?: Id;
  travailId?: Id;
}

export interface Miniature extends EntiteBase {
  videoId: Id;
  fichierId: Id;
  titre: string;
  choisie: boolean;
  /** Recadrages par réseau (AV2.3-14). */
  ratio: Ratio;
  /* --- Lot R4 (miniatures réelles, 03/10, ajouts purs) --- */
  /** D'où vient l'image : calculée sur la vidéo, vignette de la vidéo (repli), ou image de démonstration. */
  origine?: "rendu" | "vignette" | "demo";
  /** Le titre est ÉCRIT sur l'image : l'aperçu ne le repose pas, et le changer refait l'image. */
  incrustee?: boolean;
  /** Instant de la vidéo retenu (la plus nette des 5 images) et mise en page (0, 1, 2) : pour refaire l'image. */
  instantSec?: number;
  variante?: number;
}

/**
 * Son brut LU (et donc payé) par la voix d'une maquette rapide qui est ensuite tombée en panne (03/10). La maquette
 * suivante le reprend au lieu de relire la voix, tant que le texte, la voix et les prononciations n'ont pas changé
 * (`empreinte`, la même que celle de l'audio maître). Sa dépense est déjà enregistrée : il n'est jamais recompté.
 */
export interface VoixBrutePayee {
  fichierCle: string;
  dureeSec: number;
  mots: MotHorodate[];
  fournisseur: string;
  caracteres: number;
  empreinte: string;
  /** Texte lu (pour le calage par un aligneur réel). */
  texte?: string;
  /** Lot R6 (ajout pur) : avant le calage (`texte` présent), la voix n'a pas horodaté ses mots : à caler. */
  motsEstimes?: boolean;
  /** Lot R6 (ajout pur) : après le calage, pourquoi les mots sont restés approximatifs (absent : ils suivent le son). */
  approximatif?: CauseApproximation;
  /** CORRECTEUR 1 — B2 : son payé pas encore rangé dans le stockage (adresse temporaire du fournisseur). */
  copieEnAttente?: { adresse: string; idDemande: string; idExterne: string };
  /** 14/10, voix de référence (ajout pur) : rapport du contrôle de ressemblance de la prise déjà retenue (repris tel quel). */
  ressemblance?: RapportRessemblanceVoix;
  /**
   * 14/10, voix de référence (ajout pur) : contrôle de ressemblance pas fini. Les lectures déjà payées et mesurées
   * (`prises`, jamais relues ni recomptées) et où reprendre : copier ou mesurer la lecture gardée ci-dessus, ou relire.
   */
  controleVoix?: { phase: "a-copier" | "a-mesurer" | "a-relire"; prises: PriseVoixMesuree[] };
  le?: DateIso;
}

/** Lot R6 : pourquoi des sous-titres ne suivent qu'une estimation : calage non relié, ou calage tenté sans succès. */
export type CauseApproximation = "non-relie" | "echec";

export interface MotHorodate {
  mot: string;
  debutSec: number;
  finSec: number;
  enValeur?: boolean;
}

export interface SegmentSousTitres {
  id: Id;
  debutSec: number;
  finSec: number;
  mots: MotHorodate[];
  /** Lot M2 (ajout pur) : style du groupe dans le mélange — la base de la vidéo, ou un accent (Impact, Bandeau). */
  style?: StyleGroupeSousTitres;
  /** Lot M2 : importance 0-3 (taille : normal, grand ×1,3, très grand ×1,8 pour Impact). */
  importance?: number;
  /** Lot M2 : index du mot souligné dans `mots`, ou null. */
  souligne?: number | null;
  /** Lot M2 : position du groupe (« auto » = calculée sur les zones protégées). */
  position?: PositionGroupeSousTitres;
  /** Lot M2 : inclinaison en degrés (Impact : ±3-5°). */
  inclinaison?: number;
  /** Lot M2 : choix de Will, jamais réécrit par le moteur. */
  verrouille?: boolean;
}

/** Lot M2 (ajout pur) : styles retenus par Will (Karaoké et Minimal en base, Impact et Bandeau en accents). */
export type GabaritSousTitres = "karaoke" | "minimal" | "impact" | "bandeau";
export type BaseSousTitres = Extract<GabaritSousTitres, "karaoke" | "minimal">;
export type StyleGroupeSousTitres = "base" | "impact" | "bandeau";
export type PositionGroupeSousTitres = "auto" | "haut" | "milieu" | "bas";
/** Intensité du mélange, par vidéo : base seule, défaut, ou accents fréquents. */
export type IntensiteSousTitres = "sobre" | "equilibre" | "tres-dynamique";

export interface SousTitres extends EntiteBase {
  videoId: Id;
  versionId: Id;
  langue: string;
  version: number;
  segments: SegmentSousTitres[];
  styleId?: Id;
}

export interface RapportQualite {
  note: number;
  verifie: { image: boolean; son: boolean; sousTitres: boolean; mentionIA: boolean; droits: boolean };
  alertes: AlerteQualite[];
  niveauSonoreLufs: number;
}

export interface Sortie extends EntiteBase {
  videoId: Id;
  versionId: Id;
  ratio: Ratio;
  reseau?: IdReseau;
  /**
   * Formats par réseau T4 (ajout seul) : réseaux pour lesquels ce fichier a été fait. Absent : fichier d'avant, ou
   * moteur qui ne le dit pas ; la publication choisit alors au format préféré du réseau, comme avant.
   */
  reseaux?: IdReseau[];
  /** T4 (ajout seul) : vrai, la fin dit « Écrivez MOT en commentaire » ; faux, fin propre ; absent : fin inconnue. */
  appelAuMot?: boolean;
  resolution: string; // « 1080x1920 »
  fichierId: Id;
  vignetteFichierId: Id;
  dureeSec: number;
  taille: number;
  rapportQualite: RapportQualite;
}

/* ------------------------------------------------------------------ */
/* Publication                                                         */
/* ------------------------------------------------------------------ */

export type IdReseau = "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube" | "youtube-shorts";

export interface TexteReseau {
  texte: string;
  motsDiese: string[];
  titre?: string; // YouTube
  /* --- Générateur de scripts, lot G1a (plan v5 B.2.2, ajouts purs) : copie des champs de la version par réseau --- */
  /**
   * « variante » : texte recopié de la version (resynchronisé par `obtenirKit`) ; « claude » : écrit par Claude par le
   * chemin de dépense de la vidéo (lot R2) ; absent : texte d'essai du rédacteur simulé.
   */
  source?: "variante" | "fournisseur" | "claude";
  varianteVersion?: number;
  /** Will l'a retouché dans le kit : jamais écrasé par une resynchronisation. */
  modifieAMain?: boolean;
  champs?: VarianteReseau["publication"];
}

export interface KitPublication extends Horodate {
  id: Id;
  videoId: Id;
  textes: Partial<Record<IdReseau, TexteReseau>>;
  /** Crédits ajoutés automatiquement (licences, AV2.3-12). */
  credits: string[];
  /** Les 5 cases « Avant de publier » (AV2.3-13). */
  avantDePublier: { image: boolean; son: boolean; sousTitres: boolean; mentionIA: boolean; droits: boolean };
  estDemo?: boolean;
  /**
   * Lot R2 : l'écriture automatique des textes par Claude a eu lieu (une seule fois par vidéo, après la première
   * fabrication). `nonEcrits` : réseaux restés en texte d'essai (échec, plafond, crédit) ; ils ne repartent que par
   * « Réécrire ».
   */
  ecritureAuto?: { le: DateIso; nonEcrits: IdReseau[] };
  /**
   * VERIF-E2E-2 (double toucher) : « Réécrire ce texte » est en cours pour ce réseau depuis cette date. Posé en base
   * avant l'appel à Claude, retiré après : un second toucher (autre onglet, page rechargée) ne paie pas un second appel.
   * Une marque plus vieille que quelques minutes (studio arrêté pendant l'écriture) est ignorée.
   */
  reecrituresEnCours?: Partial<Record<IdReseau, DateIso>>;
  /** Relecture finale G2 : jeton de celui qui a posé la marque (seul lui la lève). */
  reecrituresJetons?: Partial<Record<IdReseau, string>>;
  /** Vidéos sur le site, lot S1 : le passeport web (fabriqué une fois, retouchable). */
  passeportWeb?: PasseportWeb;
  /** Vidéos sur le site, lots S3-S4 : la case et l'état en ligne. */
  site?: EtatSite;
}

export type StatutPublication = "brouillon" | "programmee" | "publiee" | "echec";
export type ViaPublication = "buffer" | "manuel" | "simulation";

export interface StatsPublication {
  vues: number;
  likes: number;
  commentaires: number;
  partages: number;
  tauxCompletion?: number; // %
  dureeMoyenneVueSec?: number;
  /** Part des spectateurs partis dans les 3 premières secondes (%), la mesure de l'accroche. */
  tauxAbandon3s?: number;
  /** Vues engagées (YouTube). */
  vuesEngagees?: number;
  /** Partages rapportés à la portée (%). */
  partagesParPortee?: number;
}

export interface Publication extends EntiteBase {
  videoId: Id;
  sortieId?: Id;
  reseau: IdReseau;
  statut: StatutPublication;
  /** Une publication `simulation` n'est JAMAIS affichée comme programmée (AV2.4-4). */
  via: ViaPublication;
  date: DateIso;
  texte: string;
  idExterne?: string;
  urlPubliee?: string;
  erreur?: string;
  stats?: StatsPublication;
  /* --- Générateur de scripts, lot G1a (plan v5 B.2.2, ajouts purs ; `idExterne` existait déjà) --- */
  varianteId?: Id;
  /** Lien suivi propre à la version (B.5.5). */
  lienSuivi?: string;
  /** Relevés successifs (ajout seul) ; `stats` = copie du dernier. */
  releves?: { le: DateIso; jour: number; source: "saisie" | "buffer" | "api"; valeurs: StatsPublication; definitions: Record<string, string> }[];
  retention?: { seconde: number; part: number }[];
  /* --- Lot R1, Buffer réel (ajouts purs) --- */
  /**
   * Où en est l'envoi chez Buffer : « en-cours » (notée AVANT l'appel), « envoye » (Buffer a dit oui), « a-verifier »
   * (la réponse s'est perdue : on relit Buffer, on ne renvoie jamais à l'aveugle), « refuse » (Buffer a dit non),
   * « absent » (relu : Buffer n'a rien reçu, l'envoi peut être refait). Absent : publication d'avant le lot R1.
   */
  etatEnvoi?: EtatEnvoiBuffer;
  /** Compte Buffer de destination. */
  canalId?: string;
  /** Lot R1b : nom du compte visé, tel qu'affiché (« Axion-IA.com ») ; absent sur les publications d'avant. */
  canalNom?: string;
  modeBuffer?: ModeEnvoiPublication;
  /** Empreinte (vidéo, réseau, date, compte depuis R1b) : un même envoi n'est jamais fait deux fois. */
  cleEnvoi?: string;
  /** Début de l'envoi (pour relire Buffer à partir de cet instant). */
  envoiCommenceLe?: DateIso;
  /** Dernière lecture de l'état chez Buffer. */
  etatLuLe?: DateIso;
  /** Équipe 7 : vidéo « Votre marque » envoyée sur TikTok — à déclarer dans TikTok (Buffer ne sait pas le faire). */
  votreMarque?: boolean;
}

export type EtatEnvoiBuffer = "en-cours" | "envoye" | "a-verifier" | "refuse" | "absent";

/** Lot R1 : « brouillon » (défaut : Will relit et programme dans Buffer) ; « programmer » : la date du studio part telle quelle. */
export type ModeEnvoiPublication = "brouillon" | "programmer";

export interface Partage extends EntiteBase {
  videoId: Id;
  code: string;
  sortieId?: Id;
  expireLe?: DateIso;
  revoqueLe?: DateIso;
  vues: number;
  telechargementAutorise: boolean;
}

/* ------------------------------------------------------------------ */
/* Modèles, idées, séries, rushs                                       */
/* ------------------------------------------------------------------ */

export interface Modele extends EntiteBase {
  nom: string;
  formatId: string;
  versionFormat: number;
  dureeSec: number;
  ratios: Ratio[];
  distribution: Distribution[];
  stylesChoisis: StylesChoisis;
  /** Briques coupées enregistrées avec le modèle (AV2.7). */
  briquesCoupees?: BriqueFacultative[];
  briquesAllumees?: BriqueFacultative[];
  reglages: Record<string, unknown>;
  creeDepuisVideoId?: Id;
  vignetteFichierId?: Id;
  utilisations: number;
  marqueId: Id;
  /** Modèle rangé (jamais supprimé : ordre permanent « rien n'est purgé »). */
  archiveLe?: string;
}

export interface Idee extends EntiteBase {
  texte: string;
  formatSuggere?: string;
  etat: "nouvelle" | "en-script" | "en-video" | "archivee";
  scriptId?: Id;
  videoId?: Id;
  /** Générateur (G1a, ajout pur) : le sujet lancé depuis cette idée. */
  scriptMaitreId?: Id;
}

/**
 * Idée JUGÉE par le comité éditorial (lot « Idées : comité éditorial ») : une combinaison de l'Usine, ses 4 notes sur
 * 10, le verdict et un angle en une phrase. Le comité n'invente rien : l'angle est rattaché à l'idée par sa signature.
 */
export interface IdeeJugee extends EntiteBase {
  /** Signature de la combinaison de l'Usine (une idée n'est jugée qu'une fois). */
  signature: string;
  /** Texte de l'idée tel qu'envoyé au comité. */
  idee: string;
  /** Les textes de la combinaison (métier, taille, douleur…), tels que l'Usine les a rendus. */
  textes: Record<string, string>;
  /** Les codes de la combinaison, TELS QUELS (null compris) : renvoyés à `retenir` quand l'idée est écrite. */
  parts?: Record<string, string | null>;
  notes: { douleur: number; cible: number; angleDifferent: number; potentiel: number };
  /** Somme des 4 notes (sur 40), calculée par le code. */
  total: number;
  verdict: "garder" | "ecarter";
  raison: string;
  angle: string;
  /** Date du jugement. */
  date: DateIso;
  /** « lot » : API Message Batches (moitié prix) ; « direct » : appel à la demande. */
  source: "lot" | "direct";
  lotId?: string;
  /** Jugement simulé (Claude non branché) : jamais payé. */
  simule?: boolean;
  /** Idée reprise pour écrire une vidéo : sort de la réserve. */
  utiliseeLe?: DateIso;
}

export interface Serie extends EntiteBase {
  nom: string;
  /** Format de la série ; « » : tous formats (séries créées depuis Écrire, équipe 7). */
  formatId: string;
  description?: string;
  /* --- Équipe 7 (ajouts purs) --- */
  /** Dernier numéro d'épisode attribué : jamais réutilisé. Absent : le plus grand épisode connu. */
  dernierEpisode?: number;
  archiveLe?: DateIso;
}

export interface Rush extends EntiteBase {
  nom: string;
  fichierId: Id;
  personnageId?: Id;
  dureeSec: number;
  motsCles: string[];
}

/* ------------------------------------------------------------------ */
/* Travaux (AV2.2-4)                                                   */
/* ------------------------------------------------------------------ */

export type TypeTravail =
  | "fabrication"
  | "maquette"
  | "retouche"
  | "reexport"
  | "preparation-visage"
  | "preparation-voix"
  | "generation-script"
  /** Recompose seulement l'encadré et les sous-titres sur la piste `master-sans-texte` (coût nul, B.0 §20). */
  | "recalque-sous-titres";

export type StatutTravail = "en_file" | "en_cours" | "termine" | "echec" | "annule";
export type StatutEtape = "en_attente" | "en_cours" | "terminee" | "echec" | "ignoree";

export interface ErreurTravail {
  code: string;
  reessayable: boolean;
  /** Phrase simple, vouvoiement, sans jargon. */
  messagePourWill: string;
  detailTechnique?: string;
}

export interface EtapeTravail {
  cle: string;
  nom: string;
  icone: string;
  dependDe: string[];
  statut: StatutEtape;
  progression: number; // 0-100
  sortieFichierIds: Id[];
  coutReel?: Montant;
  /** Planning interne du moteur simulé (ms epoch). Ne pas afficher. */
  planifie?: { debut: number; fin: number; echecA?: number };
  erreur?: ErreurTravail;
}

export interface Travail extends EntiteBase {
  type: TypeTravail;
  cibleId: Id; // videoId, visageId, voixId, scriptId
  versionId?: Id;
  titre: string;
  etapes: EtapeTravail[];
  statut: StatutTravail;
  progression: number; // 0-100, calculée
  tentatives: number;
  cleIdempotence: string;
  fournisseurUtilise: string;
  idExterne?: string;
  erreur?: ErreurTravail;
  lotId?: Id;
  /** Paramètres propres au type de travail (ex. reexport : { ratio }). */
  parametres?: Record<string, unknown>;
  debuteLe?: DateIso;
  termineLe?: DateIso;
  /** Fin estimée (ISO) pour l'affichage « encore 12 s ». */
  finEstimee?: DateIso;
  /** Reprise automatique après une panne d'un fournisseur (lot M1b, B.9 ter). Absent : aucune panne en cours. */
  reprise?: RepriseTravail;
  /** Passe devant la file (« urgent », B.9 ter). */
  urgent?: boolean;
  /**
   * Relecture finale : suites d'une fabrication terminée pas encore faites (miniatures, textes, versions par réseau),
   * écrites dans la MÊME écriture que « terminé » ; chacune est retirée une fois faite (seules les ratées sont rejouées).
   */
  finitionAFaire?: SuiteFabrication[];
}

/** Ce qui se fait APRÈS l'écriture d'une fabrication terminée, hors verrou (appels réseau possibles). */
export type SuiteFabrication =
  /** `textes` : suite de la PREMIÈRE fabrication (lot R2) : la seule où Claude peut écrire les textes tout seul. */
  | { type: "finition"; videoId: string; titre: string; ratio: Ratio; textes?: boolean; travailId?: string }
  | { type: "generateur"; videoId: string; travailId?: string };

/** Suivi des pannes d'un fournisseur pendant un travail : 3 essais espacés, puis attente (relance toutes les 10 min, 24 h au plus). */
export interface RepriseTravail {
  /** Pannes consécutives. */
  echecs: number;
  premiereLe: DateIso;
  /** Prochain essai autorisé : la boucle ne touche pas au travail avant. */
  prochainEssai: DateIso;
  /** « En attente du fournisseur » depuis (après les 3 essais). */
  attenteDepuis?: DateIso;
  derniereErreur?: string;
  /**
   * Lot « crédits » (02/10, D2, ajout pur) : « en attente de crédit » (le fournisseur a répondu `quota`). Rien n'est
   * perdu ni repayé ; la boucle de fond reprend seule après une recharge (déclarée ou lue), dans l'ordre d'arrivée.
   */
  motif?: "panne" | "credit";
  /** Fournisseur dont le crédit manque (motif « credit »). */
  fournisseurCredit?: string;
}

/* ------------------------------------------------------------------ */
/* Coûts (AV2.2-9)                                                     */
/* ------------------------------------------------------------------ */

export interface LigneCout {
  etape: string;
  fournisseur: string;
  unite: "seconde" | "minute" | "caractere" | "image" | "appel" | "forfait";
  quantite: number;
  prixUnitaire: Montant;
  total: Montant;
  nature: "estime" | "reel";
  /**
   * Lot R2 : ligne qui ne bloque JAMAIS un lancement (textes des réseaux écrits par Claude à la fin). Comptée dans le
   * total annoncé et engagée sur le budget ; jamais dans le refus (budget, confirmation), le contrôle ni la réservation
   * des crédits. Faute de crédit le moment venu, son propre chemin garde la version d'essai.
   */
  facultative?: boolean;
}

export interface DepenseEnregistree extends EntiteBase {
  videoId?: Id;
  travailId?: Id;
  lignes: LigneCout[];
  total: Montant;
  date: DateIso;
  /** Générateur (G1a, ajout pur) : dépense d'écriture d'un sujet. */
  scriptMaitreId?: Id;
  /** Compte Claude qui a réellement répondu (absent : compte 1, comme avant). */
  sourceClaude?: SourceClaude;
}

/* ------------------------------------------------------------------ */
/* Fournisseurs : ressources et événements (AV2.2-6, AV2.2-10)         */
/* ------------------------------------------------------------------ */

export interface RessourceFournisseur extends EntiteBase {
  entite: "visage" | "voix" | "personnage";
  entiteId: Id;
  fournisseur: string;
  idExterne: string;
  versionModele?: string;
  statut: StatutPreparation;
  /** Lien vers l'accord du personnage réel (obligatoire si réel). */
  accordId?: Id;
  /** Remplacée par une ressource plus récente (nouvel enregistrement) : gardée, jamais effacée. */
  remplaceeLe?: DateIso;
}

export interface EvenementFournisseur extends EntiteBase {
  fournisseur: string;
  idEvenement: string;
  type: string;
  recuLe: DateIso;
  traite: boolean;
  charge: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Transverses                                                         */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Veille des outils (lot B, `VEILLE-DES-OUTILS.md`) — figé le 02/10     */
/* ------------------------------------------------------------------ */

/** Comment lire la dernière version d'un outil (une source par outil, vérifiée chaque jour). */
export type SourceVeille =
  | { type: "npm"; paquet: string }
  | { type: "github"; depot: string; /** Fichier surveillé en plus des versions (ex. `LICENSE.md` de Remotion : alerte rouge s'il change). */ fichiersSurveilles?: string[] }
  | { type: "page"; url: string }
  | { type: "fal"; categorie?: string }
  | { type: "anthropic" };

/** État d'une carte : à jour · nouveauté · attention (licence, prix, fonction retirée) · impossible de vérifier (jamais « à jour » par défaut). */
export type EtatVeille = "a-jour" | "nouveaute" | "attention" | "injoignable";

export interface VeilleOutil extends EntiteBase {
  nom: string;
  role: string;
  source: SourceVeille;
  /** Version qu'on utilise, lue dans le code (package.json, réglages des fournisseurs). */
  versionUtilisee?: string;
  derniereVersion?: string;
  derniereVersionLe?: DateIso;
  etat: EtatVeille;
  /** Dernière lecture (réussie ou non) et son empreinte (une page qui change = une nouveauté). */
  verifieLe?: DateIso;
  empreinte?: string;
  /** Ajouté par Will (nom + adresse) ou prévu au départ. */
  ajoutePar: "depart" | "will";
  /** Rangé, jamais supprimé. */
  archiveLe?: DateIso;
}

export type StatutNouveaute = "nouvelle" | "essayer" | "ignoree" | "appliquee";

export interface VeilleNouveaute extends EntiteBase {
  outilId: Id;
  versionVue: string;
  date: DateIso;
  lien?: string;
  /** Résumé en français simple (Claude ; simulé tant qu'aucune clé). */
  resume: { ceQueCaChange: string; interet: "fort" | "moyen" | "faible"; risque?: string };
  /** Alerte rouge : licence, prix ou fonction retirée. */
  rouge: boolean;
  /**
   * CORRECTEUR 1 — B7 : résumé fait par les règles fixes du studio, PAS par Claude. Absent sur une nouveauté plus
   * ancienne : elle l'était aussi (Claude n'a jamais résumé la veille jusque-là).
   */
  simule?: boolean;
  statut: StatutNouveaute;
  /** « Essayer » crée une tâche à faire (notification + journal), jamais une mise à jour automatique. */
  tacheCreeeLe?: DateIso;
}

/* ------------------------------------------------------------------ */
/* Source axion-ia.com (03/10) : le site de Will, lu une fois par jour   */
/* ------------------------------------------------------------------ */

/** Rubrique d'une page du site (ce qu'on en tire : matières, captures). */
export type RubriqueSite = "accueil" | "offre" | "formation" | "faq" | "a-propos" | "article" | "actualite" | "autre";

export type FormatCaptureSite = "9:16" | "16:9" | "1:1";

/**
 * Une page de axion-ia.com connue du studio : trouvée dans le plan du site, ou SUIVIE (page clé de départ ou ajoutée
 * par Will : relue chaque jour et photographiée). Identifiant tiré de l'adresse : jamais deux fois la même page.
 * Rien n'est effacé : une page retirée de la liste garde `suivie` avec `retireeLe`.
 */
export interface PageSite extends EntiteBase {
  url: string;
  rubrique: RubriqueSite;
  titre?: string;
  /** Mots-clés tirés du titre et de la description (captures, cascade des illustrations). */
  motsCles?: string[];
  /** Page suivie (relue chaque jour, photographiée). `retireeLe` : retirée par Will, gardée. */
  suivie?: { par: "depart" | "will"; depuis: DateIso; retireeLe?: DateIso };
  /** Date donnée par le plan du site (modification, ou publication d'une actualité). */
  dateSite?: string;
  /** Vue dès la première lecture : son contenu d'alors sert de point de départ (jamais proposé comme nouveau). */
  connueAuDepart?: boolean;
  luLe?: DateIso;
  /** Empreinte du contenu utile (titre + morceaux). */
  empreinte?: string;
  /** Empreintes des morceaux déjà vus : un morceau n'est jamais proposé deux fois. */
  morceauxVus?: string[];
  /** Dernier changement de contenu repéré. */
  changeeLe?: DateIso;
  matieresProposees?: number;
  /** Dernières captures : quand, sur quel contenu, quels éléments (les anciennes sont archivées, jamais effacées). */
  captures?: { faitesLe: DateIso; empreinte?: string; elementIds: Id[] };
  /** Dernière lecture ou capture en échec (réessayée le lendemain). */
  erreur?: string;
}

export type TypeNotification = "video-prete" | "echec" | "plan-a-verifier" | "visage-pret" | "voix-prete" | "budget" | "publication" | "info" | "veille" | "credit";

/**
 * Audit D, B10 : la file d'envoi (téléphone, e-mail) est PERSISTÉE sur la notification elle-même. Avant, elle vivait
 * en mémoire : un redémarrage la perdait, et un envoi raté n'était jamais retenté.
 * - `a-envoyer` : en attente (premier essai, ou réessai à partir de `prochainEssaiLe`) ;
 * - `envoyee` : reçue par au moins un canal (l'e-mail forcé, s'il est demandé) ;
 * - `ignoree` : les préférences de Will ne demandent aucun envoi (la cloche suffit) ;
 * - `sans-canal` : carte « Notifications » en simulation ou aucun canal joignable : rien ne part (écrit et éteint) ;
 * - `echec` : plus de `ESSAIS_MAX_NOTIFICATION` essais ratés (journalisé ; la cloche l'a toujours).
 */
export interface EnvoiNotification {
  statut: "a-envoyer" | "envoyee" | "ignoree" | "sans-canal" | "echec";
  essais: number;
  /** Alerte grave (lot « crédits ») : l'e-mail part aussi, quel que soit le canal choisi. */
  emailForce?: boolean;
  /** Le téléphone l'a déjà reçue : un réessai (e-mail forcé raté) ne la repousse pas. */
  pushFait?: boolean;
  prochainEssaiLe?: DateIso;
  dernierEssaiLe?: DateIso;
}

export interface Notification extends EntiteBase {
  type: TypeNotification;
  titre: string;
  message?: string;
  lien?: string;
  lue: boolean;
  /** Absent : notification d'avant la file persistée, ou jamais à envoyer (cloche seule). */
  envoi?: EnvoiNotification;
}

export interface Session extends EntiteBase {
  /** Identifiant aléatoire contenu dans le jeton signé. */
  jti: string;
  appareil: string;
  ip: string;
  resterConnecte: boolean;
  expireLe: DateIso;
  derniereActivite: DateIso;
  revoqueeLe?: DateIso;
}

export interface TentativeConnexion extends EntiteBase {
  ip: string;
  reussie: boolean;
  date: DateIso;
}

export interface Parametre extends Horodate {
  /** Clé : « budget.mensuel », « afficherExemples », « fournisseur.voix »… */
  id: string;
  valeur: unknown;
}

export interface Evenement extends EntiteBase {
  /** Journal d'activité (Réglages > Journal). */
  type: string;
  message: string;
  entite?: string;
  entiteId?: Id;
  date: DateIso;
}

/* ------------------------------------------------------------------ */
/* Contrat des moteurs (AV2.2-1) — CommandeFabrication versionnée      */
/* ------------------------------------------------------------------ */

/** Un visage résolu pour un angle (B.0 §3) : ce que le moteur doit savoir sans lire les dépôts. */
export interface VisageResolu {
  visageId: Id;
  idExterne?: string;
  /** LUT propre au visage (priorité plan > vidéo > visage > format). */
  lutIdVisage?: Id;
  /** Note des lèvres /100 (sous 85 : plan poitrine plafonné à 112 %). */
  levresNote?: number;
  origine?: OrigineVisage;
  tenueId?: string;
  posture?: PostureVisage;
  /**
   * Lot R7 (ajouts purs) : fournisseur de la ressource active du visage (« heygen », « simulation ») et statut du
   * visage au lancement. Un montage RÉEL refuse le double d'essai ou un double qui n'est pas « prêt ».
   */
  fournisseur?: string;
  statut?: StatutPreparation;
}

export interface DistributionResolue extends Distribution {
  nomPersonnage?: string;
  /** Identifiants chez les fournisseurs (RessourceFournisseur.idExterne). */
  idVisageFournisseur?: string;
  idVoixFournisseur?: string;
  reglagesVoix?: ReglagesVoix;
  /** v2 : visages résolus par angle (même tenue, même posture). */
  visagesResolus?: Partial<Record<AngleVisage, VisageResolu>>;
  /** v2 : « deux-angles », ou « un-angle » (effet 2 caméras par recadrage) s'il manque le second. */
  modeAngles?: "deux-angles" | "un-angle";
  /** v2 : fournisseur de la voix, lu sur `Voix.fournisseur` (jamais sur le réglage global). */
  fournisseurVoix?: string;
  typeClone?: TypeClone;
}

/** Style résolu : la VALEUR complète et son fichier (le moteur ne lit que la commande). */
export interface StyleResolu<V extends ValeurElement = ValeurElement> {
  id: Id;
  nom: string;
  /** v2 : valeur de l'élément (absente dans une commande v1). */
  valeur?: V;
  fichierId?: Id;
}

export interface StylesResolus {
  /** `null` = brique coupée (AV2.7) ; absent = pas de style. */
  /** `origine` (lot M4, ajout pur) : choisie par la vidéo, ou défaut du format (priorité plan > vidéo > visage > format). */
  lut?: (StyleResolu<Extract<ValeurElement, { type: "lut" }>> & { intensite: number; cible: CibleLut[]; origine?: "video" | "format" }) | null;
  sousTitres?: StyleResolu<ValeurStyleSousTitres> | null;
  habillage?: StyleResolu<Extract<ValeurElement, { type: "habillage" }>> | null;
  styleMontage?: StyleResolu<ValeurStyleMontage> | null;
  profilSon?: StyleResolu<ValeurProfilSon> | null;
  /** `null` aussi quand le format interdit la musique (avocat). */
  musique?: StyleResolu | null;
  /** v2 : décor (ancien `fond`, fusionné). */
  decor?: StyleResolu<ValeurDecor> | null;
  /** v1 seulement (lecture des commandes déjà fabriquées). */
  fond?: { id: Id; nom: string } | null;
}

/** Plan tel que transmis au moteur. */
export type PlanCommande = Pick<Plan, "id" | "ordre" | "debutSec" | "finSec" | "texte" | "sourceImage" | "illustration" | "texteEcran" | "angle"> &
  Partial<Pick<Plan, "cadrage" | "motsEnValeur" | "segmentId" | "lutId" | "incrustation" | "motAncre" | "bruitage">>;

/** Profil de réalisme figé dans la commande (grain, vignette, ambiance, B.7). */
export interface ProfilRealisme {
  /** Grain en luminance, % (3-5). */
  grainPct: number;
  vignettePct: number;
  ambiance?: string;
}

export interface CommandeFabrication {
  /** 1 : commandes déjà fabriquées (lues telles quelles par le moteur simulé). 2 : moteur avocat. */
  versionContrat: 1 | 2;
  /** v2 : moteur FIGÉ au lancement. Retouches, réexports, reprises et boucle de fond lisent `moteurId ?? format.moteur`. */
  moteurId?: string;
  videoId: Id;
  formatId: string;
  versionFormat: number;
  profilRenduVersion: number;
  /** Durée : estimée depuis le script pour un format « depuis-script », sinon la durée choisie. */
  dureeCibleSec: number;
  ratios: Ratio[];
  script: { id?: Id; blocs: BlocScript[]; texteComplet: string };
  distribution: DistributionResolue[];
  /** `null` = brique coupée (AV2.7). */
  styles: StylesResolus;
  /** État final de chaque brique facultative (true = exécutée). Le moteur saute les briques à false. */
  briques: Record<BriqueFacultative, boolean>;
  entrees: Record<string, unknown>;
  reglages: Record<string, unknown>;
  plans: PlanCommande[];
  /** `ecriture` (ajout pur du 02/10, lot A1) : graphie des sous-titres quand elle diffère de `mot`. */
  prononciations: { mot: string; prononciation: string; ecriture?: string }[];
  mentionIA: MentionIA;
  budgetMax: Montant;
  /** v2 : tu ou vous. */
  adresse?: Adresse;
  /** v2 : posture choisie. */
  posture?: PostureVisage;
  /** v2 : accessoires allumés (micro…), valeur complète. */
  accessoires?: StyleResolu<ValeurAccessoire>[];
  /** v2 : grain, vignette, ambiance. */
  profilRealisme?: ProfilRealisme;
  /** v2 : profil de rendu et recette de montage du format, figés (formats/types.ts). */
  profilRendu?: import("@/formats/types").ProfilRendu;
  recetteMontage?: import("@/formats/types").RecetteMontage;
  /** v2 : taux de conversion dollar → euro au lancement (tarifs des fournisseurs en dollars). */
  tauxUsdEur?: number;
  /**
   * L3-01 (ajout pur) : d'où vient la fabrication, FIGÉ au lancement (`OrigineLancement` de budget-mensuel.ts). « usine » :
   * chaque dépense de la commande (lancement, voix, retouche, format, relance) repasse par le budget de l'Usine. Absente :
   * Will dans le studio (défaut, inchangé).
   */
  origine?: "studio" | "usine";
  /**
   * Lot R7e (ajout pur) : réglage « Votre avatar parle dans le studio » FIGÉ au lancement (Réglages › Connexions ›
   * Double). Absent ou éteint : le studio ne fait pas parler l'avatar (rien n'est annoncé ni envoyé chez HeyGen).
   */
  renduDouble?: { allume: boolean; fond: "sans-fond" | "uni" };
  /** Pour les essais : clé d'une étape à faire échouer (moteur simulé seulement). */
  simulerEchecEtape?: string;
  /**
   * Plan facecam v4 (lot A, ajout pur) : plafond Claude du mois atteint au lancement. Le moteur face caméra sort alors la
   * vidéo en version simple (règles par défaut, modèles fixes, sans relecture Claude). Absent : plafond non atteint.
   */
  plafondClaudeAtteint?: boolean;
  construiteLe: DateIso;
  /**
   * Lot M1 (ajout pur) : piste `audio-maitre` déjà fabriquée (par la maquette), transmise par le service. Le moteur
   * la réutilise SANS la repayer si son empreinte est celle de la commande (même texte, même voix, mêmes prononciations).
   * `mots` : horodatage du texte prononcé, sur le son nettoyé.
   */
  audioMaitre?: { fichierCle: string; empreinte: string; mots: MotHorodate[]; dureeSec: number; sousTitresApproximatifs?: CauseApproximation };
  /**
   * Correcteur réel 2 (04/10, ajout pur) : rendus du double DÉJÀ PAYÉS pour cette vidéo, sur le même audio maître (même
   * texte, même voix). Le moteur les reprend sans nouvel envoi au fournisseur si les looks et le fond sont les mêmes :
   * refaire le montage ne repaie pas l'avatar. Absent : le double est rendu (et payé) comme d'habitude.
   */
  doubleDejaRendu?: DoubleDejaRendu;
  /** Lot M2 (ajout pur) : base et intensité des sous-titres, figées au lancement. */
  sousTitres?: { base: BaseSousTitres; intensite: IntensiteSousTitres };
  /**
   * Lot « intensité · bruitages » (02/10, ajout pur) : réglage global figé au lancement (`reglageIntensite`,
   * `briques/intensite/reglage.ts`). Absent (commande plus ancienne) : « equilibre », aucun bruitage.
   */
  intensite?: { niveau: NiveauIntensite; bruitages: ReglageBruitages };
  /**
   * Lot « bruitages » (02/10, ajout pur) : les sons que le moteur PEUT poser (validés par Will, réglage « discrets »),
   * résolus par le service (`bruitagesDeLaCommande`) ; leurs fichiers sont dans `medias`. Vide ou absent : aucun son.
   */
  bruitagesDisponibles?: BruitageDisponible[];
  /**
   * Lot M4 (ajout pur) : fichiers dont le montage a besoin, résolus par le service (le moteur ne lit pas les dépôts).
   * Clé : identifiant d'élément (LUT, décor, accessoire, illustration, ton de pièce) ou `visage:<id>` (image détourée).
   */
  medias?: Record<Id, MediaCommande>;
  /*
   * --- Générateur de scripts (G1a, préparés sur `generateur/prepare-moteur`, LUS depuis G6, accord de Will du 03/10) ---
   */
  /** Réseaux visés par cette fabrication (absent : `format.reseauxConseilles`). */
  reseaux?: IdReseau[];
  /**
   * Version par réseau : mère et tranches refaites (début et fin). `tranches` : la partie GARDÉE de la mère va de
   * `debutRemplaceSec` (fin de son ouverture) à `finRemplaceSec` (début de sa fin), sur des coupes.
   * G6 (ajouts purs) : `segmentsRefaits` (segments lus par la voix : ouverture et fin de la version), `mere` (ce que
   * la mère a produit, résolu par le service : le moteur ne lit pas les dépôts), `typeDerive` (réseau ou 2e ouverture).
   */
  variante?: {
    id: Id;
    code: string;
    reseau: IdReseau;
    videoMereId: Id;
    tranches: { debutRemplaceSec: number; finRemplaceSec: number };
    segmentsRefaits?: Id[];
    mere?: MereVariante;
    typeDerive?: "variante-reseau" | "variante-accroche";
  };
  /** Texte de l'encadré d'ouverture de la version (5 mots au plus). */
  encadreTexte?: string;
  /** Union la plus stricte des zones protégées des réseaux cochés (B.6.17), en % de l'image. */
  zonesProtegees?: { haut: number; bas: number; gauche: number; droite: number };
  /** Texte DIT par segment (prononciations déjà appliquées) : alors `prononciations` est vide (jamais deux applications). */
  texteDitParSegment?: string[];
  /**
   * G6 (ajout pur) : segments de l'ouverture, de la fin et facultatifs de la version (texte assemblé). La mère pose une
   * coupe à chaque frontière (raccord des versions sur une coupe) ; absent : découpage d'avant G6, inchangé.
   */
  partiesDeclinaison?: { ouverture: Id[]; fin: Id[]; facultatifs: Id[] };
  /**
   * G6b (ajout pur) : prises filmées (« je lis ») rangées par G4c, en `rush` : chaque prise couvre ses segments ; le
   * moteur les cale sur le texte (alignement forcé) puis assemble 1 corps + le début et la fin de la version.
   */
  prises?: PriseCommande[];
}

/** G6 : ce que la vidéo mère a produit (projet de montage de sa version choisie), transmis à la version par réseau. */
export interface MereVariante {
  videoId: Id;
  versionId: Id;
  /** Clé de l'audio maître de la mère (blancs raccourcis). */
  audioCle: string;
  dureeSec: number;
  /** Horodatage du texte PRONONCÉ sur l'audio maître de la mère. */
  motsPrononces: MotHorodate[];
  /** Début et fin de chaque segment du texte validé, sur l'audio maître. */
  segments: { segmentId: Id; debutSec: number; finSec: number }[];
  /** Plans de la mère (coupes). */
  plans: import("@/moteurs/types").PlanProduit[];
  /** Pistes du double de la mère par angle (lot M6), reprises pour le corps. */
  pistesDouble?: Partial<Record<AngleVisage, string>>;
}

/** G6b : une prise filmée transmise au moteur (fichier du rush, durée, segments du texte validé qu'elle couvre). */
export interface PriseCommande {
  id: Id;
  /** `version` : toute la version d'un seul tenant (séance G4c) ; sinon le corps commun, un début ou une fin. */
  partie: "corps" | "debut" | "fin" | "version";
  cle: string;
  mime: string;
  dureeSec: number;
  segmentIds: Id[];
}

/** Lot M4 : un fichier transmis au moteur (clé de stockage, type ; taille de la LUT pour un `.cube`). */
export interface MediaCommande {
  cle: string;
  mime: string;
  /** Points de la LUT (lus dans l'en-tête à l'import). */
  tailleCube?: number;
  dureeSec?: number;
}

/* ------------------------------------------------------------------ */
/* Lot « intensité · bruitages · crédits · calage » — figé le 02/10      */
/* (contrat : docs/LOT-INTENSITE-CREDITS-EXECUTION.md)                  */
/* ------------------------------------------------------------------ */

/** Réglage global d'intensité d'une vidéo (le même que celui des sous-titres du lot M2). */
export type NiveauIntensite = IntensiteSousTitres;

/** Bruitages d'une vidéo : « discrets » (défaut avocat) ou « aucun ». */
export type ReglageBruitages = "discrets" | "aucun";

/** Ce qu'un bruitage moderne accompagne À L'IMAGE (`INTENSITE-ET-BRUITAGES.md` §2). */
export type DeclencheurBruitage = "chiffre" | "document" | "telephone" | "illustration-forte" | "impact";

/** Un son de la bibliothèque que le moteur peut poser (figé dans la commande). */
export interface BruitageDisponible {
  elementId: Id;
  declencheur: DeclencheurBruitage;
  variante: number;
  dureeSec: number;
  sonieLufs?: number;
}

/** Choix d'un plan, à l'Aperçu ou après fabrication : ne refait que le mixage (gratuit, immédiat). */
export type ChoixBruitagePlan = { mode: "retire" } | { mode: "ajoute"; declencheur: DeclencheurBruitage; elementId?: Id };

/** Rapport de l'orchestrateur d'intensité (D1), gardé sur la version. */
export interface RapportIntensite {
  niveau: NiveauIntensite;
  /** Plafond d'une fenêtre glissante de 3 s (Sobre 3 · Équilibré 5 · Très dynamique 7). */
  plafond: number;
  /** Charge de la fenêtre de 3 s qui finit à `tSec`, échantillonnée toutes les 0,5 s (petite courbe de l'Aperçu). */
  courbe: { tSec: number; charge: number }[];
  /** Fenêtres au-dessus du plafond (attendu : aucune ; sinon alerte « intensite » du contrôle qualité). */
  depassements: { debutSec: number; finSec: number; charge: number }[];
  effetsGardes: number;
  effetsDecales: number;
  effetsSautes: number;
}

/** Mode de lecture du solde d'un fournisseur payant : « reel » (lu chez lui) ou « suivi » (calculé par le studio). */
export type ModeSolde = "reel" | "suivi";

/** Recharge déclarée par Will (« J'ai rechargé ») : recale le solde suivi. Jamais effacée. */
export interface RechargeCredit extends EntiteBase {
  fournisseur: string;
  /** Montant rechargé, en centimes de la devise du fournisseur. */
  centimes: number;
  devise: "USD" | "EUR";
  date: DateIso;
  /** Crédits qui expirent (fal.ai : 365 jours après l'achat) : rappel 30 jours avant. */
  expireLe?: DateIso;
  note?: string;
}

/** Montant réservé pendant une fabrication, pour que deux vidéos lancées ensemble ne dépassent pas le solde. */
export interface ReservationCredit extends EntiteBase {
  fournisseur: string;
  videoId?: Id;
  travailId?: Id;
  /** Estimation + 20 % de marge, en centimes de la devise du fournisseur. */
  centimes: number;
  devise: "USD" | "EUR";
  statut: "active" | "liberee" | "consommee";
  libereeLe?: DateIso;
}

/** Relevé d'un solde (lecture réelle ou calcul), gardé pour le rapprochement quotidien et l'historique. */
export interface ReleveSolde extends EntiteBase {
  fournisseur: string;
  mode: ModeSolde;
  /** Solde en centimes de la devise du fournisseur. */
  centimes: number;
  devise: "USD" | "EUR";
  /** Solde attendu par le studio au même moment (rapprochement : écart > 10 % = alerte « dépense inexpliquée »). */
  attenduCentimes?: number;
  luLe: DateIso;
}

/** Résultat du calage des mots sur le son (D3, WhisperX), gardé avec l'audio maître. */
export interface RapportAlignement {
  /** « aligneur » : mots recalés par WhisperX ; « voix » : horodatage du fournisseur de voix gardé (aligneur absent ou échec). */
  source: "aligneur" | "voix";
  modele?: string;
  /** Écart entre l'horodatage de la voix et celui de l'aligneur (ms) : mesure de ce que le calage a corrigé. */
  ecartMoyenMs?: number;
  ecartMaxMs?: number;
  motsNonAlignes: number;
  dureeCalculSec?: number;
}

/* ------------------------------------------------------------------ */
/* Générateur de scripts (plan v5 B.2, lot G1a) : AJOUTS PURS          */
/* Niveau 1 : le sujet (ScriptMaitre) ; niveau 2 : le texte par format  */
/* et par corps (Script) ; niveau 3 : la version par réseau            */
/* (VarianteReseau). Rien n'est effacé : versions et `archiveLe`.      */
/* ------------------------------------------------------------------ */

/** Qui parle : le double (`avatar`), Will qui lit (`teleprompteur`, « je lis »), Will qui improvise (`trame`), voix off. */
export type ModeDiction = "avatar" | "teleprompteur" | "trame" | "voix-off";
/** Les 5 réseaux d'une déclinaison. YouTube long n'est jamais une version par réseau. */
export type ReseauDeclinaison = Extract<IdReseau, "tiktok" | "instagram" | "facebook" | "linkedin" | "youtube-shorts">;
/** Sur DefinitionFormat : ouverture et fin refaites par réseau, corps refait par réseau, ou format à un seul réseau. */
export type ModeDeclinaison = "ouverture-fin" | "corps-distinct" | "aucune";
export type MarqueurScript =
  | "relance"
  | "boucle-ouverte"
  | "boucle-fermee"
  | "envoi"
  | "livraison"
  | "preuve"
  | "cta"
  | "mot-cle"
  | "emotion"
  | "exception"
  | "ancrage"
  | "solution"
  | "resultat"
  | "methode"
  /** G4 (addendum §2 bis) : la phrase qui dit ce que le problème coûte (temps, argent, risque…). */
  | "cout";
/** Matrice « qui parle » (C32). */
export type NatureSegment = "fait" | "opinion" | "emotion";
/** « But » du sujet : Faire partager (défaut) · Faire garder · Faire réagir · Rendez-vous. */
export type ObjectifSujet = "notoriete" | "sauvegarde" | "conversation" | "rendez-vous";
export type ObjectifAccroche = "envoi" | "sauvegarde" | "commentaire" | "fin-de-visionnage";
export type NiveauConscience = "ignore-le-probleme" | "connait-le-probleme" | "connait-les-solutions" | "compare-les-offres";
export type StadeCompte = "demarrage" | "etabli";
export type TypeAppel = "envoi" | "sauvegarde" | "question-expert" | "episode-suivant" | "diagnostic";
/** Arrêts gratuits, avant toute dépense (v5 : 6 valeurs). */
export type ReponseBloquante =
  | "PREUVE_MANQUANTE"
  | "ANCRAGE_MANQUANT"
  | "MATIERE_INSUFFISANTE"
  | "MATIERE_A_PRECISER"
  | "EXCEPTION_A_VALIDER"
  | "TERME_A_CONFIRMER"
  /** G4 (addendum §2 quater) : le sujet ne se rattache à aucun pilier d'Axion-IA (arrêt gratuit, étape 0). */
  | "HORS_DOMAINE";
export type TypeMatiere =
  | "anecdote-will"
  | "avis-will"
  | "cas-client"
  | "parole-dirigeant"
  | "question-recue"
  | "observation"
  | "idee-recue"
  | "etude"
  | "actualite"
  | "demonstration"
  | "limite";
export type PointDeVue = "je" | "nous-clients" | "vous" | "un-dirigeant";
/** `neutre` (v5) : repli quand aucune phrase ne porte l'émotion (C65), hors rotation. */
export type Emotion = "surprise" | "agacement" | "soulagement" | "fierte" | "inquietude-maitrisee" | "neutre";
export type SujetSensible = "juridique" | "donnees" | "financier" | "rh";
export type PlaceException = "concession-tot" | "apres-livraison" | "avant-appel" | "angle";
export type TypeAngle = "contre-pied" | "dementi" | "verdict" | "cas" | "question" | "methode" | "actualite";
export type PertinenceMatiere = "forte" | "acceptable" | "plaquee";
export type TypePublicationLinkedIn = "video-native" | "post-texte" | "document";

/** Identifiant d'un rôle de la chaîne (stratège, rédacteur, juges…), versionné ; liste fermée posée en G0/G4. */
export type IdRole = string;
/** Écart relevé par un contrôle par code (C1…C76), cité par son identifiant (B.7.2). */
export interface Violation {
  controle: string;
  message: string;
  bloquant: boolean;
  segmentIndex?: number;
  regleId?: string;
}
/** Résultat des contrôles par code d'une version (rempli en G3 ; en G1a la simulation n'en pose aucun). */
export interface ResultatControles {
  passe: boolean;
  violations: Violation[];
  versionControles: number;
  le?: DateIso;
}
/** Réponses oui/non des juges (indicatives jusqu'au calibrage G5). */
export interface VerdictsJuges {
  questions: { id: string; version: number; reponse: boolean; tirage?: number }[];
  indicatif: boolean;
}

/** Matière réelle : JAMAIS générée, toujours citée fidèlement (B.2.9). */
export interface Matiere extends EntiteBase {
  type: TypeMatiere;
  /** VERBATIM, jamais reformulé. */
  texte: string;
  /** anecdote-will : la scène au passé. */
  scene?: string;
  source: {
    origine: "rendez-vous" | "formation" | "mission" | "commentaire" | "message" | "dictee" | "lecture" | "veille" | "site";
    detail?: string;
    url?: string;
    date: DateIso;
  };
  /** OBLIGATOIRE pour cas-client et etude : les faits vivent dans la Preuve. */
  preuveId?: Id;
  /** requis : cas-client, parole-dirigeant. */
  accord?: { requis: boolean; obtenu: boolean; le?: DateIso; forme?: "ecrit" | "oral-note" };
  pilier?: string;
  motsCles: string[];
  croyanceAttribuee?: boolean;
  fichierId?: Id;
  positionDeMarque?: boolean;
  /** JAMAIS envoyés à Claude (C59). */
  nomsSensibles?: string[];
  saisiePar: "will" | "proposee-machine" | "import";
  /** « validee » d'office si saisie par Will. */
  statut: "a-confirmer" | "validee";
  perimeLe?: DateIso;
  retrait?: { le: DateIso; motif: "accord-retire" | "faux" | "dementi" | "autre"; note?: string };
  archiveLe?: DateIso;
  /** v5 : question reçue souvent (validée par Will), seule condition du mot « souvent » (n° 98). */
  frequente?: boolean;
}

/** Choix conjoint fait par le code à l'étape 0 (B.3.9) ; compte comme RÉSERVATION dans la série tant que le sujet est en écriture. */
export interface ChoixSerie {
  /** Id préfixé, ex. « AV.S3 ». */
  structure: string;
  ancrages: { matiereId: Id; type: TypeMatiere; role: "principal" | "second"; faible: boolean }[];
  pointDeVue: PointDeVue;
  emotion: Emotion;
  pilier?: string;
  poidsFamilles: Partial<Record<TypeAccroche, number>>;
  relachements: { axe: "emotion" | "point-de-vue" | "famille-accroche" | "structure" | "type-ancrage" | "part-anecdote"; regle: string }[];
  imposePar?: "will";
  modeRotation: "demarrage" | "normal";
}

export interface AccrocheFinaliste {
  id: Id;
  famille: TypeAccroche;
  objectif: ObjectifAccroche;
  dit: string;
  ecrit: string;
  vu: string;
  boucleOuverte?: string;
  preuveIds: Id[];
  matiereIds?: Id[];
  anomalie?: string;
  piege?: string;
  eliminations?: { questionId: string; reponse: boolean }[];
  noteCode: number;
  dureeDiteSec: number;
  /* v5 */
  typeAngle?: TypeAngle;
  porteAngle?: boolean;
  ouiJuge?: number;
  source?: "opus" | "adaptee-sonnet";
}

/**
 * NIVEAU 1 : le fond, centralisé, indépendant du format. Versionné, jamais effacé.
 * Écart G1a (relevé) : ce que produisent les étapes d'écriture (angle, thème, mot-clé, idées, exception, envoi, livraison,
 * accroches…) est FACULTATIF au niveau du type, parce qu'un brouillon (« sujet sans numéro ») existe avant toute écriture.
 */
export interface ScriptMaitre extends EntiteBase {
  /** Attribué sous `sousVerrou` au PREMIER APPEL PAYANT (B.2.4), jamais réutilisé ; démonstration ≥ 9000. */
  numero?: number;
  /** Unicité (numero, version). */
  version: number;
  parentId?: Id;
  /** Idées de l'usine : codes de la ligne d'où vient le sujet (signature + parts). Absent hors usine. */
  origineUsine?: { signature: string; parts: Record<string, string | null>; typeContenu: "video" | "carrousel" | "image" | "texte" | "story" };
  brief: {
    idee: string;
    /** FACULTATIVE ; devient une Matière. */
    phraseWill?: string;
    objectif: ObjectifSujet;
    niveauConscience: NiveauConscience;
    reseaux: ReseauDeclinaison[];
    /** Format du lancement en cours (un format par lancement, n° 50). */
    formatId: string;
    formatsDemandes: string[];
    /** « vous » par défaut, FIGÉ (B.0 n° 61). */
    adresseParDefaut: Adresse;
    modeParDefaut?: ModeDiction;
    cible?: string;
    pilier?: string;
    motCle?: { forme: string; source: "creator-search-insights" | "search-console" | "hypothese" };
    serieId?: Id;
    ideeId?: Id;
    matiereIdsImposees?: Id[];
    modeChoix: "rapide" | "je-choisis";
    /** « Refaire cette structure sur un autre sujet » : structure et famille d'accroche d'une vidéo qui a marché. */
    structureImposee?: string;
    familleAccroche?: string;
    /** false par défaut, jamais contrôlé. */
    mentionIA: boolean;
    /** v5 : proposé par le code, confirmé d'un toucher (n° 81). */
    sujetSensible?: SujetSensible;
  };
  choix?: ChoixSerie;
  /** v5 : 2 à 3 combinaisons transmises au stratège (n° 63). */
  combinaisonsTransmises?: ChoixSerie[];
  angle?: {
    titre: string;
    promesse: string;
    structure: string;
    sourceAngle: "brief" | "question-recue" | "parole-dirigeant" | "mot-cle-cherche" | "veille" | "matiere";
    risqueBanal: number;
    contrePied: boolean;
    quiParleConseille: "will" | "avatar";
    /* v5 */
    typeAngle?: TypeAngle;
    tests?: { enjeu: boolean; contrePiedProuvable: boolean; cible: boolean; maintenant: boolean };
    pertinences?: { matiereId: Id; pertinence: PertinenceMatiere }[];
    termePivot?: string;
    /* G4 (addendum §2 bis, « résoudre un problème douloureux ») : obligatoires pour que l'écriture parte. */
    /** Le problème réel du spectateur, en mots concrets (jamais une fonctionnalité ni un outil). */
    probleme?: string;
    /** Ce qu'il coûte : temps, argent, risque, stress, réputation (chiffré seulement si une preuve existe). */
    cout?: string;
    /** L'issue donnée : une solution, un premier geste ou un verdict utilisable tout de suite. */
    issue?: string;
    /** INTENSITÉ : « douleur » franche ou « gain » (au plus 2 sujets sur 3 en douleur, C80). La douleur reste NOMMÉE dans chaque script (C94). */
    intensite?: "douleur" | "gain" | "curiosite";
    /** G4 (§2 sexies) : forme de rupture (≈ 1 sujet sur 5). */
    rupture?: string;
  };
  /** ≤ 3 mots, contient le mot-clé. */
  theme?: string;
  motCle?: string;
  motCleSource?: "creator-search-insights" | "search-console" | "hypothese";
  emotion?: Emotion;
  pointDeVue?: PointDeVue;
  /** ≥ 1 pour écrire (C31) ; vide = brouillon « il manque une matière ». */
  ancrages: ChoixSerie["ancrages"];
  idees?: { affirmation: string; preuveIds: Id[]; matiereIds?: Id[] }[];
  appuiPrincipal?: { preuveId?: Id; matiereId?: Id };
  exception?: {
    texte: string;
    source: "matiere" | "preuve" | "proposition-machine";
    matiereId?: Id;
    preuveId?: Id;
    valideeParWill: boolean;
    /* v5 */
    place?: PlaceException;
    restreint?: number;
  };
  envoi?: { destinataire: string; phrase: string; preuveIds: Id[]; destinataireRole?: string };
  livraison?: string;
  accrochesFinalistes?: AccrocheFinaliste[];
  criteresPropres?: { id: string; texte: string; origine: "code" | "role" }[];
  manque?: {
    type: ReponseBloquante;
    etape: number;
    ceQuIlFaudrait: string;
    typeMatiereSuggere?: TypeMatiere;
    reemploiPossible?: { matiereId: Id; numeroSujet: number; ilYaJours: number }[];
  };
  dejaTraite?: { scriptMaitreId: Id; numero: number; le: DateIso }[];
  /** v5 : les deux corps et le gagnant du juge de préférence (n° 69). */
  corps?: { scriptId: Id; gagnant: boolean; preference?: { ordreAB: "A" | "B" | "egal"; ordreBA: "A" | "B" | "egal" } }[];
  rangDansSerie?: number;
  /** Équipe 7 : numéro d'épisode dans la série `brief.serieId`, attribué au rattachement. */
  episodeSerie?: number;
  /** Présent : il prime ; sinon l'état est DÉRIVÉ des versions (`etatSujet`). */
  etat?: "brouillon" | "en-ecriture" | "a-completer" | "echec" | "bloquee-modele";
  generationId?: Id;
  marqueId: Id;
  contexteAxionVersion: number;
  archiveLe?: DateIso;
}

/** Plan de script, validé par le code AVANT la prose (étape 6). Stocké sur `Script.plan`. */
export interface PlanScript {
  structure: string;
  mode: ModeDiction;
  debit: number;
  segments: {
    fonction: MarqueurScript[];
    nature: NatureSegment;
    intervenant: string;
    preuveIds: Id[];
    matiereIds: Id[];
    /** Recalculées par le code (C27) ; celles du modèle ne sont qu'une intention. */
    secondes: number;
    resume: string;
    sourceTexte?: { matiereId: Id };
    /* v5 */
    ouvre?: { id: string; question: string };
    ferme?: string;
    lien?: "cause" | "opposition" | "consequence";
    promesseId?: string;
    coupeCourteVoulue?: boolean;
    quiParle?: "will" | "double";
    situation?: "menace" | "neutre";
  }[];
  exceptionIndex: number;
  ancrageIndex: number[];
  appuiPrincipalIndex: number;
  livraisonIndex: number;
}

/** Fiche figée à la validation, jamais réécrite. Base de l'apprentissage et du tableau « variété ». */
export interface FicheCaracteristiques {
  figeeLe: DateIso;
  formatId: string;
  famille: import("@/formats/types").FamilleFormat;
  mode: ModeDiction;
  reseau: ReseauDeclinaison;
  familleAccroche: TypeAccroche;
  objectifAccroche: ObjectifAccroche;
  niveauConscience: NiveauConscience;
  objectifSujet: ObjectifSujet;
  stadeCompte: StadeCompte;
  secondesAvantAppui: number;
  theme: string;
  pilier?: string;
  structure: string;
  sourceAngle: NonNullable<ScriptMaitre["angle"]>["sourceAngle"];
  contrePied: boolean;
  dureePrevueSec: number;
  preuveChiffree: boolean;
  typePreuve?: Preuve["type"];
  preuvesCitees: { id: Id; enonce: string }[];
  typeAncrage: TypeMatiere;
  matiereIds: Id[];
  anecdoteWill: boolean;
  ancrageAvantSec: number;
  pointDeVue: PointDeVue;
  emotion: Emotion;
  exception: boolean;
  formuleException: string;
  expressionsApaisementRelance: string[];
  finSurLeFait: boolean;
  adresse: Adresse;
  appel: TypeAppel;
  texteAppel: string;
  boucle: boolean;
  intervenants: string[];
  envoiDestinataire: string;
  serie?: string;
  noteCode: number;
  image?: { doubleId?: string; fond?: string; cadrage?: string; couvertureStyle?: string; encadreStyle?: string; musique?: string };
  versionsRoles: Record<string, number>;
  versionRecette: number;
  corps: "commun" | "distinct";
  empreinteTexte: string;
  ecartEdition: number;
  dureeRelectureSec: number;
}

/** État d'ÉCRITURE d'une version ; le reste (vidéo, programmée, publiée) est CALCULÉ (`etatReseau`). */
export type EtatVariante = "a-relire" | "a-completer" | "a-reverifier" | "validee";

/** NIVEAU 3 : la version par réseau. Une version, au plus une vidéo, des publications sur SON réseau. */
export interface VarianteReseau extends EntiteBase {
  /** « 0042-AV-TT », « 0042-AV-TT-L-T » ; STABLE d'une version à l'autre (B.2.4). */
  code: string;
  scriptMaitreId: Id;
  scriptId: Id;
  formatId: string;
  reseau: ReseauDeclinaison;
  /** Unicité (code, version). La version courante d'un code = la plus haute. */
  version: number;
  parentId?: Id;
  versionRecette: number;
  /** Accroche + promesse. */
  ouverture: BlocScript[];
  /** Appel puis boucle (ordre fixe) ; l'exception reste dans le corps. */
  fin: BlocScript[];
  accrocheId: Id;
  motCle?: string;
  /** `selonObjectif: false` = appel par défaut du réseau (affiché comme tel). */
  appel: { type: TypeAppel; texte: string; selonObjectif: boolean };
  boucle: boolean;
  segmentFacultatifRetenu: boolean;
  dureeEstimeeSec: number;
  dureeReelleSec?: number;
  /** [format.ratioMaitre, ...options] ; 9:16 toujours présent. */
  ratios: Ratio[];
  /** ÉCRIT : ≤ 5 mots, mot-clé, complémentaire de la parole (C19). */
  encadre: { texte: string };
  /** v5 : second encadré facultatif, à partir de 3 s. */
  encadre2?: { texte: string; aPartirDeSec: number };
  couverture?: { texte: string; motCle: string };
  publication: {
    texte: string;
    motsDiese: string[];
    premiereLigne: string;
    sources: string[];
    commentaireEpingle?: string;
    titres?: [string, string];
    motsClesDeclares?: string[];
    motsClesBloques?: string[];
    post?: { texte: string; detailAncrage: string; forme: "texte" | "document" };
    heureProposee?: string;
    rappels: { remixDesactive?: boolean; detectionRessemblance?: boolean };
    /** RÉGLAGE FACULTATIF, false par défaut, jamais contrôlé. */
    etiquetteIAPlateforme: boolean;
    lienSuivi?: string;
    justifications: { texte: string; regleId: string }[];
    /* v5 */
    typePublication?: TypePublicationLinkedIn;
    instantCouverture?: { debutSec: number; finSec: number };
    videoAssociee?: string;
    motCleVariante?: string;
  };
  prompteur?: string;
  trame?: {
    reperes: string[];
    chiffres: string[];
    verbatim: { accroche: string; appel: string };
    casesWill: { avis?: { texte: string; matiereId?: Id }; limite: { texte: string; matiereId?: Id } };
  };
  empreinteCorps: string;
  empreinteTexte: string;
  note: NoteScript;
  controles: ResultatControles;
  verdicts?: VerdictsJuges;
  /** FIGÉE à la validation. */
  caracteristiques?: FicheCaracteristiques;
  avisWill?: {
    resultat: "valide" | "rejete";
    motifs?: ("pas-moi" | "faux" | "deja-dit" | "trop-long" | "trop-vendeur" | "autre")[];
    note?: string;
    le: DateIso;
  };
  /** « a-reverifier » s'affiche « Milieu modifié, à revoir ». */
  etat: EtatVariante;
  videoId?: Id;
  /**
   * G6 (ajout pur) : C6, C7, C10, C11 et C26 relancés sur l'horodatage RÉEL de la vidéo fabriquée (jamais bloquant :
   * la vidéo existe ; un point s'affiche « sur la vidéo »).
   */
  controlesReels?: { le: DateIso; videoId: Id; dureeSec: number; debit: number; violations: Violation[] };
  /** G6 (ajout pur) : raccord visible avec la mère, la version est fabriquée en entier (coût affiché). */
  corpsDistinct?: { raison: string; le: DateIso };
  archiveLe?: DateIso;
  /** Id du sujet dont l'archivage a archivé cette version (restaurer ne défait que ce mouvement). */
  archiveParCascade?: Id;
}

export interface Preuve extends EntiteBase {
  /** Phrase exacte autorisée (seule partie envoyée à Claude, avec les valeurs). */
  enonce: string;
  type: "chiffre-interne" | "cas-client" | "etude" | "regle-loi";
  nature: "chiffree" | "vague" | "qualitative";
  valeurs: { brut: string; normalise: number; unite?: string }[];
  formulationsAutorisees: string[];
  formulationsInterdites: string[];
  motsClesIncompatibles: string[];
  source: { titre: string; url?: string; date: DateIso; editeurOutil?: boolean };
  saisiePar: "will" | "machine" | "import";
  niveau: "prouve" | "observe" | "opinion";
  client?: { anonymise: boolean; accordEcrit: boolean; accordCapture?: boolean; accordAvantApres?: boolean; secteur?: string; lieu?: string; nomsSensibles?: string[] };
  motsCles: string[];
  pilier?: string;
  statut: "a-valider" | "validee";
  valideeLe?: DateIso;
  perimeLe?: DateIso;
  retrait?: Matiere["retrait"];
  archiveLe?: DateIso;
}

/** Contexte commun de marque, versionné ; la plus haute version validée fait foi. */
export interface ContexteAxion extends EntiteBase {
  version: number;
  /** Références vers des Matières avis-will (aucune copie). */
  positionIds: Id[];
  piliers: { id: string; nom: string; motsCles: string[] }[];
  /** Proposition de piliers (tirée de la Bible), affichée À VALIDER ; elle ne devient `piliers` qu'après Will. */
  piliersProposes?: { id: string; nom: string; motsCles: string[] }[];
  interdits: { id: string; texte: string; regex?: string; origine: string; confirmeLe?: DateIso }[];
  appelDeSerie?: { serieId: Id; texte: string; du: DateIso; au: DateIso };
  /** CHOISIE par Will, jamais générée. */
  phraseMarque?: string;
  jargonAutorise: string[];
  jargonInterdit: string[];
  promessesInterdites: string[];
  valideeParWillLe?: DateIso;
  /* v5 */
  carnetVoix: { expression: string; texteSourceId: Id; validee: boolean }[];
  termesVagues: string[];
  rolesDestinataires: string[];
}

/** Règle de plateforme datée : seule source des affirmations sur les réseaux (C37). Id fixe. */
export interface RegleDatee extends EntiteBase {
  reseau: IdReseau | "tous";
  texte: string;
  /** v5 : « hypothese » pour les choix sans source (`hyp-*`, n° 92). */
  niveau: "prouve" | "observe" | "opinion" | "hypothese";
  source: { titre: string; url?: string; date: DateIso };
  verifieeLe: DateIso;
  aRevoirLe?: DateIso;
  /** Ce que la règle change dans le studio (B.5.4, colonne « Effet »). */
  effet?: string;
  archiveLe?: DateIso;
}

/** « Textes de Will » = ExempleStyle retenus, écrits ou transcrits. */
export interface ExempleStyle extends EntiteBase {
  texte: string;
  origine: "video" | "post-dicte" | "memo" | "podcast";
  formatId?: string;
  mode?: ModeDiction;
  mots: number;
  retenu: boolean;
  archiveLe?: DateIso;
}

/**
 * Mémoire de la voix de Will : UNE phrase qu'il a modifiée à la relecture (écrite par la machine → validée par lui).
 * Ajout seul. Rien n'est envoyé à Claude : sert à extraire les tournures à éviter et préférées (`domaine/apprentissage.ts`).
 */
export interface CorrectionWill extends EntiteBase {
  phraseAvant: string;
  phraseApres: string;
  formatId: string;
  /** Date de l'enregistrement (ISO). */
  date: DateIso;
  /** Code de la version relue (« 0042-AV-TT »). */
  code?: string;
}

/** La plus haute version validée fait foi. `tutoiementObserve` n'est qu'une information (B.0 n° 61). */
export interface FicheStyle extends EntiteBase {
  version: number;
  ouvertures: string[];
  tournures: string[];
  longueurPhraseMediane: number;
  ecartTypeLongueurs: number;
  expressions: string[];
  motsBannis: string[];
  tutoiementObserve: boolean;
  notes: string;
  tireeDe: Id[];
  valideeParWillLe?: DateIso;
}

/** Tournure interdite. Id fixe « tournure-<source>-<slug> » ; une tournure archivée n'est jamais recréée. */
export interface TourneInterdite extends EntiteBase {
  motif: string;
  regex: string;
  type: "expression" | "structure";
  /** `bloquant` seule ; `grappe` à partir de 2 dans un script. */
  niveau: "bloquant" | "grappe";
  portee: "ouverture" | "partout" | "appel" | "affiche";
  raison: string;
  reformulation?: string;
  /** « plan », « oral » : catégories du calibrage du lot GR (`CALIBRAGE-ANTI-TEXTE-IA.md`), ajout G1a. */
  source: "bible" | "will" | "parcours" | "ia-fr" | "boileau" | "banc" | "plan" | "oral";
  archiveLe?: DateIso;
}

/** Séance de tournage (« je lis », « j'improvise ») : enchaîner N scripts, ranger chaque prise sous son code. */
export interface SessionTournage extends EntiteBase {
  varianteIds: Id[];
  groupes?: { libelle: string; varianteIds: Id[] }[];
  prises: { varianteId: Id; partie: "corps" | "debut" | "fin"; videoId?: Id; ratee?: boolean; le: DateIso }[];
  etat: "preparee" | "en-cours" | "terminee";
  archiveLe?: DateIso;
}

/** Journal d'une génération : PAS d'argent stocké ici (brique Crédits), pas de consignes, pas de sorties brutes. */
export interface GenerationScript extends EntiteBase {
  scriptMaitreId: Id;
  hachageContexte: string;
  reservationId?: Id;
  /** 1,50 $ + 0,70 $ par format ou corps supplémentaire (B.0 n° 50). */
  plafondUsd: number;
  /** CORRECTEUR FINAL A : appels restés sans réponse dont le pire cas a déjà relevé le plafond (à la reprise de Will). */
  appelsReleves?: string[];
  portee: "sujet" | "format-supplementaire" | "corps-supplementaire" | "retouche";
  etapes: {
    role: IdRole;
    versionConsigne: number;
    modeleDemande: string;
    modeleEffectif?: string;
    effort: string;
    appelId?: string;
    lanceLe: DateIso;
    termineLe?: DateIso;
    estimationPireCasUsd: number;
    jetons?: { entree: number; cacheLu: number; cacheEcrit: number; cacheEcrit1h?: number; sortie: number };
    resultat?: "ok" | "rejete" | "reecrit" | "preuve-manquante" | "ancrage-manquant" | "refus" | "coupe";
    sortieId?: Id;
    violations?: Violation[];
  }[];
  statut: "en-cours" | "en-pause" | "en-attente-credit" | "terminee" | "plafond-atteint" | "echec" | "bloquee-modele";
  /** G1a : génération SIMULÉE (aucun appel, aucune dépense). */
  simulee?: boolean;
  /**
   * Relecture paquet 4 (exactitude D3) : écriture LANCÉE EN ESSAI (Claude non branché au lancement). Elle reste en
   * simulation jusqu'au bout, même si Claude est relié entre-temps ; la passer en réel = la relancer (nouveau prix, accord).
   */
  essai?: boolean;
}

/** Bilan mensuel validé par Will : seule trace stockée de l'apprentissage. */
export interface BilanApprentissage extends EntiteBase {
  mois: string;
  gagnantes: { varianteId: Id; rang: number }[];
  perdantes: { varianteId: Id; rang: number }[];
  poidsFamilles?: Partial<Record<TypeAccroche, number>>;
  diagnostics: { varianteId: Id; etage: "fuite-accroche" | "falaise" | "pente"; segmentIndex?: number }[];
  /** Rubrique obligatoire « ce que je n'ai pas pu déterminer ». */
  nonDetermine: string[];
  valideLe?: DateIso;
}

/** ReferenceGagnante : type CALCULÉ à la demande, jamais stocké. */
export interface ReferenceGagnante {
  formatId: string;
  reseau: ReseauDeclinaison;
  famille: TypeAccroche;
  structure: string;
  raisonSupposee: string;
  rang: number;
  varianteId: Id;
  gagnante: boolean;
  sortLe: DateIso;
}

/* ================================================================== */
/* LOT G7a (mesure minimale, plan v5 B.8 §2) : AJOUT EN FIN DE FICHIER  */
/* ================================================================== */

/** Complète `StatsPublication` (fusion de déclarations) : la portée saisie, base du calcul partages ÷ portée. */
export interface StatsPublication {
  /** Personnes atteintes (comptes uniques). */
  portee?: number;
}

/* ================================================================== */
/* LOT G7b (mesure complète, plan v5 B.5.5, B.8 §2) : AJOUT EN FIN     */
/* ================================================================== */

/** Complète `StatsPublication` (fusion de déclarations) : visites et rendez-vous lus par le lien suivi de la version. */
export interface StatsPublication {
  /** Visiteurs du site arrivés par le lien suivi (utm_campaign = code de la version). */
  visites?: number;
  /** Parmi eux, ceux qui ont cliqué vers la prise de rendez-vous. */
  rendezVous?: number;
}

/** Correcteur réel 2 : rendus du double d'une fabrication précédente de la vidéo, réutilisables sans repayer. */
export interface DoubleDejaRendu {
  /** Empreinte et fichier de l'audio maître sur lequel ils ont été rendus. */
  empreinteAudio: string;
  audioCle: string;
  fournisseur: string;
  fond: "sans-fond" | "uni" | "decor-du-look";
  lookIds: Partial<Record<AngleVisage, string>>;
  pieces: { angle: AngleVisage; index: number; tranche: boolean; debutSec: number; finSec: number; videoCle: string; dureeSec?: number }[];
}
