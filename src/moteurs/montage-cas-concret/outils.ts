/**
 * OUTILS INJECTÉS DU MOTEUR « CAS CONCRET » (tâche M0, plan cas concret § 5). INTERFACES SEULEMENT : aucun code, aucun
 * fournisseur importé. Les services (ou les doubles de test) les fournissent ; les étapes du moteur (écriture, voix,
 * captures, écrans, montage) ne touchent l'extérieur que par eux.
 *
 * Les paramètres des opérations de `studio-rendu` (assemblage avec `tempo`, capture du site) sont REDÉCLARÉS ici : aucun
 * fichier de `src/` n'importe `studio-rendu/`.
 */
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { OutilsMontage } from "@/briques/composition/montage";
import type { FinTable } from "@/briques/fins";
import type { OutilsRenduCartes } from "@/briques/motion/rendu-cartes";
import type { OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import type { BruitageDisponible } from "@/domaine/types";
import type { FaitCas } from "@/formats/cas-concret/cas";
import type { ReseauCas } from "@/formats/cas-concret";
import type { EcranFourni } from "./captures";
import type { MemoireCommuneEcriture } from "./memoire-commune";
import type { EntreeHistorique, Mise } from "./variete";

/** Étapes du moteur (plan § 5), dans l'ordre. */
export const ETAPES_CAS_CONCRET = ["ecriture", "fiche", "captures", "voix", "calage", "ecrans", "montage", "controle"] as const;
export type EtapeCasConcret = (typeof ETAPES_CAS_CONCRET)[number];

/* ------------------------------------------------------------------ */
/* Écriture (appel Claude borné, M3)                                     */
/* ------------------------------------------------------------------ */

/**
 * Réponse d'un appel du rôle, telle que la rend le chemin de dépense du studio. X3 : un rôle SANS schéma (les nôtres) n'a
 * jamais de `donnees` en production (`lireSortie` ne lit que le JSON d'un schéma) : sa réponse est dans `texte` (texte
 * brut de Claude), avec sa raison d'arrêt (`stopReason`, « max_tokens » : coupée). `donnees` : l'objet déjà lu
 * (simulation), lu en premier quand il existe.
 */
export type ReponseAppelEcriture =
  | { ok: true; simule: boolean; donnees?: unknown; texte?: string; stopReason?: string | null; invalide?: string; coutUsd?: number }
  | { ok: false; arret: string; message: string };

/** Réservation d'un appel, au coût PIRE estimé, AVANT l'appel. */
export interface DemandeReservationEcriture {
  appelId: string;
  videoId: string;
  etape: string;
  modele: string;
  coutEstimeUsd: number;
}

export interface OutilsEcriture {
  /** UN appel du rôle fourni (écriture ou reformulation), branché par le service sur le chemin de dépense existant. */
  appeler: (role: DefinitionRole, entree: EntreeRole) => Promise<ReponseAppelEcriture>;
  /** Réserve le coût estimé avant l'appel ; refus → aucun appel. */
  budget: { reserver: (demande: DemandeReservationEcriture) => Promise<{ ok: true } | { ok: false; message: string }> };
  /**
   * X2 : appels détachés. Un appel Claude dure de 60 à 240 s : le passage de la boucle de fond le LANCE sans l'attendre,
   * les passages suivants RELISENT sa réponse (`appels.ts`). Absent : l'appel est attendu dans le passage (essais).
   */
  detache?: AppelsDetaches;
  /**
   * X12 : réponse déjà gardée d'un appel d'écriture passé (n'importe quel lancement), relue SANS rien relancer ni réserver,
   * quelle que soit la consigne de l'époque (journal écrit par une version antérieure du code). `null` : rien de lisible.
   */
  relire?: (appelId: string) => Promise<ReponseAppelEcriture | null>;
  /**
   * Socle de Will (charte, style, preuves, modèles de ton : `services/socle-will.ts`), donné en contexte à chaque appel
   * d'écriture et de reformulation, chargé UNE fois et jamais bloquant (`undefined` : écriture comme avant).
   */
  socle?: () => Promise<EntreeRole["contexte"] | undefined>;
  /**
   * Lot C4 · mémoire anti-copie COMMUNE (`services/memoire-cas-concret.ts`, réglage `ecriture.memoireCasConcret`, coupé par
   * défaut). Absent, ou « rien » : l'écriture est identique octet pour octet.
   */
  memoireCommune?: MemoireCommuneEcriture;
}

/** Réponses des appels détachés, gardées HORS du passage (elles survivent à un redémarrage du studio). */
export interface AppelsDetaches {
  /** Lance l'appel SANS l'attendre ; sa réponse (ou sa panne, en phrase) est gardée sous `cle` quand il finit. */
  lancer: (cle: string, appel: () => Promise<ReponseAppelEcriture>) => void | Promise<void>;
  /** Réponse gardée sous `cle` ; `null` : pas encore arrivée. */
  lire: (cle: string) => Promise<ReponseAppelEcriture | null>;
}

/* ------------------------------------------------------------------ */
/* Voix (M4)                                                             */
/* ------------------------------------------------------------------ */

/** Un morceau de son assemblé : de `deSec` à `aSec` du fichier rangé sous la clé `entree`. */
export interface MorceauAssemblage {
  entree: string;
  deSec: number;
  aSec: number;
}

/** Assemblage d'une sortie son (opération `assemblage` de `studio-rendu`, sortie `wav`, option `tempo` de 0,90 à 1,25). */
export interface DemandeAssemblage {
  /** Identifiant de la demande (même identifiant = même travail repris). */
  id: string;
  /** Clé de stockage du WAV produit. */
  sortieCle: string;
  morceaux: MorceauAssemblage[];
  fonduMs?: number;
  tempo?: number;
  /**
   * Recette de la voix (X4) : le corps et la fin BRUTS raccordés puis traités ensemble par l'opération `nettoyage-audio`
   * (mode `recette`) au lieu de l'assemblage ; `corps` et `fin` sont les clés des deux sons (`audio`, `audio2`),
   * `parametres` ceux de `parametresRaccord`, `dureeSec` la durée calculée du son final.
   */
  recette?: { corps: string; fin: string; parametres: Record<string, unknown>; dureeSec: number };
}

export interface ResultatAssemblage {
  cle: string;
  dureeSec: number;
  /** Mesures rendues par l'opération (`tempo`, `dureeAvantTempoSec`…). */
  mesures: Record<string, number>;
}

export interface PauseAMesurer {
  deSec: number;
  aSec: number;
}

/**
 * Outils de la voix maître fournis par l'appelant, plus ce que la voix du format demande en propre. Vue COMPLÈTE lue par
 * la voix (`voix.ts`) ; la chaîne en reçoit une partie (`OutilsVoixFournis`) et pose le reste.
 */
export type OutilsVoixCasConcret = Pick<OutilsVoixMaitre, "voix" | "stockage" | "aligneur" | "rendu" | "renduEstSimule" | "idVoix" | "reglages" | "tauxUsdEur" | "fournisseurVoix" | "caler" | "regles" | "erreurStockage" | "ressemblance" | "mesureVoix"> & {
  /** Clé de stockage d'un fichier de la voix (une par prise). */
  cle: (nom: string) => string;
  /**
   * Assemble le corps et une fin en un seul son (avec le tempo du format). Rendu soumis mais pas fini : lève
   * `RenduEnCours` (fabriquer.ts), relu au passage suivant sous le même identifiant.
   */
  assembler: (demande: DemandeAssemblage) => Promise<ResultatAssemblage>;
  /** Niveau (dB) de chaque blanc d'une prise rangée sous `cle`, dans l'ordre des pauses. Pas fini : `RenduEnCours`. */
  mesurerPauses: (cle: string, pauses: readonly PauseAMesurer[]) => Promise<number[]>;
  /**
   * V4-1 : octets d'un son WAV rangé sous `cle` (prise brute ou voix assemblée), pour mesurer ses blancs et le contrôle
   * de la fin de la voix ; `null` (ou absent) : rien à lire, ni coupes recalées ni contrôle (rendu simulé).
   */
  lireSon?: (cle: string) => Promise<Uint8Array | null>;
  /** Reformule une phrase rejetée, mêmes nombres, pas plus de mots (un appel borné, M3). */
  reformuler: (phrase: string, faits: readonly FaitCas[]) => Promise<{ ok: true; phrase: string } | { ok: false; raison: string }>;
};

/**
 * Ce que les services fournissent pour la voix (M8). La chaîne pose elle-même `reformuler` (rôle borné de `ecriture.ts`,
 * branché sur `OutilsFabricationCasConcret.ecriture`), les faits du cas et `avantLecture` (budget vérifié et réservé
 * juste avant chaque lecture payante) : ce que `avancerVoixCasConcret` attend en plus (`OutilsAvancerVoix`).
 */
export type OutilsVoixFournis = Omit<OutilsVoixCasConcret, "reformuler">;

/* ------------------------------------------------------------------ */
/* Captures du vrai site (M6)                                            */
/* ------------------------------------------------------------------ */

/** Paramètres de l'opération `capture-site` (après C3), redéclarés. */
export interface ParametresCaptureSite {
  type: "image" | "video" | "page-entiere";
  format: "9:16" | "16:9" | "1:1";
  mouvement: "defilement" | "survol" | "frappe";
  dureeSec: number;
  cible?: string;
  saisies?: { champ: string; texte: string }[];
  cocher?: string[];
  survoler?: string;
  sansMesure?: boolean;
}

export interface DemandeCapture {
  id: string;
  /** Adresse du site (https://axion-ia.com/ seulement). */
  page: string;
  parametres: ParametresCaptureSite;
  /** Clé de stockage, par empreinte de la demande. */
  cle: string;
}

export type ResultatCapture =
  | { ok: true; cle: string; mime: string; mesures: Record<string, number> }
  | { ok: false; raison: string; reessayable: boolean };

export interface OutilsCaptures {
  /** Une capture ; rendu soumis mais pas fini : lève `RenduEnCours` (fabriquer.ts), relue au passage suivant. */
  capturer: (demande: DemandeCapture) => Promise<ResultatCapture>;
  /** Une capture est-elle déjà déposée sous cette clé ? (jamais refaite) */
  existe: (cle: string) => Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/* Fabrication (M8)                                                      */
/* ------------------------------------------------------------------ */

/** Estimation de la dépense de voix, montrée et réservée AVANT la lecture payante. */
export interface EstimationVoixCasConcret {
  caracteres: number;
  centimes: number;
}

/**
 * Un son de la banque écouté et validé par Will (`BruitageDisponible` de la commande), avec son fichier : la chaîne le
 * pose dans les médias de la composition. Aucun son validé : vidéo sans bruitages.
 */
export interface BruitageValideCasConcret extends BruitageDisponible {
  /** Clé du fichier dans le stockage. */
  cle: string;
  mime: string;
}

/** Ce qui vient de l'extérieur et que les étapes lisent. */
export interface ContexteFabricationCasConcret {
  /** Date du jour, AAAA-MM-JJ. */
  aujourdhui: string;
  /** Mots interdits de Will (en plus de ceux du format et du cas). */
  interdits: readonly string[];
  reseaux: readonly ReseauCas[];
  /** Table des fins passée à `suiteDeFins` (`TABLE_FINS_DIAGNOSTIC`). */
  tableDesFins: readonly FinTable[];
  /** Bruitages validés (aucun : vidéo sans bruitages), avec une clé que le rendu peut lire. */
  bruitagesValides: readonly BruitageValideCasConcret[];
  /** Bruitages retirés (fichier illisible par le rendu), en phrases : la vidéo se fabrique sans eux. */
  bruitagesRetires?: readonly string[];
  /** Essai seulement : étape qui échoue à son premier essai et réussit au suivant. */
  panneDEssai?: EtapeCasConcret;
  /**
   * V4-3 : un script écrit par Claude (cas sans script validé) n'est pas fabriqué tant que Will ne l'a pas validé : la
   * chaîne s'arrête après la relecture, AVANT toute voix (`PHRASE_SCRIPT_A_VALIDER`). Posé par les services.
   */
  exigerScriptValide?: boolean;
  /**
   * P2C · images déposées par Will pour les étapes dont l'écran est derrière une connexion (`ecransFournisDuCas`) : ces
   * étapes ne demandent aucune capture, l'image masquée prend leur place. Absent : aucune.
   */
  ecransFournis?: readonly EcranFourni[];
}

/**
 * L2 · variété : l'historique des tirages (réglage `casConcret.historiqueTirages`, 42 lignes) et la mise d'une version
 * précédente de la même vidéo. Une panne de ces outils ne bloque jamais la fabrication (tirage sans historique).
 */
export interface OutilsVariete {
  /** Les dernières lignes de l'historique, de la plus ancienne à la plus récente. */
  lireHistorique: () => Promise<readonly EntreeHistorique[]>;
  /** Ajoute la ligne de cette vidéo (remplace celle qu'elle avait), 42 lignes au plus. */
  ajouter: (entree: EntreeHistorique) => Promise<void>;
  /** Mise déjà écrite dans la fiche d'une version précédente de la vidéo ; `null` : aucune. */
  miseHeritee?: (videoId: string) => Promise<Mise | null>;
}

/** Tout ce que la chaîne reçoit. `J` : le journal de fabrication (défini par la chaîne). */
export interface OutilsFabricationCasConcret<J = unknown> {
  voix: OutilsVoixFournis;
  /** Rendu des écrans (un fichier par écran, clé par empreinte). */
  scenes: OutilsRenduCartes;
  /** Rendu, signature des adresses, clés des sorties de la composition (une par fin). */
  montage: Omit<OutilsMontage, "recette">;
  captures: OutilsCaptures;
  ecriture: OutilsEcriture;
  journal: { lire: () => Promise<J | null>; ecrire: (j: J) => Promise<void> };
  budget: {
    /** Centimes d'euro par caractère lu par la voix. */
    tarifCentimesParCaractere: number;
    /** Contrôle ET réservation, juste avant la lecture payante ; lever l'interdit. */
    verifierEtReserver: (estimation: EstimationVoixCasConcret) => Promise<void>;
    /**
     * 17/10 : la part « voix » du prix confirmé (posée par le moteur, d'après la commande) et le prix estimé d'une
     * lecture : une lecture qui le ferait dépasser n'est pas faite. Absent : aucun plafond propre.
     */
    plafondVoix?: { centimes: number; prixLecture: (texte: string) => number };
  };
  contexte: ContexteFabricationCasConcret;
  /** L2 · variété (absent : aucun tirage, la fiche reste telle quelle, rendu v4). */
  variete?: OutilsVariete;
}
