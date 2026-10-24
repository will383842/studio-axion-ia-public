/**
 * Contrats des fournisseurs (PLAN B.6.5 + AV2.2-7, AV2.3-4 ; moteur avocat B.0 §9).
 * Par défaut : des SIMULATIONS (aucun appel réseau). Chaque fournisseur réel respecte le même contrat,
 * passe les mêmes tests de contrat, et n'est activé que par un réglage ou une variable d'environnement.
 * Les moteurs choisissent leur chemin d'après les CAPACITÉS déclarées, jamais d'après le nom du fournisseur.
 */
import type {
  Accord,
  Adresse,
  BlocScript,
  CategorieMesImages,
  CommandeFabrication,
  IdReseau,
  LigneCout,
  Licence,
  Montant,
  MotHorodate,
  NoteScript,
  Ratio,
  ReglagesVoix,
  StatutPreparation,
  StatutPublication,
  TexteReseau,
  TypeAccroche,
  TypeClone,
  VeilleNouveaute,
  ZoneSensible,
} from "@/domaine/types";
import type { RecetteScript } from "@/formats/types";
import type { FournisseurSite } from "./site/types";
import type { DateIso, ModeEnvoiPublication, ModeSolde } from "@/domaine/types";

export type TypeFournisseur =
  | "script"
  | "visage"
  | "voix"
  | "montage"
  | "illustration"
  | "etalonnage"
  | "son"
  | "miniature"
  | "publication"
  | "texte-reseaux"
  | "notification"
  | "stockage"
  /** Lot « calage » (02/10, D3) : alignement forcé des mots sur le son (WhisperX, conteneur `studio-aligneur`). */
  | "alignement"
  /** Vidéos sur le site (lot S3) : le site axion-ia.com, appelé par envois signés ; en simulation, un site factice. */
  | "site";

export type ModeFournisseur = "simulation" | "reel";

export interface Tarif {
  unite: LigneCout["unite"];
  prixUnitaire: Montant;
}

export interface CapacitesFournisseur {
  dureeMaxSec?: number;
  langues?: string[];
  retoucheParPlan?: boolean;
  /** Le travail se termine plus tard (suivi par interrogation ou crochet). */
  asynchrone: boolean;
  /** Exige un accord enregistré pour une personne réelle. */
  accordExige: boolean;
  tarif?: Tarif;
  /**
   * Tarif saisi en DOLLARS (centimes de dollar par unité). La console convertit en euros avec le réglage
   * `taux.usdEur` (Réglages > Budget) : l'estimation affichée correspond à ce qui sera payé.
   */
  tarifUsd?: { unite: LigneCout["unite"]; centimesUsd: number };
  /* --- Capacités lues par les moteurs (B.0 §9) --- */
  /** Voix : sait produire un fichier son seul (sans visage). Une voix sans cette capacité est refusée à la fabrication. */
  audioSeul?: boolean;
  /** Voix : renvoie le moment de chaque mot. */
  horodatageMots?: boolean;
  /** Visage : rend sur fond transparent (double créé avec `matting`). */
  fondTransparent?: boolean;
  /** Visage : résolution maximale du personnage (HeyGen Avatar V : 1080). */
  resolutionMax?: number;
  /** Visage : cadence de sortie (i/s), confirmée au premier rendu réel. */
  fpsSortie?: number;
}

export interface FournisseurBase {
  /** « simulation », « elevenlabs », « heygen »… */
  id: string;
  type: TypeFournisseur;
  /** Nom affiché dans Réglages > Connexions. */
  nom: string;
  /** Nom du service réel prévu plus tard (affiché « À relier »). */
  reelPrevu: string;
  mode: ModeFournisseur;
  capacites: CapacitesFournisseur;
}

/** Erreur typée d'un fournisseur. `fichier-inaccessible` : nouvelle soumission avec une adresse neuve, même clé. */
export interface ErreurFournisseur {
  code: "fichier-inaccessible" | "indisponible" | "refuse" | "quota" | "inconnu";
  reessayable: boolean;
  /** Phrase simple pour Will (français, sans code ni texte brut du fournisseur). */
  message: string;
  /** Texte brut du fournisseur (code, message anglais) : console serveur et `detailTechnique` seulement, jamais à l'écran. */
  detailTechnique?: string;
}

/* --- Script ------------------------------------------------------- */
export interface DemandeScript {
  formatId: string;
  recette: RecetteScript;
  sujet: string;
  cible?: string;
  ton?: string;
  /** Durée CIBLE du texte (pour un format « depuis-script », c'est ensuite le texte qui fixe la durée). */
  dureeSec: number;
  nombre: number; // 3 versions par défaut
  /** Tu ou vous (B.0 §15). Absent : vous. */
  adresse?: Adresse;
}
export interface ScriptGenere {
  titre: string;
  blocs: BlocScript[];
  notes: NoteScript;
}
export type ConsigneAmelioration = "ameliorer" | "plus-percutant" | "plus-court";

/** Une accroche proposée (B.9 bis) : son type, sa note /100 et pourquoi. */
export interface AccrocheProposee {
  texte: string;
  type: TypeAccroche;
  note: number;
  justification: string;
}

/** Catalogue de ce qui existe déjà, pour traduire « bureau, costume bleu, debout » en pastilles (B.3). */
export interface CatalogueDistribution {
  decors: { id: string; nom: string; motsCles: string[] }[];
  tenues: { id: string; nom: string }[];
  postures: { posture: "assis" | "debout"; filmee: boolean }[];
}

/** Une pastille de la saisie libre : trouvé, à créer (coût, durée) ou non filmé (repli). Jamais de lancement sans accord. */
export type PastilleDistribution =
  | { genre: "decor" | "tenue" | "posture"; etat: "trouve"; id: string; libelle: string }
  | { genre: "decor" | "tenue"; etat: "a-creer"; libelle: string; coutEstime: Montant; dureeEstimeeSec: number }
  | { genre: "posture"; etat: "non-filme"; libelle: string; repli: "assis" | "debout" };

/**
 * « Demander une modification » (B.9) : la demande libre de Will traduite en opérations typées, avec ce qui va
 * changer. Rien ne s'exécute sans sa confirmation ; hors capacités → `horsCapacite` (réponse claire, avec le prix
 * de la vidéo à refaire calculé par le service). Les opérations sont celles de `moteurs/types.ts` (`OperationMontage`).
 */
export interface DemandeModification {
  texte: string;
  plans: { id: string; ordre: number; texte: string; debutSec: number; finSec: number; sourceImage: string; angle?: string }[];
  titreOuverture?: string;
}
export interface ReponseModification {
  operations: import("@/moteurs/types").OperationMontage[];
  /** Résumé en une ou deux phrases, vouvoiement, sans jargon. */
  resume: string;
  /** La demande dépasse ce qu'une retouche sait faire (« changer la tenue après fabrication »). */
  horsCapacite?: string;
}

export interface FournisseurScript extends FournisseurBase {
  type: "script";
  /** Traduit une demande libre en opérations typées (Claude ; simulation par mots-clés). */
  interpreterDemande(demande: DemandeModification): Promise<ReponseModification>;
  generer(demande: DemandeScript): Promise<ScriptGenere[]>;
  noter(blocs: BlocScript[], recette: RecetteScript, dureeCibleSec: number, adresse?: Adresse): Promise<NoteScript>;
  ameliorerBloc(bloc: BlocScript, consigne: ConsigneAmelioration, recette: RecetteScript, adresse?: Adresse): Promise<BlocScript>;
  /** Un texte collé → blocs de la recette. Le texte de Will n'est JAMAIS réécrit (seulement réparti). */
  decouper(texte: string, recette: RecetteScript): Promise<BlocScript[]>;
  /** N accroches de types différents, notées (B.9 bis). */
  accroches(sujet: string, n: number, adresse: Adresse): Promise<AccrocheProposee[]>;
  /** « bureau, costume bleu, debout » → pastilles à vérifier (B.3). Ne lance jamais rien. */
  resoudreDistribution(phrase: string, catalogue: CatalogueDistribution): Promise<PastilleDistribution[]>;
  /**
   * Lot B2 (veille des outils, ajout pur facultatif figé le 02/10) : résumé en français simple d'une nouveauté
   * (« ce que ça change pour vos vidéos », intérêt, risque), contexte « studio vidéo Axion-IA, format avocat ».
   */
  resumerNouveaute?(demande: { outil: string; role: string; versionUtilisee?: string; versionVue: string; notes: string }): Promise<VeilleNouveaute["resume"] & { rouge: boolean }>;
}

/* --- Visage ------------------------------------------------------- */

/** Demande de rendu d'un visage (B.0 §9) : il parle TOUJOURS sur un son déjà fabriqué (audio maître). */
export interface DemandeRenduVisage {
  /** Identifiant du double chez le fournisseur. */
  visageId: string;
  /** Clé de stockage de l'audio (adresse signée valable 24 h donnée au fournisseur). */
  audioCle: string;
  /**
   * « decor-du-look » (correcteur réel 2, 04/10) : le look choisi porte SON décor, fait par Will dans l'application
   * HeyGen ; la vidéo est rendue AVEC ce fond (mp4 opaque), ni détourée ni posée sur un fond uni.
   */
  fond: FondRenduVisage;
  ratio: Ratio;
  /** Consigne de gestes (HeyGen `motion_prompt`). */
  motionPrompt?: string;
  /** Rejouée telle quelle (en-tête `Idempotency-Key`) en cas de nouvelle soumission. */
  cleIdempotence: string;
  /* --- Lot R7 (ajouts facultatifs) --- */
  /** Adresse de lecture de l'audio (signée, 24 h), faite par l'appelant ; absente : le fournisseur signe `audioCle`. */
  audioUrl?: string;
  /** Identifiant de rappel IMPRÉVISIBLE (crochet « réveil », `services/crochets.ts`). */
  callbackId?: string;
  titre?: string;
  /* --- Lot R7e (ajout facultatif) --- */
  /** Fond « uni » : couleur du fond (repli quand l'avatar n'a pas été créé sans fond). */
  couleurFond?: string;
  /**
   * Correcteur réel 2 (F4) : look FILMÉ de la personne (« motion look ») quand le rendu se fait sur un look généré : ses
   * gestes appris servent sur tous les looks (HeyGen `reference_look_id`). Absent : le look rendu est le look filmé.
   */
  referenceLookId?: string;
}

/** Fond d'un rendu de visage : transparent (posé sur nos décors), uni (repli), ou le décor du look lui-même. */
export type FondRenduVisage = "transparent" | "uni" | "decor-du-look";

/**
 * Correcteur réel 2 (04/10) : un look déjà fait par Will dans l'application HeyGen (son avatar dans un décor), lu
 * gratuitement pour être RELIÉ à un décor de la Bibliothèque. Rien n'est créé chez HeyGen.
 */
export interface LookExistant {
  idExterne: string;
  nom: string;
  /** Groupe de l'avatar chez le fournisseur (« New Avatar »…). */
  groupe?: string;
  /** Image d'aperçu chez le fournisseur (copiée chez nous pour la vignette, jamais affichée telle quelle). */
  apercuUrl?: string;
  utilisable: boolean;
  raison?: string;
}

/** Lot R7 : un double déjà créé chez le fournisseur (HeyGen : dans son application, avec le même compte). */
export interface DoubleExistant {
  idExterne: string;
  nom: string;
  /** Peut servir au format avocat (terminé, Avatar V). Sinon `raison` dit pourquoi, en mots simples. */
  utilisable: boolean;
  raison?: string;
  orientation?: "portrait" | "landscape" | "square";
}

export type EtatRenduVisage = { statut: "en_cours"; progression: number } | { statut: "termine" } | { statut: "echec"; erreur: ErreurFournisseur };

export interface FournisseurVisage extends FournisseurBase {
  type: "visage";
  /** `matting: true` : sans lui, pas de fond transparent (B.0 §9). */
  creerDouble(demande: { visageId: string; nature: "moi" | "reel" | "invente"; accord?: Accord; fichierIds: string[]; matting?: boolean }): Promise<{ idExterne: string; statut: StatutPreparation }>;
  suivre(idExterne: string): Promise<{ statut: StatutPreparation; progression: number }>;
  /** Essai : la phrase est d'abord lue par la voix (`FournisseurVoix.lire`), puis rendue sur ce son. */
  tester(idExterne: string, audioCle: string): Promise<{ fichierCle: string }>;
  noterQualite(fichierIds: string[]): Promise<{ note: number; conseils: string[]; levres?: number }>;
  /** Rendu d'un angle sur l'audio maître (webm 1080p transparent chez HeyGen). Répond tout de suite. */
  rendre(demande: DemandeRenduVisage): Promise<{ idTravailExterne: string }>;
  suivreRendu(idTravailExterne: string): Promise<EtatRenduVisage>;
  recuperer(idTravailExterne: string, options?: { fond?: FondRenduVisage }): Promise<{ videoCle: string; dureeSec: number; fps?: number }>;
  /**
   * Lot R7e (facultatif, GRATUIT) : retrouve un rendu déjà demandé d'après son titre exact (reprise après une panne :
   * la demande est peut-être arrivée chez le fournisseur sans que la réponse ait été gardée). Null : aucun.
   * `depuis` : date de la décision d'envoi (la recherche ne remonte pas plus loin).
   */
  retrouverRendu?(titre: string, options?: { depuis?: string }): Promise<{ idTravailExterne: string } | null>;
  /** Nouveau look (tenue, ou trois-quarts de secours) à partir d'une IMAGE : `origine: genere`, `a_verifier`. */
  creerLook(demande: { visageId: string; prompt: string; imagesReference?: string[] }): Promise<{ idExterne: string; statut: StatutPreparation }>;
  /** Lot R7 (facultatif) : les doubles déjà créés chez le fournisseur (lecture gratuite). */
  listerDoubles?(): Promise<DoubleExistant[]>;
  /** Correcteur réel 2 (facultatif, GRATUIT) : tous les looks du compte (décors faits dans l'application). */
  listerLooks?(): Promise<LookExistant[]>;
  /**
   * Correcteur réel 2 (facultatif, GRATUIT) : relit UN look du compte et copie son image d'aperçu dans notre stockage
   * (vignette du décor). `apercuCle` absent : pas d'image lisible (le look reste relié).
   */
  garderApercuLook?(idExterne: string): Promise<{ look: LookExistant; apercuCle?: string; mime?: string }>;
}

/* --- Voix --------------------------------------------------------- */

/** Une voix déjà créée chez le fournisseur (HeyGen : `GET /v3/voices?type=private`). */
export interface VoixExistante {
  idExterne: string;
  nom: string;
  langue: string;
  /** Déduit des moteurs disponibles (HeyGen ne le renvoie pas). */
  typeClone: TypeClone;
  /** La voix sait produire un son seul : sinon elle ne peut pas être reliée. */
  utilisable: boolean;
  apercuUrl?: string;
}

export interface DemandeLecture {
  idExterne: string;
  texte: string;
  reglages: ReglagesVoix;
  prononciations: { mot: string; prononciation: string }[];
  /** Débit visé en mots par seconde (recette du format) ; la simulation s'en sert pour la durée. */
  motsParSeconde?: number;
  /**
   * CORRECTEUR 1 — B2 : la copie du son dans le stockage se fera APRÈS, par `copierSon` (fabrication : le son payé est
   * gardé par le travail dès la réponse, une copie ratée se refait sans relire la voix).
   */
  copieDifferee?: boolean;
  /** Taux dollar → euro figé dans la commande (voix payée en dollars) ; sinon le taux par défaut. */
  tauxUsdEur?: number;
  /**
   * Lecture NEUVE : le fournisseur ignore son cache (HeyGen `force_regenerate`). Sans elle, HeyGen rend un son identique
   * à l'octet pour un même texte (essais réels du 14/10) : relire une prise refusée ne changerait rien.
   */
  nouvelleLecture?: boolean;
}

export interface ResultatLecture {
  fichierCle: string;
  dureeSec: number;
  cout: Montant;
  /** Horodatage de chaque mot du texte PRONONCÉ (prononciations substituées). Vide si la capacité manque. */
  mots: MotHorodate[];
  /**
   * CORRECTEUR 1 — B2 : le son payé n'est pas encore dans le stockage (copie différée, ou copie ratée) : `fichierCle`
   * est l'adresse TEMPORAIRE du fournisseur ; `copierSon(adresse, idExterne, idDemande)` le range ensuite.
   */
  copieEnAttente?: { adresse: string; idDemande: string };
}

export interface FournisseurVoix extends FournisseurBase {
  type: "voix";
  copierVoix(demande: { voixId: string; nature: "moi" | "reel" | "invente"; accord?: Accord; fichierIds: string[]; minutes: number }): Promise<{ idExterne: string; statut: StatutPreparation }>;
  /** Chemin NORMAL : un son seul + l'horodatage des mots. L'écoute d'essai et les prononciations l'utilisent aussi. */
  lire(demande: DemandeLecture): Promise<ResultatLecture>;
  /** CORRECTEUR 1 — B2 : range dans le stockage un son déjà payé (`copieEnAttente`) ; renvoie sa clé. Ne relit rien. */
  copierSon?(adresse: string, idExterne: string, idDemande: string): Promise<string>;
  /** Voix déjà créées chez le fournisseur (relier la voix HeyGen de Will, lot M0b). */
  listerVoixExistantes(): Promise<VoixExistante[]>;
}

/* --- Montage, illustrations, étalonnage, son ---------------------- */
export interface FournisseurMontage extends FournisseurBase {
  type: "montage";
  assembler(commande: CommandeFabrication): Promise<{ projetMontage: Record<string, unknown>; dureeSec: number }>;
}

/** Un résultat d'une banque gratuite (Pexels, Pixabay), toujours avec sa licence. */
export interface ResultatBanque {
  idExterne: string;
  source: "pexels" | "pixabay";
  fichierCle: string;
  vignetteCle: string;
  dureeSec: number;
  largeur: number;
  hauteur: number;
  licence: Licence;
  description: string;
}

export interface FournisseurIllustration extends FournisseurBase {
  type: "illustration";
  /** Choisit parmi les éléments de bibliothèque candidats selon la requête du plan. */
  choisir(demande: { requete: string; candidats: { id: string; motsCles: string[] }[]; nombre: number }): Promise<string[]>;
  generer(demande: { requete: string; ratio: string }): Promise<{ fichierCle: string; cout: Montant }>;
  /** Banques gratuites : vidéos VERTICALES seulement, durée suffisante, avec licence (B.6). */
  chercher(demande: { requete: string; ratio: Ratio; dureeMinSec: number; sources: ("pexels" | "pixabay")[] }): Promise<ResultatBanque[]>;
  /** Anime une image en clip court (Kling, Seedance). Jamais de zoom lent sur image fixe. */
  animer(demande: { imageCle: string; dureeSec: number }): Promise<{ fichierCle: string; cout: Montant }>;
  /**
   * Lot A2 (« Mes images », ajout pur facultatif figé le 02/10) : classement d'une image ou d'une vidéo à l'import
   * (modèle de vision ; simulé tant qu'aucune clé Claude). Ne modifie jamais le fichier.
   */
  analyserImage?(demande: { fichierCle: string; mime: string; nom: string }): Promise<AnalyseImage>;
}

/** Ce que le modèle de vision propose pour une image de « Mes images » (Will valide d'un geste). */
export interface AnalyseImage {
  categorie: CategorieMesImages;
  motsCles: string[];
  motsClesEn: string[];
  description: string;
  cadrageVertical: { x: number; y: number; tientEnVertical: boolean };
  zones: ZoneSensible[];
  /** Visage d'une autre personne que Will : accord nécessaire. */
  visageTiers: boolean;
  qualite: { note: number; nette: boolean; assezGrande: boolean; remarques: string[] };
}

/**
 * Lot R5 (ajouts purs facultatifs) : ce qu'un outil réel du serveur lit et où il dépose, adresses déjà signées par le
 * studio. Sans `source`, la simulation répond comme avant ; un outil réel l'exige.
 */
export interface SourceEtalonnage {
  nature: "image" | "video";
  /** Adresse de lecture de l'image ou de la vidéo d'origine (jamais modifiée). */
  url: string;
  /** Adresse de lecture du fichier .cube. */
  lutUrl: string;
  depot: { cle: string; urlDepot: string };
}

export interface SourceMixage {
  voixUrl: string;
  musiqueUrl?: string;
  dureeSec?: number;
  depot: { cle: string; urlDepot: string };
}

export interface FournisseurEtalonnage extends FournisseurBase {
  type: "etalonnage";
  /** Valide un fichier .cube à l'import (AV2.3-5). */
  validerCube(contenu: string): Promise<{ ok: true; taille: number; avertissement?: string } | { ok: false; erreur: string }>;
  /** `intensite` de 0 à 1. Réponse : le NOUVEAU fichier (l'original n'est jamais modifié). */
  appliquer(demande: { fichierCle: string; lutId: string; intensite: number; source?: SourceEtalonnage }): Promise<{ fichierCle: string }>;
}

export interface FournisseurSon extends FournisseurBase {
  type: "son";
  mixer(demande: { voixCle: string; musiqueId?: string; bruitageIds: string[]; niveauCibleLufs: number; baisseSousVoixDb: number; source?: SourceMixage }): Promise<{ fichierCle: string; niveauLufs: number; creteVraieDbtp?: number }>;
}

/* --- Miniature, publication, texte, notification ------------------ */
/**
 * Lot R4 (miniatures réelles, ajouts purs facultatifs) : la vidéo d'où tirer les images. Adresses déjà signées par
 * le studio (lecture de la vidéo SANS texte, sinon de la vidéo finale ; un dépôt par miniature).
 */
export interface SourceMiniature {
  url: string;
  dureeSec: number;
  ratio: Ratio;
  /** Un instant par miniature, du meilleur au moins bon (`instantsMiniature`). */
  instantsSec: number[];
  /** Mise en page de chaque miniature (0, 1, 2) ; absent : 0, 1, 2 dans l'ordre. */
  variantes?: number[];
  /** Vignettes lot 1 : gabarit voulu (réglage `miniature.gabarit`, `r4` par défaut), générateur et rang de la vidéo. */
  gabarit?: "r4" | "axion-v2";
  formatId?: string;
  rangVideo?: number;
  depots: { cle: string; urlDepot: string }[];
}

/** Titre écrit sur l'image : 5 mots au plus, et le mot mis en valeur (orange). */
export interface CouvertureMiniature {
  texte: string;
  motCle?: string;
}

export interface PropositionMiniature {
  fichierCle: string;
  titre: string;
  /** Lot R4 : le titre est ÉCRIT sur l'image (l'aperçu ne le repose pas ; le changer refait l'image). */
  incrustee?: boolean;
  /** Lot R4 : instant de la vidéo réellement retenu (la plus nette des 5 images) et mise en page. */
  instantSec?: number;
  variante?: number;
  /** Vignettes lot 1 (gabarit `axion-v2`) : ambiance et mise en page de l'image. */
  ambiance?: "encre" | "ivoire";
  mise?: "m1" | "m2" | "m3";
}

export interface FournisseurMiniature extends FournisseurBase {
  type: "miniature";
  /** Sans `source` (simulation, vidéo de démonstration) : des images d'essai. Un fournisseur réel exige `source`. */
  proposer(demande: { videoId: string; titre: string; nombre: number; source?: SourceMiniature; couverture?: CouvertureMiniature }): Promise<PropositionMiniature[]>;
}

/* --- Lot R1 (Buffer réel, brouillon d'abord) : ajouts FACULTATIFS, la simulation n'en a pas besoin --- */
/** Défini dans le domaine (une seule source), repris ici pour les fournisseurs. */
export type { ModeEnvoiPublication } from "@/domaine/types";

/** Compte d'un réseau relié dans le service de publication (un « canal » Buffer). */
export interface CanalPublication {
  id: string;
  organisationId: string;
  /** Nom affiché (« Axion IA », la page, le profil). */
  nom: string;
  /** Service tel que Buffer le nomme : « instagram », « linkedin », « youtube »… */
  service: string;
  /** « profile », « page », « business »… (deux LinkedIn : le profil ou la page). */
  genre?: string;
  avatar?: string;
  /** Déconnecté chez Buffer : rien ne peut y partir tant que Will ne l'a pas reconnecté. */
  deconnecte: boolean;
}

/** État d'une publication lu chez le service (jamais deviné). */
export interface EtatPublicationExterne {
  idExterne: string;
  canalId?: string;
  statut: StatutPublication;
  date?: string;
  envoyeeLe?: string;
  /** Adresse de la publication sur le réseau, une fois publiée. */
  lien?: string;
  /** Raison d'un échec, telle que le service la donne (sans aucune clé). */
  erreur?: string;
  /** Texte (relu pour retrouver un envoi dont la réponse s'est perdue). */
  texte?: string;
  creeeLe?: string;
}

export interface DemandePublication {
  reseau: IdReseau;
  texte: string;
  date: string;
  /** Adresse LISIBLE par le service (lot R1 : adresse signée 7 jours). */
  fichierCle: string;
  /* --- Lot R1 (facultatifs) --- */
  mode?: ModeEnvoiPublication;
  /** Compte de destination (obligatoire pour un service réel). */
  canalId?: string;
  /** Titre (YouTube l'exige). */
  titre?: string;
  /** Empreinte de l'envoi (vidéo, réseau, date) : un même envoi n'est jamais fait deux fois. */
  cleEnvoi?: string;
  /** Premier commentaire du kit (L1-10) : transmis à Buffer là où le schéma l'accepte, sinon « à poser à la main ». */
  premierCommentaire?: string;
  /** Images à publier à la place de la vidéo (L1-10) : chacune porte son texte alternatif (125 signes au plus). */
  images?: { url: string; texteAlternatif: string }[];
  /**
   * Équipe 7 : la vidéo met Axion IA en avant (« Votre marque » sur TikTok). Buffer n'a aucun champ pour le déclarer
   * (relevé du 03/10/2026) : non transmis, le studio le rappelle. À brancher ici si Buffer l'ajoute un jour.
   */
  votreMarque?: boolean;
}

export interface FournisseurPublication extends FournisseurBase {
  type: "publication";
  /** `statut` (lot R1) : ce que le service a enregistré. Absent : la simulation (rien n'est parti). */
  envoyer(demande: DemandePublication): Promise<{ idExterne: string; via: "buffer" | "simulation"; statut?: Extract<StatutPublication, "brouillon" | "programmee">; premierCommentaire?: "transmis" | "a-la-main" }>;
  /* --- Lot R1 (facultatifs, réseau : jamais appelés par un écran) --- */
  listerCanaux?(): Promise<CanalPublication[]>;
  lireEtat?(idExterne: string): Promise<EtatPublicationExterne>;
  /** Publications d'un compte créées depuis un instant (pour retrouver un envoi dont la réponse s'est perdue). */
  publicationsRecentes?(demande: { organisationId: string; canalId: string; depuis: string }): Promise<EtatPublicationExterne[]>;
}

export interface FournisseurTexteReseaux extends FournisseurBase {
  type: "texte-reseaux";
  /** `mentionIA` vide : la mention est coupée (décision de Will), rien n'est ajouté au texte. */
  ecrire(demande: { reseau: IdReseau; titre: string; sujet?: string; texteScript: string; mentionIA: string; credits: string[]; formatId?: string; dureeSec?: number; adresse?: Adresse }): Promise<TexteReseau>;
}

export interface FournisseurNotification extends FournisseurBase {
  type: "notification";
  envoyer(demande: { titre: string; message?: string; lien?: string }): Promise<{ envoye: boolean }>;
}

/* --- Service de rendu `studio-rendu` (B.9 ter) --------------------- */

/**
 * Contrat du conteneur SANS ÉTAT `studio-rendu` (Node + Chrome sans affichage + FFmpeg + Remotion), figé au lot M0,
 * construit au lot M1b. Deux files : COURTE prioritaire (quelques secondes, délai max 45 s depuis le lot R4) et LONGUE (montages,
 * un à la fois). Toutes les entrées et la sortie sont des adresses R2 signées ; le résultat est déposé dans R2.
 * Un `idRendu` connu qui répond 404 (conteneur redémarré) est soumis à nouveau avec le MÊME identifiant.
 */
export type OperationRendu =
  | "nettoyage-audio" // file courte : coupe les blancs, fondus aux passages par zéro (lot M1)
  | "tranches-audio" // file courte : tranches de l'audio maître ± 1 s pour le second angle (lot M6)
  | "analyse-media" // file courte : ffprobe d'un rush (orientation, HDR, durée, cadence)
  | "mesure-son" // file courte : ebur128 crête vraie, LRA, pauses (lots M4, M7)
  | "composition" // file longue : montage Remotion d'un ratio (lot M4)
  | "image-fixe" // file courte : une image Remotion `still` (captures de styles, couverture)
  | "traitement-image" // file courte (lot A2, réservée le 02/10) : « Mes images » — zones floutées, empreinte, vignette ; l'original n'est jamais modifié
  | "assemblage" // file courte (G6, G6b) : morceaux de sons ou de prises mis bout à bout sur des coupes (versions par réseau, « je lis »)
  | "capture-site" // file longue (« Source axion-ia.com ») : capture d'écran ou courte vidéo d'une page de axion-ia.com, et de lui seul
  | "miniature" // file courte (lot R4) : 5 images autour d'un instant, la plus nette, titre de couverture posé dans la zone sûre (JPEG ≤ 2 Mo)
  | "etalonnage" // file courte pour une image, longue pour une vidéo (lot R5) : LUT .cube appliquée à l'intensité voulue (lut3d tétraédrique)
  | "mixage" // file longue (lot R5) : chaîne de la voix du montage, musique qui s'efface sous la voix, −14 LUFS, crête ≤ −1,5 dBTP
  | "extrait" // file courte (lot R7, double) : tranche de l'audio maître (WAV) pour le second angle, ou passage vidéo
  | "visuel-page" // file courte (carrousels V2-A, M2-01) : une page VisuelPage rendue en JPEG (×1 ou ×2), mesures de débordement
  | "assemblage-pdf" // file courte (carrousels V2-A, M2-02) : les JPEG des pages assemblés en un PDF (810 × 1012,5 pt)
  | "toile-continue"; // file courte : toile large rendue puis découpée

export interface DemandeRendu {
  idRendu: string;
  operation: OperationRendu;
  file: "courte" | "longue";
  /** Adresses de lecture signées, par nom d'entrée (« audio », « double-trois-quarts », « lut »…). */
  entrees: Record<string, string>;
  /** Adresse de dépôt signée et clé de stockage du résultat. */
  sortie: { urlDepot: string; cle: string };
  /** Paramètres propres à l'opération (coupures, composition, ratio…), sérialisables. */
  parametres: Record<string, unknown>;
}

export type EtatRendu =
  | { statut: "en_file"; rang: number }
  | { statut: "en_cours"; progression: number }
  | { statut: "termine"; sortieCle: string; mesures?: Record<string, number> }
  | { statut: "echec"; erreur: ErreurFournisseur }
  | { statut: "inconnu" };

export interface ServiceRendu {
  /** Répond tout de suite (le travail se suit par `etat`). Idempotent sur `idRendu`. */
  soumettre(demande: DemandeRendu): Promise<{ idRendu: string }>;
  /** `inconnu` : le conteneur a redémarré → soumettre à nouveau la même demande. */
  etat(idRendu: string): Promise<EtatRendu>;
}

/* --- Stockage (AV2.2-3) ------------------------------------------- */
export interface StockageFichiers extends FournisseurBase {
  type: "stockage";
  /** Prépare un dépôt : renvoie la clé `studio/{env}/{type}/{entiteId}/{fichierId}.{ext}` et l'adresse où déposer. */
  preparerDepot(demande: { fichierId: string; nom: string; mime: string; taille: number; typeEntite: string; entiteId: string }): Promise<{ cleStockage: string; urlDepot: string }>;
  /** `taille` : taille réelle de l'objet stocké quand le stockage la connaît (R2 : `content-length` du HEAD). */
  confirmerDepot(cleStockage: string): Promise<{ ok: boolean; sha256?: string; taille?: number }>;
  /** Adresse de lecture (V1 : le chemin public ; plus tard : URL signée R2). Chaîne vide : rien à lire. */
  urlLecture(cleStockage: string): Promise<string>;
  /* --- Lot M1b (ajouts facultatifs, R2) --- */
  /** Adresse de lecture valable `secondes` (24 h pour HeyGen, qui ne dit pas quand il récupère le fichier). */
  urlLectureDuree?(cleStockage: string, secondes: number, options?: { telechargerSous?: string }): Promise<string>;
  /** Adresse de dépôt d'un fichier entier (PUT signé), pour `studio-rendu`. */
  urlDepotDuree?(cleStockage: string, secondes: number, mime?: string): Promise<string>;
  /** Envoi par morceaux, direct du navigateur vers le stockage (rushs de 1-2 Go). Absent : envoi simulé. */
  multipart?: EnvoiMultipart;
  /* --- Lot R7 (corrections sécurité) --- */
  /** Les `octets` premiers octets de l'objet stocké (lecture partielle), pour reconnaître le type réel du fichier. */
  lireDebut?(cleStockage: string, octets: number): Promise<Uint8Array>;
  /** Efface un objet déposé qui ne sera pas gardé (aucun objet orphelin). */
  supprimer?(cleStockage: string): Promise<void>;
  /**
   * Clés des objets rangés sous `prefixe` (suppression définitive d'une vidéo : ses dossiers). Refuse un préfixe vide ou
   * qui remonte ; ne rend que des clés qui commencent par le préfixe ; 20 pages de 1000 au plus.
   */
  listerPrefixe?(prefixe: string): Promise<string[]>;
  /**
   * Empreinte SHA-256 (hexadécimal minuscule) de l'objet entier, lue en continu (mémoire constante, même à 15 Go).
   * Refuse si le nombre d'octets lus n'est pas `tailleAttendue`. Absent : simulation, aucune empreinte.
   */
  empreinteSha256?(cleStockage: string, tailleAttendue: number): Promise<{ sha256: string; taille: number }>;
}

/** Envoi multipart signé (S3 / R2) : morceaux de 10 à 50 Mo, reprise d'un morceau et d'un envoi interrompu. */
export interface EnvoiMultipart {
  commencer(cleStockage: string, mime: string): Promise<{ idEnvoi: string }>;
  /** Adresses PUT signées, une par numéro de morceau (1 à 10 000). */
  signerMorceaux(cleStockage: string, idEnvoi: string, numeros: number[]): Promise<Record<number, string>>;
  /** Morceaux déjà reçus (reprise d'un envoi interrompu). */
  morceauxRecus(cleStockage: string, idEnvoi: string): Promise<{ numero: number; etag: string; taille: number }[]>;
  terminer(cleStockage: string, idEnvoi: string, morceaux: { numero: number; etag: string }[]): Promise<{ ok: boolean }>;
}

export interface CarteFournisseurs {
  script: FournisseurScript;
  visage: FournisseurVisage;
  voix: FournisseurVoix;
  montage: FournisseurMontage;
  illustration: FournisseurIllustration;
  etalonnage: FournisseurEtalonnage;
  son: FournisseurSon;
  miniature: FournisseurMiniature;
  publication: FournisseurPublication;
  "texte-reseaux": FournisseurTexteReseaux;
  notification: FournisseurNotification;
  stockage: StockageFichiers;
  alignement: FournisseurAlignement;
  site: FournisseurSite;
}

export type EtatConnexion = "simulation" | "relie" | "a-relier";

/* ------------------------------------------------------------------ */
/* Lot « intensité · crédits · calage » — figé le 02/10                  */
/* (contrat : docs/LOT-INTENSITE-CREDITS-EXECUTION.md)                  */
/* ------------------------------------------------------------------ */

/* --- Calage des mots (D3) --------------------------------------------
 * Le son brut de la voix et le texte EXACT prononcé (prononciations substituées) partent au conteneur
 * `studio-aligneur` (Python, WhisperX, modèle wav2vec2 français, processeur seul, une demande à la fois). Il renvoie
 * l'horodatage de chaque mot ; le moteur le met à la place de celui de la voix (imprécis de 190-270 ms), AVANT le
 * nettoyage des blancs ; `report.ts` le reporte ensuite sur le texte validé. Cible : écart < 40 ms.
 * Même protocole que `studio-rendu` (soumettre, puis suivre ; un identifiant connu qui répond 404 est soumis à nouveau).
 */
export interface DemandeAlignement {
  /** Identifiant stable (idempotent) : `{travail}-alignement[-eN]`. */
  idAlignement: string;
  /** Adresse de lecture signée du son brut. */
  audio: string;
  /** Texte EXACT prononcé, dans l'ordre (le moteur le tient de `preparerTexteVoix`). */
  texte: string;
  langue: "fr";
  /** Horodatage renvoyé par la voix, pour mesurer l'écart (facultatif). */
  reference?: MotHorodate[];
}

export interface ResultatAlignement {
  /** Un mot par mot du texte, dans l'ordre ; un mot non aligné garde l'horodatage de la référence (compté). */
  mots: MotHorodate[];
  motsNonAlignes: number;
  modele: string;
  dureeCalculSec: number;
  /** Écart avec la référence (ms), quand elle a été donnée. */
  ecartMoyenMs?: number;
  ecartMaxMs?: number;
}

export type EtatAlignement =
  | { statut: "en_file"; rang: number }
  | { statut: "en_cours"; progression: number }
  | { statut: "termine"; resultat: ResultatAlignement }
  | { statut: "echec"; erreur: ErreurFournisseur };

export interface FournisseurAlignement extends FournisseurBase {
  type: "alignement";
  soumettre(demande: DemandeAlignement): Promise<void>;
  /** Un identifiant inconnu (conteneur redémarré) : `echec` avec `fichier-inaccessible`, le moteur soumet à nouveau. */
  suivre(idAlignement: string): Promise<EtatAlignement>;
}

/* --- Crédits des fournisseurs (D2) -------------------------------------
 * Chaque fournisseur PAYANT déclare comment son solde se lit. « reel » : lu chez lui (HeyGen `GET /v3/users/me`,
 * ElevenLabs `GET /v1/user/subscription`) ; « suivi » : calculé par le studio depuis les coûts réels (fal.ai, Anthropic :
 * aucune clé ADMIN sur le serveur). Les lecteurs vivent dans `fournisseurs/credits/` (D2), sans toucher aux
 * fournisseurs existants. La clé n'est JAMAIS renvoyée : seulement ses 4 derniers caractères.
 */
export interface LectureSolde {
  fournisseur: string;
  /** Solde en centimes de la devise du fournisseur (HeyGen : dollars du porte-monnaie). */
  centimes: number;
  devise: "USD" | "EUR";
  /** ElevenLabs : caractères restants (le solde s'exprime aussi en caractères). */
  caracteresRestants?: number;
  luLe: DateIso;
}

export interface TestConnexion {
  ok: boolean;
  /** « …a1B2 » : les 4 derniers caractères de la clé, jamais plus. */
  finCle?: string;
  /** Message court en français (« Clé acceptée », « Clé refusée : vérifiez-la dans Coolify »). */
  message: string;
  testeLe: DateIso;
}

export interface LecteurCredit {
  /** Identifiant du fournisseur, le même que `LigneCout.fournisseur` (« heygen », « fal », « anthropic »…). */
  fournisseur: string;
  nom: string;
  mode: ModeSolde;
  /** Page de recharge du fournisseur (bouton « Recharger »). */
  urlRecharge: string;
  /** Variable d'environnement de la clé (« HEYGEN_API_KEY »…). */
  variableCle: string;
  /** Mode « reel » seulement. */
  lireSolde?(): Promise<LectureSolde>;
  testerConnexion(): Promise<TestConnexion>;
}
