/**
 * TYPES DE LA VOIX MAÎTRE (ORG-07a, U-5 partie 1) : le son brut renvoyé par la voix et l'audio maître (son nettoyé +
 * horodatage du texte prononcé). Déplacés tels quels depuis `src/moteurs/montage-avocat/index.ts`, qui les réexporte.
 * La brique ne dépend d'aucun moteur : `PlanProduit` est redéclaré ici à l'identique (même définition que
 * `src/moteurs/types.ts`, égalité vérifiée par `tests/briques/voix-maitre/reexport.test.ts`).
 */
import type { MorceauPlace, Jointure } from "@/briques/declinaison";
import type { CauseApproximation, MotHorodate, Plan, RapportAlignement } from "@/domaine/types";
import type { MesureVoix } from "./reference";

/** Un plan produit par un moteur (copie de `PlanProduit`, `src/moteurs/types.ts`, sans dépendre du moteur). */
type PlanProduit = Omit<Plan, "id" | "videoId" | "versionId" | "creeLe" | "modifieLe" | "estDemo"> & { segmentId: string };

/** Le son brut renvoyé par la voix (texte prononcé). */
export interface AudioBrut {
  fichierCle: string;
  dureeSec: number;
  mots: MotHorodate[];
  coutCentimes: number;
  fournisseur: string;
  caracteres: number;
  /** Lot « calage » (02/10) : les mots ont été recalés sur le son (ou l'horodatage de la voix a été gardé). */
  alignement?: RapportAlignement;
  /** Lot R6 : AVANT le calage, la voix n'a pas donné l'horodatage de ses mots (estimation seulement). */
  motsEstimes?: boolean;
  /** Lot R6 : APRÈS le calage (`versAnalyse`), pourquoi les mots sont restés sur une estimation (absent : ils suivent le son). */
  approximatif?: CauseApproximation;
  /**
   * CORRECTEUR 1 — B2 : son PAYÉ pas encore rangé dans le stockage (`fichierCle` = adresse temporaire du fournisseur) :
   * adresse et identifiant de la demande gardés dès la réponse ; la copie se fait au tour suivant, sans relire la voix.
   */
  copieEnAttente?: { adresse: string; idDemande: string; idExterne: string };
  /** 14/10, voix de référence (ajout pur) : les lectures payées, mesurées, et celle qui a été gardée. */
  ressemblance?: RapportRessemblanceVoix;
}

/** Une lecture payée puis mesurée (contrôle de ressemblance à la voix de référence, 14/10). */
export interface PriseVoixMesuree {
  /** Son brut de cette lecture (rangé dans le stockage). */
  brut: Omit<AudioBrut, "ressemblance" | "copieEnAttente">;
  /** Empreinte de la demande de lecture (une par lecture : `<empreinte du son>#lecture-<n>`). */
  empreinteDemande: string;
  /** `null` : mesure illisible (la prise n'est jamais « ressemblante »). */
  mesure: MesureVoix | null;
  /** 15/10 (ajout pur) : version de la mesure (`VERSION_MESURE_VOIX`) ; absente : 1, mesure d'avant. */
  versionMesure?: number;
  ressemblante: boolean;
  /** Écarts hors tolérance, lisibles (« hauteur +9 % (toléré 8 %) »). */
  ecarts: string[];
}

/** Ce que le contrôle de ressemblance a fait : chaque lecture (son coût, sa mesure) et celle qui a été gardée. */
export interface RapportRessemblanceVoix {
  prises: { empreinteDemande: string; fichierCle: string; coutCentimes: number; caracteres: number; mesure: MesureVoix | null; versionMesure?: number; ressemblante: boolean; ecarts: string[] }[];
  /** Rang de la prise gardée. */
  retenue: number;
  /** La prise gardée est dans la tolérance. */
  ressemblante: boolean;
}

/** L'audio maître : son nettoyé + horodatage du texte prononcé sur ce son. */
export interface AudioMaitre {
  fichierCle: string;
  dureeSec: number;
  mots: MotHorodate[];
  empreinte: string;
  reutilise: boolean;
  coutCentimes: number;
  fournisseur: string;
  caracteres: number;
  coupures: number;
  respirations: number;
  motsParSeconde: number;
  vitesseConseillee: number;
  /** Lot « calage » (02/10, ajout pur) : comment les mots ont été calés (absent : calage sauté, simulation). */
  alignement?: RapportAlignement;
  /** Lot R6 (ajout pur) : les mots ne suivent qu'une estimation → alerte « Sous-titres approximatifs ». */
  sousTitresApproximatifs?: CauseApproximation;
  /** 14/10 (ajout pur) : contrôle de ressemblance à la voix de référence (absent : contrôle coupé ou voix reprise). */
  ressemblance?: RapportRessemblanceVoix;
  /** G6 / G6b (ajouts purs) : son assemblé (version par réseau, prises « je lis »), ses plans et ses raccords. */
  assemble?: boolean;
  plansAssembles?: PlanProduit[];
  morceaux?: MorceauPlace[];
  jointures?: Jointure[];
  /** G6b : la vidéo des prises assemblées (image et son), posée à la place du double. */
  pisteVideo?: string;
}
