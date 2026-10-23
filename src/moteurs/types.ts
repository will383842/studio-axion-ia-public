/**
 * Contrat des moteurs vidéo (PLAN B.6.3 + AV2.2 ; moteur avocat B.0 §19, B.1).
 * Un moteur ne lit QUE la CommandeFabrication (plus, pour une retouche, le parent fourni par le service) : jamais les dépôts.
 * Il fabrique des objets Travail (purs) ; le service les enregistre et applique le résultat.
 */
import type {
  CommandeFabrication,
  ElementBibliotheque,
  IdReseau,
  LigneCout,
  Montant,
  NoteQualite,
  Piste,
  Plan,
  Ratio,
  RapportQualite,
  SegmentSousTitres,
  Travail,
  TypeTravail,
  VoixBrutePayee,
} from "@/domaine/types";

export interface CapacitesMoteur {
  dureeMaxSec: number;
  ratios: Ratio[];
  langues: string[];
  retoucheParPlan: boolean;
  asynchrone: boolean;
  accordExige: boolean;
  maquette: boolean;
}

export interface DefinitionEtapeMoteur {
  cle: string;
  nom: string;
  /** Nom d'icône (chaîne libre : l'écran fait la correspondance ; un moteur ne dépend d'aucun composant). */
  icone: string;
  dependDe: string[];
  dureeEstimeeSec: number;
  /** Coût estimé de l'étape (affiché étape par étape, B.9). */
  coutEstime?: Montant;
}

export interface Estimation {
  dureeFabricationSec: number;
  lignes: LigneCout[];
  total: Montant;
}

export interface ContexteLancement {
  travailId: string;
  versionId: string;
  type?: TypeTravail;
  titre: string;
  maintenant?: number;
}

export interface SortieProduite {
  ratio: Ratio;
  fichierCle: string;
  vignetteCle: string;
  resolution: string;
  dureeSec: number;
  taille: number;
  rapportQualite: RapportQualite;
  /** Formats par réseau T4 (facultatif) : réseaux pour lesquels ce fichier a été fait (recopié dans `Sortie.reseaux`). */
  reseaux?: IdReseau[];
  /** T4 (facultatif) : fin au mot (vrai), fin propre (faux) ; absent : inconnue (recopié dans `Sortie.appelAuMot`). */
  appelAuMot?: boolean;
}

/** Plan renvoyé par le moteur après redécoupage sur l'audio maître (identité : `segmentId` + instant, B.2). */
export type PlanProduit = Omit<Plan, "id" | "videoId" | "versionId" | "creeLe" | "modifieLe" | "estDemo"> & { segmentId: string };

/** Piste intermédiaire produite (audio maître, master sans texte…), clé de stockage plutôt que fichier. */
export type PisteProduite = Omit<Piste, "id" | "versionId" | "fichierId" | "creeLe" | "modifieLe" | "estDemo"> & { fichierCle: string };

/** Élément de Bibliothèque créé par le moteur (illustration générée et payée), avec sa licence. */
export type ElementCree = Omit<ElementBibliotheque, "id" | "creeLe" | "modifieLe" | "fichierId" | "vignetteFichierId" | "marqueId"> & {
  fichierCle: string;
  vignetteCle?: string;
  /** Plan qui l'utilise (le service y reporte l'élément créé). */
  planOrdre?: number;
};

export interface ResultatFabrication {
  sorties: SortieProduite[];
  noteQualite: NoteQualite;
  lignesReelles: LigneCout[];
  projetMontage: Record<string, unknown>;
  /* --- B.0 §19 : ce que le moteur avocat renvoie en plus (tous facultatifs, le moteur simulé n'en renvoie aucun) --- */
  /** Plans redécoupés : ils REMPLACENT ceux de la version. */
  plans?: PlanProduit[];
  /** Sous-titres à l'horodatage réel : une NOUVELLE version de SousTitres est créée. */
  sousTitres?: SegmentSousTitres[];
  pistes?: PisteProduite[];
  elementsCrees?: ElementCree[];
  /** Lot « intensité » (02/10, D1, ajout pur) : rapport de l'orchestrateur, gardé sur la version. */
  rapportIntensite?: import("@/domaine/types").RapportIntensite;
}

export interface ResultatMaquette {
  /** Absent pour la maquette avocat : elle est composée dans le navigateur, sans fichier vidéo (B.1). */
  fichierCle?: string;
  vignetteCle?: string;
  dureeSec: number;
  plans?: PlanProduit[];
  sousTitres?: SegmentSousTitres[];
  /** La piste `audio-maitre` : réutilisée par la fabrication tant que texte, voix et prononciations n'ont pas changé. */
  pistes?: PisteProduite[];
  lignesReelles?: LigneCout[];
}

/** Opérations typées d'une retouche (« Demander une modification », B.9). */
export type OperationMontage =
  | { type: "remplacerIllustration"; planId: string; elementId?: string; requete?: string }
  | { type: "changerAngle"; planId: string; angle: "trois-quarts" | "face" }
  | { type: "changerCadrage"; planId: string; valeur: "large" | "poitrine" }
  | { type: "deplacerIncrustation"; planId: string; versPlanId: string }
  | { type: "corrigerMot"; segmentSousTitresId: string; indexMot: number; mot: string }
  | { type: "modifierTitre"; texte: string }
  | { type: "refaireSegmentVoix"; segmentId: string; texte?: string }
  | { type: "ajusterRythme"; sens: "plus-rapide" | "plus-lent"; depuisSec?: number; jusquaSec?: number };

/** Ce qui est déjà payé, fourni par le service à partir de VersionVideo et Piste (le moteur ne lit pas les dépôts). */
export interface ParentRetouche {
  versionId: string;
  projetMontage?: Record<string, unknown>;
  /** `ratio` (lot M4, ajout pur) : piste propre à un format d'image (`master-sans-texte`). */
  pistes: { type: Piste["type"]; planId?: string; fichierCle: string; ratio?: Ratio }[];
}

/**
 * Ce que l'estimation d'une retouche peut savoir de plus que les plans choisis (ajout pur : les moteurs qui n'en ont pas
 * besoin l'ignorent). `operations` et `parent` : la retouche par opérations, dont le coût exact se calcule ; `travail` :
 * le travail de retouche déjà lancé (« Réessayer » : ce qu'il a réservé).
 */
export interface ContexteEstimationRetouche {
  operations?: OperationMontage[];
  parent?: ParentRetouche;
  travail?: Travail;
}

export interface MoteurVideo {
  id: string;
  nom: string;
  capacites: CapacitesMoteur;
  estimer(commande: CommandeFabrication): Promise<Estimation>;
  /** Coût d'une retouche : seuls les plans choisis sont repayés (AV2.2-5). */
  estimerRetouche(commande: CommandeFabrication, planIds: string[], contexte?: ContexteEstimationRetouche): Promise<Estimation>;
  /** Coût d'un format d'image ajouté : l'export de ce seul format. */
  estimerReexport(commande: CommandeFabrication, ratio: Ratio): Promise<Estimation>;
  /** Graphe des étapes (dépendances) pour cette commande. */
  etapes(commande: CommandeFabrication): DefinitionEtapeMoteur[];
  lancer(commande: CommandeFabrication, contexte: ContexteLancement): Promise<Travail>;
  /**
   * Lot R7d (facultatif) : refus AVANT toute réservation (message pour Will). Ex. un montage réel avec le double
   * d'essai : « Votre double n'est pas prêt ».
   */
  refusAuLancement?(commande: CommandeFabrication): { code: string; message: string } | null;
  /**
   * Facecam lot G (facultatif) : refus d'une RETOUCHE avant toute réservation (la retouche réelle n'est pas branchée pour
   * cette commande). Absent : seule `capacites.retoucheParPlan` décide, comme avant.
   */
  refusRetouche?(commande: CommandeFabrication): { code: string; message: string } | null;
  /** Fait avancer un travail (simulation : selon l'horloge ; réel : interroge le fournisseur). Jamais d'attente longue. */
  avancer(travail: Travail, commande: CommandeFabrication, maintenant?: number): Promise<{ travail: Travail; resultat?: ResultatFabrication }>;
  /** Ne relance QUE les étapes en échec (et celles qui en dépendent). */
  reessayer(travail: Travail, maintenant?: number): Promise<Travail>;
  /** `consigne` reste pour l'historique ; `operations` et `parent` étendent la retouche sans casser (B.1). */
  retoucher(demande: { commande: CommandeFabrication; contexte: ContexteLancement; planIds: string[]; consigne: string; operations?: OperationMontage[]; parent?: ParentRetouche }): Promise<Travail>;
  /** `parent` et `segments` (lot M4, ajouts purs) : ce qui est déjà fabriqué et les sous-titres courants, recomposés sans rien repayer. */
  reexporter(demande: { commande: CommandeFabrication; contexte: ContexteLancement; cible: { ratio: Ratio } | { reseau: IdReseau }; parent?: ParentRetouche; segments?: SegmentSousTitres[] }): Promise<Travail>;
  /**
   * Maquette rapide, peu coûteuse, avant la vraie fabrication (AV2.3-10). `voixBrute` : son déjà lu et payé par une
   * maquette tombée en panne ensuite ; le moteur le reprend (sans relire la voix) si son empreinte est la bonne.
   * Une maquette qui tombe en panne après la lecture joint à son erreur `lignesPayees` et `voixBrute`.
   */
  maquette(commande: CommandeFabrication, options?: { voixBrute?: VoixBrutePayee }): Promise<ResultatMaquette>;
  /** Recompose seulement l'encadré et les sous-titres sur la piste `master-sans-texte` (coût nul, lot M4). */
  recalquer?(demande: { commande: CommandeFabrication; contexte: ContexteLancement; sousTitresId: string; segments: SegmentSousTitres[]; parent: ParentRetouche }): Promise<Travail>;
  /** « Arrêter » : annule chez le fournisseur si possible ; les étapes terminées restent payées (lot M1b). */
  annuler?(travail: Travail, maintenant?: number): Promise<Travail>;
  /**
   * E2E-1 n° 3 et n° 8 (03/10, ajout pur) : ce qui est DÉJÀ payé pour ce travail, chaque ligne au nom de son vrai
   * fournisseur (la voix payée compte dès qu'elle est lue, même si son étape n'est pas finie). Lu à « Arrêter », à
   * l'échec définitif et pour diminuer la réservation de crédit. Absent : étapes terminées (`lignesDesEtapesPayees`).
   */
  lignesPayees?(travail: Travail, commande: CommandeFabrication): LigneCout[];
  /**
   * Générateur G6 (ajout pur) : ce qu'une version fabriquée offre à une version par réseau (son audio maître, ses mots,
   * le temps de ses segments, ses plans). Lu dans le projet de montage, opaque pour le service. Null : pas de mère.
   */
  mereDeclinaison?(projetMontage: Record<string, unknown> | undefined, ids: { videoId: string; versionId: string }): import("@/domaine/types").MereVariante | null;
}
