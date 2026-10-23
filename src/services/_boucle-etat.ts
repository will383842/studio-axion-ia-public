/**
 * État de la boucle de fond (lot M1b), partagé par le processus (globalThis) : la boucle l'écrit, l'affichage le lit
 * (« Vous pouvez fermer : on vous prévient » n'apparaît que si la boucle tourne). Aucune dépendance.
 */
const cle = Symbol.for("studio-axion-ia.boucle");

export interface EtatBoucle {
  /** Minuterie installée dans ce processus. */
  active: boolean;
  /** Un tour est en cours (le suivant est sauté, jamais mis en file). */
  enCours: boolean;
  toursFaits: number;
  toursSautes: number;
  /** Audit D, B9 : tours abandonnés après le délai global (ils finissent en arrière-plan, protégés). */
  toursAbandonnes: number;
  /** Fin du dernier tour TERMINÉ (réussi ou en erreur) ; un tour abandonné ne la met pas à jour. */
  dernierTour?: number;
  /** Démarrage de la minuterie dans ce processus (`/api/sante` : délai de grâce au démarrage). */
  demarreLe?: number;
  /** Audit D (un seul réplica) : depuis quand cette instance attend le verrou Postgres de la boucle. */
  attenteVerrouDepuis?: number;
  arreter?: () => void;
  /** Arrête l'attente du verrou (minuterie des nouveaux essais). */
  arreterAttente?: () => void;
  /**
   * Relecture paquet 4 (exactitude D1, sécurité P3) : ce processus tient le verrou Postgres de la boucle. Sans lui, la
   * boucle d'écriture Claude (payante) ne démarre jamais ici : l'écriture reste en base, l'instance qui tient le verrou la prend.
   */
  verrouTenu?: boolean;
}

export function etatBoucle(): EtatBoucle {
  const g = globalThis as typeof globalThis & { [cle]?: EtatBoucle };
  g[cle] ??= { active: false, enCours: false, toursFaits: 0, toursSautes: 0, toursAbandonnes: 0 };
  return g[cle];
}

export function boucleActive(): boolean {
  return etatBoucle().active;
}

/** Ce processus tient-il le verrou de la boucle (un seul réplica fait les appels payants de fond) ? */
export function verrouBoucleTenu(): boolean {
  return etatBoucle().verrouTenu === true;
}
