/**
 * Contrat des contrôles par code (plan v5 B.7.2, lot G3). PUR.
 *
 * Une version à contrôler arrive avec TOUT ce qu'il faut pour la juger, en données : ses blocs assemblés (ouverture,
 * corps, fin), le registre des preuves et des matières, la recette résolue (rôles des blocs, plafonds, annotations,
 * structures), les règles du réseau (zone, mots-dièse, appels permis) et le contexte de Will (interdits, rôles
 * destinataires, termes vagues). Les contrôles ne lisent RIEN d'autre : aucun nom de format ni de réseau n'est écrit ici.
 */
import type {
  AccrocheFinaliste,
  Adresse,
  AnnotationSegment,
  BlocScript,
  DateIso,
  Emotion,
  Id,
  Matiere,
  ModeDiction,
  ObjectifSujet,
  PointDeVue,
  Preuve,
  ScriptMaitre,
  TypeAppel,
  TypeMatiere,
  VarianteReseau,
  Violation,
} from "@/domaine/types";

export type NiveauControle = "bloquant" | "alerte" | "info" | "correction";

/** Violation G3 : la `Violation` du modèle, avec son niveau (bloquant / alerte / information / correction). */
export interface ViolationControle extends Violation {
  niveau: NiveauControle;
}

/** Qui a écrit le texte : la machine (règles dures) ou Will (informations, sauf exceptions de B.7.5). */
export type Auteur = "machine" | "will";

/** Exigences d'une structure, en données (recette). Lu par les contrôles et par le choix conjoint. */
export interface TempsStructure {
  /** Identifiant du temps dans l'enchaînement (« geste », « raison », « regle-a-retenir »…). */
  id: string;
  libelle: string;
  /** Temps obligatoire : sans source, la structure n'est pas réalisable (C67). */
  obligatoire: boolean;
  /** Obligatoire seulement pour ces objectifs (ex. la règle à retenir quand on veut faire partager). */
  obligatoireSiObjectif?: ObjectifSujet[];
  /** Sources acceptées pour couvrir ce temps. */
  sources: SourceTemps[];
  /** Position maximale (s) où ce temps doit être dit (C46 bis : geste ou verdict avant 5 s). */
  avantSec?: number;
}

export type SourceTemps =
  | { matiere: TypeMatiere; quiParleWill?: boolean; contient?: "cause" }
  | { preuve: "chiffree" | "prouve" | "observe" | "regle-loi" | "cas-client" | "avant-apres" | "formulation-autorisee" | "toute" };

export interface StructureGenerateur {
  /** Préfixé du code du format (lu dans la recette, jamais écrit dans le central). */
  id: string;
  nom: string;
  enchainement: string[];
  /** Types d'ancrage acceptés (vide : tous). */
  typesAncrage: TypeMatiere[];
  /** Au moins un appui parmi ces sources (vide : aucun appui exigé). */
  appui: SourceTemps[];
  temps: TempsStructure[];
  /** L'ancrage cité exige un accord obtenu (cas client, parole de dirigeant). */
  accordRequis?: boolean;
  /** Points de vue que la structure permet (vide : ceux de la recette). */
  pointsDeVue?: PointDeVue[];
  /** false : tirée seulement après son banc partiel (ne compte pas dans n, C43). */
  tirable: boolean;
  /** Le premier temps est-il une affirmation (S1 corrigée : « Vous recevez un PV… ») ? */
  ouvertureAffirmative?: boolean;
  origine: string;
}

/** Rôles des blocs dans la recette résolue (le central ne nomme aucun bloc). */
export interface RolesBlocs {
  accroche: string;
  promesse?: string;
  appel: string;
  boucle?: string;
}

/** Paramètres de la recette dont les contrôles ont besoin. */
export interface ParametresRecette {
  roles: RolesBlocs;
  annotationsAcceptees: (AnnotationSegment | string)[];
  annotationsReservees: (AnnotationSegment | string)[];
  intervenantsPermis?: string[];
  /** Plafonds d'ouverture (s, mots) : addendum du 02/10, ≤ 5 s et ≤ 20 mots. */
  accrocheMaxSec: number;
  accrocheMaxMots: number;
  /** Appel : facultatif (addendum), 5-47 mots quand il existe. */
  appelFacultatif: boolean;
  appelMaxMots: number;
  appelMinMots: number;
  corpsMaxSec: number;
  corpsIndicatifMinSec?: number;
  exceptionObligatoire: boolean;
  nombresMaxAccroche: number;
  famillesAccrochePermises: string[];
  /** Exigences des familles d'accroche (type de matière exigé). */
  exigencesAccroche?: Record<string, { matiere?: TypeMatiere[]; preuveChiffree?: boolean; accordAvantApres?: boolean; scene?: boolean }>;
  emotionsPermises: Emotion[];
  pointsDeVuePermis: PointDeVue[];
  /** Formules d'exception de la recette (rotation, C30 ter). */
  formulesException: string[];
  /** Phrases d'apaisement réellement dites (temps APAISEMENT seulement). */
  formulesApaisement: string[];
  structures: StructureGenerateur[];
}

/** Règles d'un réseau, lues dans `reseaux/ecriture.ts` par l'appelant. */
export interface ParametresReseau {
  id: string;
  zoneSec: [number, number];
  motsDiese: [number, number];
  /** La 1re ligne (ou le titre) doit contenir le mot-clé (C10) ; false : exempté. */
  premiereLigneAvecMotCle: boolean;
  caracteresMaxPremiereLigne?: number;
  boucle: "oui" | "non" | "sauf-apres-question";
  appelsPermis: TypeAppel[];
  /** Appel attendu selon l'objectif (table objectif × réseau, B.4.4). */
  appelSelonObjectif?: Partial<Record<ObjectifSujet, TypeAppel>>;
  appelParDefaut: TypeAppel;
  /** Champs de publication exigés (C36), par nom de champ de `publication`. */
  champsRequis: string[];
  /** Le double y est déconseillé pour ce type de vidéo (C48). */
  doubleDeconseille?: boolean;
  /** Équipe 7 : termes qui disent de quoi parle le compte ; l'un d'eux est dit avant 5 s (C10). Absent : rien. */
  termesDuCompte?: string[];
}

export interface ContexteWill {
  interdits: { id: string; texte: string; regex?: string }[];
  promessesInterdites: string[];
  rolesDestinataires: string[];
  termesVagues: string[];
  jargonInterdit?: string[];
  /** Personnes ou rôles que la vidéo met en cause (C64 : jamais destinataires de l'envoi). */
  misEnCause?: string[];
  carnetVoix?: string[];
}

export interface TournureControle {
  id: string;
  motif: string;
  regex: string;
  drapeaux?: string;
  niveau: "bloquant" | "grappe";
  portee?: "ouverture" | "partout" | "appel" | "affiche";
}

/** Une version par réseau à contrôler (ou un texte de Will). */
export interface EntreeControle {
  auteur: Auteur;
  mode: ModeDiction;
  adresse: Adresse;
  /** Débit du mode (mots/s). */
  debit: number;
  /** true quand l'horodatage réel existe (après M0b / G6) : pas de marge de 10 %. */
  debitMesure?: boolean;
  ouverture: BlocScript[];
  corps: BlocScript[];
  fin: BlocScript[];
  recette: ParametresRecette;
  reseau?: ParametresReseau;
  structure?: StructureGenerateur;
  objectif?: ObjectifSujet;
  appel?: VarianteReseau["appel"];
  boucle?: boolean;
  motCle?: string;
  motCleSource?: ScriptMaitre["motCleSource"];
  encadre?: { texte: string };
  encadre2?: { texte: string; aPartirDeSec: number };
  couverture?: { texte: string };
  publication?: Partial<VarianteReseau["publication"]>;
  familleAccroche?: string;
  maitre?: Pick<ScriptMaitre, "exception" | "appuiPrincipal" | "ancrages" | "envoi" | "pointDeVue" | "emotion" | "angle" | "brief">;
  /** Situation du sujet (S1 : apaisement permis seulement face à une menace). */
  situation?: "menace" | "neutre";
  quiParle?: "will" | "double";
  serie?: { serieId?: Id; episodesProgrammes?: number; episodeSuivantProgramme?: boolean };
  preuves: Preuve[];
  matieres: Matiere[];
  contexte?: ContexteWill;
  tournures?: TournureControle[];
  /** Dictionnaire de prononciation validé : forme affichée → forme dite. */
  prononciations?: { forme: string; dit: string }[];
  /** Sigles en attente de validation (« à valider »). */
  siglesAValider?: string[];
  maintenant: DateIso;
  compteInterne?: boolean;
  /** Versions sœurs du même sujet (C14). */
  autresVersions?: { reseau: string; formatId?: string; accrocheDite: string; appelTexte?: string; premiereLigne?: string }[];
  /** Accroche unique entre réseaux (`reseaux.accrocheUnique`, défaut oui). */
  accrocheUnique?: boolean;
  /** Texte de la version précédente (C1 ter : la réécriture n'ajoute rien). */
  textePrecedent?: string;
  /**
   * G6 : horodatage RÉEL de chaque segment (début, fin), mesuré sur l'audio de la vidéo fabriquée, dans l'ordre des
   * segments assemblés. Présent, il remplace l'horloge estimée (et `debit` est le débit mesuré).
   */
  horodatageReel?: ({ debutSec: number; finSec: number } | null)[];
  /** Téléprompteur et trame (C35). */
  prompteur?: string;
  trame?: VarianteReseau["trame"];
  empreinteCorpsAvatar?: string;
  /** Lien de réservation directe connu (C34 : jamais avec `diagnostic`). */
  motifsReservationDirecte?: string[];
  /** Ouverture sur une illustration (réglage du format). */
  ouvertureSurIllustration?: boolean;
  /** Accroches finalistes du sujet et accroche retenue pour cette version (C70). */
  finalistes?: AccrocheFinaliste[];
  accrocheId?: Id;
  /** Appel de série actif (C44 suspendu pour son texte, n° 73). */
  appelDeSerieActif?: boolean;
}

export interface ResultatControle {
  violations: ViolationControle[];
}
