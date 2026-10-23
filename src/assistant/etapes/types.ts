/**
 * CONTRAT D'UNE ÉTAPE DE L'ASSISTANT (PLAN B.6.2).
 * Chaque étape est un composant CLIENT autonome qui lit la définition du format
 * (via obtenirFormat(formatId), importable côté client) et modifie le brouillon.
 */
import type { Adresse, BlocScript, BriqueFacultative, Distribution, MentionIA, NoteScript, PostureVisage, Ratio, StylesChoisis } from "@/domaine/types";
import type { ScriptGenere } from "@/fournisseurs";
import type { DonneesExpress } from "@/services/express";
import type { VueElement, VuePersonnage } from "@/services/vues";
import type { CleEtape } from "./meta";

/** État du brouillon tenu par l'assistant (miroir client de Video en statut « brouillon »). */
export interface BrouillonAssistant {
  /** Absent tant que la première étape n'a pas été validée (le brouillon n'existe pas encore en base). */
  videoId?: string;
  formatId: string;
  titre: string;
  sujet: string;
  dureeCibleSec: number;
  ratios: Ratio[];
  scriptId?: string;
  blocs: BlocScript[];
  distribution: Distribution[];
  entrees: Record<string, unknown>;
  reglages: Record<string, unknown>;
  styles: StylesChoisis;
  /** Briques coupées (interrupteurs de l'étape Réglages, AV2.7). */
  briquesCoupees: BriqueFacultative[];
  /** Briques « coupées par défaut » allumées pour cette vidéo (mention IA). */
  briquesAllumees: BriqueFacultative[];
  mentionIA: MentionIA;
  /** Tu ou vous, choisi à chaque vidéo (défaut : « Ma façon de parler »). Pastille Vous / Tu de l'étape Texte. */
  adresse: Adresse;
  /** Assis ou debout (bloc Plateau, lot M3). Absent : la posture du double choisi. */
  posture?: PostureVisage;

  /* --- État CLIENT seulement (jamais enregistré tel quel) --- */
  /** Les 3 versions proposées à l'étape Texte. */
  versions?: ScriptGenere[];
  /** Index de la version choisie parmi `versions`. */
  versionChoisie?: number;
  /** Notes du texte courant (recalculées après chaque retouche). */
  notes?: NoteScript;
  /** Travail de fabrication lancé depuis l'Aperçu. */
  travailId?: string;
}

/** Fichier déposé à l'étape Images (ou rush déposé à l'étape Qui). */
export interface FichierDepose {
  id: string;
  nom: string;
  mime: string;
  url: string | null;
}

/** Données de lecture préparées par la page (sérialisables). */
export interface DonneesAssistant {
  personnages: VuePersonnage[];
  /** Éléments de Bibliothèque utiles à l'assistant (LUT, sous-titres, musiques, habillages, styles, profils de son, illustrations). */
  elements: VueElement[];
  /** Idées récentes : un geste pour remplir le sujet. */
  idees: { id: string; texte: string }[];
  /** Écran « Votre vidéo » (lot M3) : Mes scripts, images du plateau. Absent pour un parcours classique. */
  express?: DonneesExpress;
  /**
   * Claude est relié (correcteur 3, B1 et B10) : le texte s'écrit par le vrai générateur, et la note et « Améliorer »
   * de l'essai (simulés) ne s'affichent pas.
   */
  ecritureReelle?: boolean;
}

export interface ContexteAssistant extends DonneesAssistant {
  /** Enregistre le brouillon maintenant (crée la vidéo au besoin) ; renvoie son id, ou null en cas d'échec. */
  enregistrer: () => Promise<string | null>;
  /**
   * Vrai dès que Will a vraiment saisi quelque chose (ou que le brouillon existe déjà). Tant que c'est faux, rien ne
   * crée de brouillon de soi-même (E2E-1 n° 6) : seuls ses gestes explicites (Fabriquer, Voir les plans, Coût) le font.
   */
  aSaisi?: () => boolean;
}

export interface ProprietesEtape {
  formatId: string;
  brouillon: BrouillonAssistant;
  /** Met à jour le brouillon côté client (l'enregistrement serveur se fait au passage d'étape). */
  modifier: (patch: Partial<BrouillonAssistant>) => void;
  /** Passe à l'étape suivante (enregistre le brouillon). */
  suivant: () => void;
  /** Va directement à une étape (ex. « Fabriquer avec les réglages habituels » → "apercu"). */
  allerA: (cle: CleEtape, options?: { sansEnregistrer?: boolean }) => void;
  /** L'étape est affichée repliée (tout a une valeur par défaut, AV2.4-5). */
  repliee: boolean;
  /** Personnages, éléments de Bibliothèque, idées, et `enregistrer()`. */
  contexte: ContexteAssistant;
  /**
   * Affichage COMPACT dans une feuille du bas de l'écran « Votre vidéo » (lot M3) : mêmes composants, mêmes défauts,
   * sans titre ni action collée en bas (l'écran « Votre vidéo » porte « Fabriquer »).
   */
  compacte?: boolean;
  /** Écran « Votre vidéo » : ouvre une autre feuille (ex. « Corriger » dans Coût ouvre la feuille Script, E2E-1 n° 5). */
  ouvrirFeuille?: (bloc: "script" | "plateau" | "voix" | "style") => void;
}

export interface DefinitionEtape {
  cle: CleEtape;
  /** Composant client de l'étape. */
  Composant: React.ComponentType<ProprietesEtape>;
  /** L'étape peut-elle être validée ? (active le bouton principal) */
  estValide: (b: BrouillonAssistant) => boolean;
  /** Tout a une valeur par défaut : l'étape peut s'afficher repliée en une ligne. */
  aDesValeursParDefaut?: (b: BrouillonAssistant) => boolean;
  /** Résumé en une ligne quand l'étape est repliée (« Williams · Face, chemise noire »). */
  resume?: (b: BrouillonAssistant, donnees: DonneesAssistant) => string;
  /** Ce qui manque, en quelques mots, quand l'étape n'est pas valide (« Choisissez qui parle »). */
  manque?: (b: BrouillonAssistant) => string;
}
