/**
 * Interfaces de dépôt (PLAN B.2 « derrière des interfaces Depot… »).
 * V1 : implémentation en mémoire (src/donnees/memoire). Plus tard : Prisma + Postgres,
 * sans toucher aux services ni aux écrans.
 *
 * ⚠️ Seuls les SERVICES (src/services) importent les dépôts. Les écrans, jamais.
 */
import type { EvenementTrace } from "./tracabilite-tableau";
import type { Visuel } from "./visuels/visuel";
import type {
  DepenseEnregistree,
  ElementBibliotheque,
  Evenement,
  EvenementFournisseur,
  Fichier,
  Id,
  Idee,
  IdeeJugee,
  KitPublication,
  Marque,
  Miniature,
  Modele,
  Notification,
  Parametre,
  PageSite,
  Partage,
  Personnage,
  Piste,
  Plan,
  Prononciation,
  Publication,
  RessourceFournisseur,
  Retouche,
  Rush,
  Script,
  Serie,
  Session,
  SousTitres,
  Sortie,
  TentativeConnexion,
  Travail,
  VeilleNouveaute,
  VeilleOutil,
  BilanApprentissage,
  ContexteAxion,
  CorrectionWill,
  ExempleStyle,
  FicheStyle,
  GenerationScript,
  Matiere,
  Preuve,
  RegleDatee,
  ScriptMaitre,
  SessionTournage,
  TourneInterdite,
  VarianteReseau,
  RechargeCredit,
  ReleveSolde,
  ReservationCredit,
  VersionVideo,
  Video,
  Visage,
  Voix,
} from "./types";
import type { TraceScriptTableau } from "./scripts-tableau";

export interface Depot<T extends { id: Id }> {
  /**
   * `projeter` (facultatif) s'applique AVANT la copie : il rend une version allégée de chaque entité retenue (sans ses
   * gros champs inutiles à l'appelant). Le dépôt copie (structuredClone) ce qu'il rend, jamais l'original.
   */
  lister(filtre?: (e: T) => boolean, projeter?: (e: T) => T): Promise<T[]>;
  obtenir(id: Id): Promise<T | null>;
  trouver(filtre: (e: T) => boolean): Promise<T | null>;
  /** Crée ou remplace. Renvoie l'entité enregistrée. */
  enregistrer(entite: T): Promise<T>;
  /** Fusionne les champs et met à jour `modifieLe` si l'entité en a un. */
  modifier(id: Id, patch: Partial<T>): Promise<T>;
  /**
   * Efface pour de bon (true : il existait). Rien n'est purgé automatiquement : seule la suppression MANUELLE d'une
   * vidéo par Will, confirmée, s'en sert (décision du 17/10, `supprimerVideoDefinitivement`). Partout ailleurs : archiver.
   */
  supprimer(id: Id): Promise<boolean>;
  compter(filtre?: (e: T) => boolean): Promise<number>;
}

/** Écritures appliquées ensemble (une transaction avec Postgres) : effacements puis enregistrements. */
export interface LotEcritures {
  supprimer: { collection: keyof Depots; id: Id }[];
  enregistrer: { collection: keyof Depots; entite: { id: Id } }[];
}

export interface Depots {
  marques: Depot<Marque>;
  fichiers: Depot<Fichier>;
  personnages: Depot<Personnage>;
  visages: Depot<Visage>;
  voix: Depot<Voix>;
  prononciations: Depot<Prononciation>;
  elements: Depot<ElementBibliotheque>;
  scripts: Depot<Script>;
  videos: Depot<Video>;
  versions: Depot<VersionVideo>;
  plans: Depot<Plan>;
  pistes: Depot<Piste>;
  retouches: Depot<Retouche>;
  miniatures: Depot<Miniature>;
  sousTitres: Depot<SousTitres>;
  sorties: Depot<Sortie>;
  kits: Depot<KitPublication>;
  publications: Depot<Publication>;
  partages: Depot<Partage>;
  modeles: Depot<Modele>;
  idees: Depot<Idee>;
  /** Comité éditorial : idées de l'Usine jugées (notes, angle, verdict). */
  ideesJugees: Depot<IdeeJugee>;
  series: Depot<Serie>;
  rushs: Depot<Rush>;
  travaux: Depot<Travail>;
  depenses: Depot<DepenseEnregistree>;
  ressourcesFournisseurs: Depot<RessourceFournisseur>;
  evenementsFournisseurs: Depot<EvenementFournisseur>;
  notifications: Depot<Notification>;
  sessions: Depot<Session>;
  tentatives: Depot<TentativeConnexion>;
  parametres: Depot<Parametre>;
  evenements: Depot<Evenement>;
  /** Veille des outils (lot B). */
  veilleOutils: Depot<VeilleOutil>;
  veilleNouveautes: Depot<VeilleNouveaute>;
  /** Source axion-ia.com (03/10) : pages du site connues du studio. */
  pagesSite: Depot<PageSite>;
  /** Crédits des fournisseurs (lot « crédits », 02/10, D2) : recharges déclarées, réservations, relevés des soldes. */
  recharges: Depot<RechargeCredit>;
  reservations: Depot<ReservationCredit>;
  relevesSoldes: Depot<ReleveSolde>;
  /** Générateur de scripts (plan v5 B.2, lot G1a) : 12 collections, vides en production au départ. */
  scriptsMaitres: Depot<ScriptMaitre>;
  variantes: Depot<VarianteReseau>;
  preuves: Depot<Preuve>;
  matieres: Depot<Matiere>;
  exemplesStyle: Depot<ExempleStyle>;
  fichesStyle: Depot<FicheStyle>;
  tournesInterdites: Depot<TourneInterdite>;
  generations: Depot<GenerationScript>;
  bilansApprentissage: Depot<BilanApprentissage>;
  contexteAxion: Depot<ContexteAxion>;
  reglesDatees: Depot<RegleDatee>;
  sessionsTournage: Depot<SessionTournage>;
  /** Traçabilité du tableau animé : événements en ajout seul (`src/domaine/tracabilite-tableau.ts`). */
  tracesTableau: Depot<EvenementTrace>;
  /** Générateur de scripts du tableau animé : une trace par génération, ajout seul. */
  tracesScriptsTableau: Depot<TraceScriptTableau>;
  /** Mémoire de la voix de Will : ce qu'il a changé à la relecture (phrase écrite → phrase validée), ajout seul. */
  correctionsWill: Depot<CorrectionWill>;
  /** Carrousels (V3) : les visuels. */
  visuels: Depot<Visuel>;
}
