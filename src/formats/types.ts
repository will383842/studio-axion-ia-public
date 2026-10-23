/**
 * Contrat d'un format vidéo (PLAN B.6.1 + AVENANT 2).
 * PUR : importable côté client et serveur. Ajouter un format = ajouter un dossier
 * src/formats/<id>/ et l'inscrire dans src/formats/index.ts. Aucun écran ne change.
 */
import type { z } from "zod";
import type { NomIcone } from "@/components/ui/Icone";
import type {
  AnnotationSegment,
  BlocScript,
  BriqueFacultative,
  Emotion,
  IdReseau,
  MarqueurScript,
  ModeDeclinaison,
  ModeDiction,
  ObjectifSujet,
  PointDeVue,
  ProfilRealisme,
  Ratio,
  TypeAppel,
  TypeMatiere,
} from "@/domaine/types";
import type { CleEtape } from "@/assistant/etapes/meta";
import type { ConseilSite, RegleChapitresWeb } from "@/domaine/site-videos/types";

export type StatutFormat = "actif" | "bientot" | "masque";
/** Type de vidéo. `temoignage` (générateur, G1a) : parole d'un client réel. Ajouter une famille = une ligne ici + un fichier dans `familles/`. */
export type FamilleFormat = "face-camera" | "conversation" | "ecran-partage" | "motion" | "ugc" | "autre" | "temoignage";
export type MiseEnPage = "plein-ecran" | "ecran-partage-haut-bas" | "ecran-partage-cote" | "incrustation" | "multi-plans";

export type TypeEntree =
  | "medias-illustration"
  | "capture-ecran"
  | "page-a-faire-defiler"
  | "produit"
  | "logo-client"
  | "musique"
  | "rushs";

export interface EntreeFormat {
  cle: TypeEntree;
  nom: string;
  aide: string;
  obligatoire: boolean;
  multiple: boolean;
  accepte: string[]; // types MIME acceptés (« image/* », « video/* », « text/uri-list »)
}

/** Couleur d'un bloc de script : NOM DE JETON (jamais une couleur en dur). */
export type CouleurBloc = "orange" | "orange-vif" | "sauge" | "ambre" | "brique" | "texte-doux";

export interface BlocRecette {
  id: string;
  nom: string;
  couleur: CouleurBloc;
  consigne: string;
  dureeCibleSec: [number, number];
  /** Peut apparaître plusieurs fois (podcast : réponse ×N). */
  repetable?: boolean;
  /** Rôle qui parle par défaut (podcast). */
  role?: string;
}

export interface RecetteScript {
  blocs: BlocRecette[];
  regles: string[];
  criteres: { id: string; nom: string; poids: number }[];
  /** Ids de scripts de référence (Script.reference = true). */
  references: string[];
  motsParSeconde: number;
  /** Annotations de montage que ce format utilise (pastilles sous chaque phrase, AV2.3-7). */
  annotations: AnnotationSegment[];
  /*
   * --- Générateur de scripts, lot G1a (plan v5 B.1, B.4.0 : ajouts purs, tous facultatifs) ---
   * Un format HÉRITE de la recette de sa famille (`formats/familles/`) et ne déclare que ses différences ;
   * `resoudreRecette(format)` fusionne (les tableaux REMPLACENT, ils ne s'additionnent pas).
   */
  /** Version de la recette d'écriture (avocat : 4), enregistrée sur `Script.versionRecette`. */
  version?: number;
  /** Famille dont la recette hérite (absente : `DefinitionFormat.famille`). */
  herite?: FamilleFormat;
  /** Débit par mode (mots/s). `motsParSeconde` reste égal au débit `avatar`. */
  debitParMode?: Partial<Record<ModeDiction, number>>;
  modeParDefaut?: ModeDiction;
  modesDiction?: ModeDiction[];
  /** Styles d'accroche permis, interdits et leurs exigences (identifiants de `TypeAccroche`, étendus en G3). */
  famillesAccroche?: { permises?: string[]; interdites?: string[]; exigences?: Record<string, string> };
  /** Structures identifiées avec le code du format (« AV.S1 »), leur enchaînement et leurs exigences. */
  structures?: StructureRecette[];
  /** Annotations jamais posées par la machine. */
  annotationsReservees?: AnnotationSegment[];
  appelsParReseau?: Partial<Record<IdReseau, TypeAppel[]>>;
  appelsParObjectif?: Partial<Record<ObjectifSujet, Partial<Record<IdReseau, TypeAppel>>>>;
  marqueursExiges?: MarqueurScript[];
  /** PLAFONDS par réseau (s), jamais des planchers (B.0 n° 49, `hyp-zones-reseau`). */
  zonesDureeParReseau?: Partial<Record<IdReseau, [number, number]>>;
  segmentsFacultatifsMax?: number;
  /** Plafonds en secondes ; `corpsIndicatifMin` n'est qu'une information. */
  ciblesSecondes?: { corpsMax: number; corpsIndicatifMin?: number; ouvertureMax?: number; appelMax?: number };
  exceptionObligatoire?: boolean;
  nombresMaxAccroche?: number;
  emotionsPermises?: Emotion[];
  pointsDeVuePermis?: PointDeVue[];
  /**
   * Écart G1a (relevé) : blocs de la recette qui forment l'OUVERTURE et la FIN d'une version par réseau ; le reste est le
   * corps commun. Nécessaire pour répartir un texte (`enregistrerScriptDuBrouillon`) sans nommer de bloc dans le central.
   */
  partiesDeclinaison?: { ouverture: string[]; fin: string[] };
}

/** Structure d'une recette (B.4.1) : ses temps dans l'ordre et ce qu'il faut de vrai pour la tenir. */
export interface StructureRecette {
  /** Préfixé du code du format : « AV.S1 ». */
  id: string;
  nom: string;
  enchainement: string[];
  exigences?: { typesAncrage?: TypeMatiere[]; appui?: ("preuve" | "observation" | "avis-will")[] };
  /** false : tirée seulement après banc partiel (S6-S9). */
  tirable?: boolean;
}

/** Description d'un champ du formulaire Réglages (généré, PLAN B.2). */
export type ChampReglage =
  | { cle: string; libelle: string; type: "choix"; options: { valeur: string; libelle: string; icone?: NomIcone }[]; aide?: string }
  | { cle: string; libelle: string; type: "interrupteur"; aide?: string }
  | { cle: string; libelle: string; type: "curseur"; min: number; max: number; pas: number; unite?: string; aide?: string }
  | { cle: string; libelle: string; type: "texte"; placeholder?: string; aide?: string };

export interface ReglagesFormat<S extends z.ZodType = z.ZodType> {
  /** Schéma zod : valide ET fournit les valeurs par défaut (`schema.parse({})`). */
  schema: S;
  champs: ChampReglage[];
}

export interface StylesParDefaut {
  lut?: string;
  intensiteLut?: number;
  sousTitres?: string;
  styleMontage?: string;
  habillage?: string;
  profilSon?: string;
  ambianceMusique?: string;
  /** Décor par défaut (ancien `fond`, fusionné dans `decor`, B.0 §6). */
  decor?: string;
}

export interface ReglesIllustrations {
  mode: "auto" | "manuel" | "aucune";
  /** Part de la durée couverte par des illustrations (%). */
  couvertureCiblePct: number;
  /** Durée d'une illustration : une valeur, ou une plage [min, max] (avocat : [1,5 ; 2,5]). */
  dureePlanSec: number | [number, number];
  sourcesAutorisees: ("bibliotheque" | "banque" | "generee-ia")[];
  affichage: "plein-ecran" | "incrustation" | "moitie";
}

export type CapaciteRequise = "voix" | "visage" | "multi-personnages" | "retouche-par-plan" | "ecran-partage" | "motion" | "rushs" | "posture" | "decor";

/**
 * Durées d'un format (B.0 §18) :
 * - « liste » (défaut) : des pastilles de durée, la vidéo garde la durée choisie ;
 * - « depuis-script » : c'est le texte qui fixe la durée (mots ÷ débit), affichée en vert / orange / « hors zone ».
 */
export type DureesFormat =
  | { mode?: "liste"; valeursSec: number[]; parDefautSec: number; extraitsCourtsSec?: number[] }
  | {
      mode: "depuis-script";
      /** Zone verte (s). */
      zoneSec: [number, number];
      /** Zone orange « un peu long » (s) ; au-delà : « hors zone », jamais bloquant. */
      zoneOrangeSec: [number, number];
      /** Cibles proposées au générateur quand il écrit à partir d'une idée. */
      ciblesGenerationSec: number[];
      cibleParDefautSec: number;
    };

/** Encadré de titre des premières secondes (format avocat, B.2). */
export interface EncadreOuverture {
  de: number;
  a: number;
  fond: "blanc";
  police: string;
  taillePx: [number, number];
  rayonPx: [number, number];
  largeurMaxPct: number;
  /** Valeur de départ, recalculée depuis les zones protégées. */
  centrePct: number;
  ecartSousSousTitresPx: number;
  motsMax: number;
  lignesMax: number;
  caracteresAlerte: number;
  lignes: ("theme" | "accroche")[];
}

/** Export propre au format (prioritaire sur le registre des réseaux, B.0 §12). */
export interface ExportFormat {
  fps: number;
  debitMbpsMin: number;
  debitMbpsMax?: number;
  audio: { codec: "aac"; kbps: number; hz: number };
  /** Étiquettes couleur du fichier. */
  couleur?: "bt709";
}

/**
 * PROFIL DE RENDU (B.0 §8) : compose les éléments de Bibliothèque du style par défaut (par identifiant,
 * jamais par copie), plus l'export et l'encadré. Figé dans la commande à chaque fabrication.
 */
export interface ProfilRendu {
  version: number;
  sousTitresId?: string;
  styleMontageId?: string;
  habillageId?: string;
  profilSonId?: string;
  lutId?: string;
  decorId?: string;
  export?: ExportFormat;
  encadreOuverture?: EncadreOuverture;
  /** Grain, vignette et ambiance (B.7), figés dans la commande (`profilRealisme`). */
  realisme?: ProfilRealisme;
  /** Lot M2 (ajout pur) : base des sous-titres du format (absente : Karaoké) et intensité (absente : Équilibré). */
  sousTitresBase?: import("@/domaine/types").BaseSousTitres;
  sousTitresIntensite?: import("@/domaine/types").IntensiteSousTitres;
  /**
   * Lot « intensité · bruitages » (02/10, D1, ajouts purs) : intensité GLOBALE par défaut du format (absente :
   * `sousTitresIntensite`, puis Équilibré) et bruitages par défaut (absents : aucun ; avocat : « discrets »).
   */
  intensite?: import("@/domaine/types").NiveauIntensite;
  bruitages?: import("@/domaine/types").ReglageBruitages;
}

/** RECETTE DE MONTAGE (B.2, B.3, B.4) : règles chiffrées que le moteur applique. Figée dans la commande. */
export interface RecetteMontage {
  version: number;
  angles: { principal: "trois-quarts" | "face"; second?: "trois-quarts" | "face"; repartitionParDefaut: { principal: number; second: number }; secondJamaisDeuxFoisDeSuite: boolean; secondJamaisSurAccroche: boolean };
  cadrages: {
    largePct: number;
    poitrinePct: [number, number];
    poitrineParDefautPct: number;
    seuilLevres: number;
    poitrinePlafondLevresFaiblesPct: number;
    zoomLentPct: [number, number];
    zoomLentApresSec: number;
    /**
     * Correcteur réel 2 (04/10) : sujet filmé EN PIED (tête aux chaussures, visage petit) : plan large ≈ mi-cuisse,
     * poitrine, serré sur le visage (emphase), centrés sur le haut du corps. Absent : valeurs par défaut du moteur.
     */
    enPied?: { largePct: number; poitrinePct: number; serrePct: number; poitrineLevresFaiblesPct: number; pointInteretY: number };
  };
  coupes: { premiereAvantSec: number; auMoinsAvant5s: number; pauseMinMs: number; blancForceCoupeMs: number; finApresDernierMotSec: [number, number]; /** Correcteur réel 2 : option « fin en boucle » (ancienne fin courte). */ finBoucleSec?: [number, number] };
  illustrations: { couverturePct: number; dureeSec: [number, number]; jamaisDeuxDeSuite: boolean; pasDansDernieresSec: number; ouvertureMaxSec: number; visageAvantSec: number; ancrageMotSec: [number, number] };
  nettoyageBlancs: { seuilMs: number; cibleMs: [number, number]; fonduMs: [number, number]; respirationMs: [number, number]; teteMaxMs: number };
  /** Consigne de gestes HeyGen par angle (`motion_prompt`). */
  motionPrompt: Partial<Record<"trois-quarts" | "face", string>>;
}

export interface ExempleFormat {
  titre: string;
  vignette: string; // chemin public (/demo/…)
  video: string;
  ratio: Ratio;
}

export interface DefinitionFormat {
  id: string;
  /** Version du format (AV2.2-8), enregistrée sur Video, Modele et Script. */
  version: number;
  nom: string;
  /** Libellé court (pastilles, onglets, filtres) : « Type avocat », « Podcast », « UGC »… Jamais coupé à la main. */
  nomCourt: string;
  /** Une ligne, affichée sous le nom. */
  accroche: string;
  /** Présentation courte (fiche du format). */
  description: string;
  icone: NomIcone;
  statut: StatutFormat;
  /**
   * Format « actif » mais en essai chez Will SEUL (17/10/2026) : absent des grilles, menus, idées et listes de formats
   * (`listerFormats`, `listerFormatsActifs`), sa page reste joignable par son adresse et le lancement exige l'accord d'essai de Will.
   * Essai réel (17/10) : montré dans la grille « Nouvelle vidéo » et le menu latéral de l'interface connectée (session de Will),
   * avec une pastille « Essai », jamais grisé (`listerFormats({ inclureReservesAWill: true })`, `listerFormatsAvecCompteurs`).
   */
  reserveAWill?: boolean;
  famille: FamilleFormat;
  durees: DureesFormat;
  /** Le premier = par défaut. */
  ratios: Ratio[];
  /** Ratio de composition de référence (AV2.3-9). */
  ratioMaitre: Ratio;
  miseEnPage: MiseEnPage;
  miseEnPageParRatio: Partial<Record<Ratio, MiseEnPage>>;
  personnages: { min: number; max: number; roles?: string[]; sources: ("double" | "rush")[] };
  entrees: EntreeFormat[];
  etapes: CleEtape[];
  reglages: ReglagesFormat;
  recetteScript: RecetteScript;
  stylesParDefaut: StylesParDefaut;
  /**
   * Briques facultatives (AV2.7) : "active" (par défaut allumée, coupable), "au-choix" (interrupteur à l'étape Réglages,
   * allumée par défaut), "au-choix-coupee" (interrupteur, COUPÉE par défaut : la mention IA, décision de Will du 01/10),
   * "desactivee" (jamais exécutée). Absente = "desactivee". Un format peut n'en avoir AUCUNE (« Vidéo brute »).
   */
  briques: Partial<Record<BriqueFacultative, EtatBrique>>;
  illustrations: ReglesIllustrations;
  /** Titre à l'écran : fixe en haut (ancien avocat), ou encadré d'ouverture (avocat v2, B.2). */
  accrocheVisuelle?: { titreFixe: boolean; position?: "haut" | "centre"; encadreOuverture?: EncadreOuverture };
  /** « interdite » : aucune musique, quoi que dise la vidéo ou le modèle (avocat, B.7). Absente = autorisée. */
  musique?: "autorisee" | "interdite";
  /** Export propre au format, prioritaire sur le registre des réseaux (B.0 §12). */
  export?: ExportFormat;
  profilRendu?: ProfilRendu;
  recetteMontage?: RecetteMontage;
  capacitesRequises: CapaciteRequise[];
  /** Clé du registre des moteurs (src/moteurs). */
  moteur: string;
  reseauxConseilles: IdReseau[];
  exemples: ExempleFormat[];
  /** « Ce qu'il faudra fournir » (fiche d'un format « bientôt »). */
  aFournir: string[];
  /** Fait passer des réglages d'une ancienne version du format à la version courante. */
  migrerReglages?: (reglages: Record<string, unknown>, depuisVersion: number) => Record<string, unknown>;
  /** Fait passer les blocs d'un script d'une ancienne recette à la recette courante, SANS perdre de texte (B.9 bis). */
  migrerScript?: (blocs: BlocScript[], depuisVersion: number) => BlocScript[];
  /*
   * --- Générateur de scripts, lot G1a (plan v5 B.2.2) ---
   * Obligatoires (branche `generateur/prepare-moteur`, sur accord de Will) : chaque format pose son code (identique à
   * `registre-codes.ts`, un test le vérifie) et sa déclinaison.
   */
  /** Code de classement (2-3 lettres), identique au registre `registre-codes.ts`, jamais réattribué. */
  codeClassement: string;
  declinaison: ModeDeclinaison;
  /** 3 à 7 vidéos modèles analysées (B.4.0 ; ≠ `exemples`, qui sont des vidéos de démonstration). */
  videosModeles?: { url: string; analyse: string }[];
  /*
   * --- Format face caméra, lot A (plan facecam v4, ajouts purs, tous facultatifs : absents, rien ne change) ---
   */
  /**
   * Aucun prix montré nulle part (facecam) : `estimer()` du moteur rend 0, l'accord de prix est donné d'office, et les
   * blocs Coût, « Confirmer ce prix » et le montant d'une modification sont masqués. Restent le total du mois et le
   * plafond, dans Réglages.
   */
  sansPrix?: boolean;
  /** Taille maximale d'une prise envoyée pour ce format, en octets (absente : 4 Go, la règle commune). */
  tailleMaxEnvoiOctets?: number;
  /*
   * --- Organisation du studio, ORG-02 (plan 01 § 4, ajouts purs, tous facultatifs : absents, rien ne change) ---
   */
  /** Pièces communes que le format demande, par identifiant (« nom/version ») : déclaration, jamais un appel en dur. */
  pieces?: PiecesFormat;
  /** Ce que l'écran d'une vidéo du format affiche ou masque. */
  ecranVideo?: EcranVideoFormat;
  /*
   * --- Vidéos sur le site (lot S1, ajouts purs) ---
   */
  /** Conseil « aller sur le site » (plan site-videos § 1) ; la décision est le réglage `siteGenerateurs.<id>`. Absent : « non ». */
  site?: ConseilSite;
  /** Découpage des chapitres web. Absent : un chapitre par bloc de la recette. */
  chapitresWeb?: RegleChapitresWeb;
  /** Page où commence une nouvelle vidéo de ce format. Absente : `/nouvelle/<id>`. */
  adresseCreation?: string;
  /** Fiche d'une vidéo du format ; `{id}` est remplacé par son identifiant. Absente : `/videos/{id}`. */
  adresseFiche?: string;
  /**
   * Format `masque` pour le générateur de scripts, « Écrire » et la bibliothèque, mais montré dans la navigation
   * comme un format en essai.
   */
  ouvertDansLaNavigation?: boolean;
}

export interface PiecesFormat {
  /** Habillage (« charte-video/1 »). */
  habillage?: string;
  /** Stylo et ses gestes (« crayon/1 »). */
  stylo?: string;
  dessins?: boolean;
  /** Déclencheurs de sons demandés. */
  sons?: string[];
  fin?: "appels" | "aucune";
  voix?: "voix-maitre" | "prise-filmee";
  rendu?: "une-passe" | "par-scenes";
  controleImage?: boolean;
}

export interface EcranVideoFormat {
  /** Remplace les `formatId === "facecam"` de la fiche vidéo. */
  attente?: "generique" | "facecam";
  /** « operations » masque le bloc générique « Demander une modification ». */
  retouche?: "operations" | "aucune";
  monteur?: boolean;
  /** Reprend `sansPrix`. */
  coutsVisibles?: boolean;
  /** « aucune » retire l'onglet de publication et la barre « Publier » ; absent = générique. */
  publication?: "generique" | "aucune";
}

export type EtatBrique = "active" | "desactivee" | "au-choix" | "au-choix-coupee";
