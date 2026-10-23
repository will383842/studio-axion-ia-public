/**
 * VUES renvoyées aux écrans par les services : objets SÉRIALISABLES, avec les adresses
 * des fichiers déjà résolues (les écrans ne manipulent jamais de fichierId).
 * Les écrans importent ces types avec `import type { … } from "@/services/vues"`.
 */
import type {
  ElementBibliotheque,
  EtapeEditoriale,
  EtatLicence,
  IdReseau,
  KitPublication,
  LigneCout,
  Miniature,
  Modele,
  Montant,
  NoteQualite,
  Partage,
  Personnage,
  Plan,
  Publication,
  Ratio,
  Retouche,
  Script,
  Sortie,
  SousTitres,
  StatutVideo,
  Travail,
  VarianteReseau,
  VersionVideo,
  Video,
  Visage,
  Voix,
} from "@/domaine/types";
import type { NomIcone } from "@/components/ui/Icone";
import type { AvertissementReseau } from "@/reseaux";

export interface ResumeFormat {
  id: string;
  nom: string;
  icone: NomIcone;
  statut: "actif" | "bientot" | "masque";
}

export interface VueVideoCarte {
  id: string;
  titre: string;
  format: ResumeFormat;
  statut: StatutVideo;
  /** A une version finie : « Annuler cette vidéo » ne lui est jamais proposé, quel que soit son statut. */
  aVersionFinie: boolean;
  etapeEditoriale?: EtapeEditoriale;
  dureeCibleSec: number;
  /** Durée à afficher : réelle (sortie montée de la version choisie) ou, avant le montage, estimée. */
  dureeSec: number;
  dureeEstimee: boolean;
  ratios: Ratio[];
  ratioPrincipal: Ratio;
  /** Adresse de la vignette (null = brouillon sans image). */
  vignette: string | null;
  /** Adresse de la vidéo principale (null si pas encore fabriquée). */
  video: string | null;
  noteQualite?: number;
  coutReel?: Montant;
  serieId?: string;
  /** Travail en cours ou en échec lié (fabrication, retouche…). */
  travail?: { id: string; statut: Travail["statut"]; progression: number };
  etapeAssistant?: string;
  creeLe: string;
  modifieLe: string;
  estDemo?: boolean;
  /** Date de mise à la corbeille (supprimée 30 jours plus tard). */
  corbeilleLe?: string;
}

export interface VuePlan extends Plan {
  vignette: string | null;
  illustrationVignette?: string | null;
  illustrationNom?: string;
}

export interface VueSortie extends Sortie {
  url: string;
  vignette: string;
}

export interface VueMiniature extends Miniature {
  url: string;
}

export interface VueDistribution {
  role: string;
  source: "double" | "rush";
  personnage?: { id: string; nom: string; photo: string | null; nature: Personnage["nature"] };
  visage?: { id: string; nom: string; angle: string };
  voix?: { id: string; nom: string };
}

export interface VueVideoDetail {
  video: Video;
  carte: VueVideoCarte;
  versions: VersionVideo[];
  versionCourante: VersionVideo | null;
  plans: VuePlan[];
  sorties: VueSortie[];
  sousTitres: SousTitres | null;
  miniatures: VueMiniature[];
  kit: KitPublication | null;
  publications: Publication[];
  partages: Partage[];
  retouches: Retouche[];
  script: Script | null;
  distribution: VueDistribution[];
  travail: VueTravail | null;
  coutLignes: LigneCout[];
  noteQualite?: NoteQualite;
  /** Éléments utilisés dont la licence est à vérifier ou expirée (blocage ambre du kit). */
  licencesABloquer: { id: string; nom: string; etat: EtatLicence }[];
}

export interface VueTravail extends Travail {
  lien: string;
  /** Secondes restantes estimées. */
  resteSec: number;
  /** Minutes restantes (au moins 1 tant que ce n'est pas fini) et heure de fin (« 15 h 40 »), B.9 ter. */
  resteMin: number;
  heureFin?: string;
  /** Déjà dépensé : coût réel des étapes terminées. */
  depense: Montant;
  /** Rang dans la file d'attente et heure de début estimée (seulement pour un travail qui attend son tour). */
  rang?: number;
  debutVers?: string;
  /** Un outil est en panne : la fabrication reprendra toute seule. */
  enAttenteFournisseur: boolean;
  /** Lot « crédits » (ajout pur) : « en attente de crédit » chez ce fournisseur (nom affiché) ; reprise après la recharge. */
  attenteCredit?: string;
  /** Claude est en mode « abonnements » (la reprise attend le renouvellement, pas une recharge). */
  abonnementsClaude?: boolean;
  /** Claude en mode « abonnements » mais aucun compte utilisable : ni renouvellement ni recharge, il faut poser une clé. */
  aucunCompteClaude?: boolean;
  /** La boucle de fond tourne : la fabrication continue téléphone fermé. */
  boucleActive: boolean;
  videoTitre?: string;
  vignette?: string | null;
}

export interface VuePersonnage {
  personnage: Personnage;
  photo: string | null;
  visages: (Visage & { vignette: string | null })[];
  voix: Voix[];
  /** Accord complet (case + document + date) ou personnage non réel. */
  accordValide: boolean;
  /** Peut servir dans une vidéo (au moins un visage et une voix prêts + accord). */
  utilisable: boolean;
  alertes: string[];
}

export interface VueElement extends ElementBibliotheque {
  vignette: string | null;
  url: string | null;
  etatLicence: EtatLicence;
}

export interface VueBudget {
  budget: Montant;
  depense: Montant;
  restant: Montant;
  pourcentage: number;
  seuilConfirmation: Montant;
  parMois: { mois: string; libelle: string; total: Montant }[];
  parPoste: { poste: string; total: Montant }[];
}

export interface VueKitReseau {
  reseau: IdReseau;
  nom: string;
  monogramme: string;
  texte: string;
  motsDiese: string[];
  titre?: string;
  longueurMax: number;
  avertissements: AvertissementReseau[];
  etiquetteIA: string;
  sortieConseillee?: VueSortie;
  /** Formats par réseau T4 : « Fichier envoyé : 4:5 · 1080 × 1350 » (absent : aucun fichier pour ce réseau). */
  fichierEnvoye?: string;
  /** Lot R2 : d'où vient le texte (« Écrit par Claude », version, retouché par vous, texte d'essai intact). */
  origine?: "claude" | "version" | "main" | "essai";
  /** Lot R2 : prix estimé d'un « Réécrire » par Claude (absent : Claude n'est pas choisi, la réécriture est gratuite). */
  prixReecriture?: Montant;
}

export interface VueKit {
  videoId: string;
  reseaux: VueKitReseau[];
  credits: string[];
  avantDePublier: KitPublication["avantDePublier"];
  /** Mention IA active pour cette vidéo : sinon la carte « Avant de publier » n'a que 4 cases. */
  mentionIAActive: boolean;
  /** Bouton « Publier » actif seulement si les cases requises (5, ou 4 sans mention) sont cochées et aucune licence bloquante. */
  publiable: boolean;
  licencesABloquer: VueVideoDetail["licencesABloquer"];
  /** true tant que l'envoi vers Buffer est simulé (pastille « Essai »). */
  envoiSimule: boolean;
  /** TEST-UI-REEL U8 : vidéo d'essai (vidéo de démonstration) : elle ne part jamais sur les réseaux ; la feuille le dit. */
  videoEssai?: boolean;
  /** Générateur (lot G1b) : la version d'où vient la vidéo ; le kit s'ouvre sur SON réseau et la feuille Buffer y est verrouillée. */
  variante?: VueKitVariante;
  /** Équipe 7 : série de la vidéo ; `entete` (« Série · ép. 3 ») ouvre le texte envoyé. */
  serie?: { id: string; nom: string; episode?: number; entete: string };
  /** Équipe 7 : séries proposées dans le sélecteur du kit. */
  series: { id: string; nom: string }[];
  /** Équipe 7 : « Cette vidéo met en avant Axion IA » (pré-cochée d'après le texte tant que Will n'a pas choisi). */
  votreMarque: { cochee: boolean; auto: boolean };
}

/** Version par réseau d'une vidéo du générateur, telle que le kit l'affiche (B.5.3, B.6.11). */
export interface VueKitVariante {
  id: string;
  code: string;
  reseau: IdReseau;
  version: number;
  numero?: number;
  titre: string;
  champs: VarianteReseau["publication"];
}

export interface VueModele extends Modele {
  vignette: string | null;
  format: ResumeFormat;
}

export interface ResultatRecherche {
  /** Générateur (lot G1b) : sujets d'abord, recherche par code exact (« 42 », « 0042-AV-TT », « SAR »). */
  sujets: ElementTrouve[];
  videos: ElementTrouve[];
  scripts: ElementTrouve[];
  idees: ElementTrouve[];
  /** Personnages (E2E-1 n° 17) : « Sophie » retrouve Sophie Lambert. */
  personnages: ElementTrouve[];
  bibliotheque: ElementTrouve[];
}

export interface ElementTrouve {
  id: string;
  titre: string;
  sousTitre?: string;
  lien: string;
  vignette?: string | null;
  icone: NomIcone;
}

/* ================================================================== */
/* LOT G7a (« Programmer les N », B.5.5) : AJOUT EN FIN DE FICHIER       */
/* ================================================================== */

/** Complète `VueKitVariante` (fusion de déclarations) : le sujet de la version, pour « Programmer les versions du sujet ». */
export interface VueKitVariante {
  sujetId?: string;
}
