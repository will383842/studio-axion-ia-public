/**
 * RÉSERVE DE TUTORIELS · minuterie au rythme (plan PLAN-RESERVE-TUTORIELS-21-11, fiche RES-4). Même modèle que la veille des
 * outils (veille.ts) : démarrée dans `src/instrumentation.ts` par l'instance qui tient le verrou, UNE fois par processus,
 * arrêtée avec lui. Un tour : suivi des éléments pris, puis un tirage « rythme » s'il est dû. Le tirage lui-même (interrupteur,
 * plafonds, devis, prise atomique) est celui de RES-3 : cette minuterie ne décide d'aucune dépense. Ne lève jamais.
 */
import "server-only";
import { cleTirageRythme, tirageDu, type IssueTirage, type LigneHistorique, type ReglagesReserve } from "@/domaine/tutoriel-reserve";
import type { DemandeTirage } from "@/services/tutoriel-reserve-tirage";

// Imports PARESSEUX : ce module est chargé au démarrage du serveur (instrumentation.ts) ; le tirage et le stockage, lourds, ne
// sont chargés qu'au premier tour (2 min plus tard), jamais pendant le démarrage.
const suivreParDefaut = async () => (await import("@/services/tutoriel-reserve-tirage")).suivreElementsPris();
const tirerParDefaut = async (d: DemandeTirage) => (await import("@/services/tutoriel-reserve-tirage")).tirerSuivantReserve(d);
const reglagesParDefaut = async () => (await import("@/services/tutoriel-reserve")).lireReglagesReserve();
const historiqueParDefaut = async () => (await import("@/services/tutoriel-reserve")).historiqueTiragesReserve();

/** Un tour toutes les 10 minutes. */
export const INTERVALLE_RESERVE_MS = 10 * 60_000;
/** Premier tour 2 minutes après le démarrage (la base et la boucle de fond d'abord). */
export const DEPART_RESERVE_MS = 2 * 60_000;

const cle = Symbol.for("studio-axion-ia.reserve-tutoriels");
interface EtatReserveProcessus {
  enCours: boolean;
  minuterie?: ReturnType<typeof setInterval>;
  depart?: ReturnType<typeof setTimeout>;
}
function etatProcessus(): EtatReserveProcessus {
  const g = globalThis as typeof globalThis & { [cle]?: EtatReserveProcessus };
  g[cle] ??= { enCours: false };
  return g[cle];
}

export interface DependancesMinuterieReserve {
  maintenant?: () => Date;
  reglages?: () => Promise<ReglagesReserve>;
  historique?: () => Promise<LigneHistorique[]>;
  suivre?: () => Promise<unknown>;
  tirer?: (d: DemandeTirage) => Promise<IssueTirage>;
}

/**
 * Un tour. Suivi d'abord (une vidéo prête passe « fait », un échec libère la place), puis, si le rythme le demande,
 * un seul tirage « rythme ». Un tour à la fois ; aucune exception ne sort (journal : code seulement).
 */
export async function tourReserve(dep: DependancesMinuterieReserve = {}): Promise<{ tire: boolean; saute: boolean }> {
  const e = etatProcessus();
  if (e.enCours) return { tire: false, saute: true };
  e.enCours = true;
  try {
    try {
      await (dep.suivre ?? suivreParDefaut)();
    } catch {
      console.error("[studio] suivi de la réserve de tutoriels en échec (code RESERVE_SUIVI_ECHEC)");
    }
    const maintenant = (dep.maintenant ?? (() => new Date()))().toISOString();
    const reglages = await (dep.reglages ?? reglagesParDefaut)();
    const historique = await (dep.historique ?? historiqueParDefaut)();
    if (!tirageDu(reglages, historique, maintenant)) return { tire: false, saute: false };
    await (dep.tirer ?? tirerParDefaut)({ declencheur: "rythme", cle: cleTirageRythme(historique, maintenant) });
    return { tire: true, saute: false };
  } catch {
    console.error("[studio] tour de la réserve de tutoriels en échec (code RESERVE_TOUR_ECHEC)");
    return { tire: false, saute: false };
  } finally {
    e.enCours = false;
  }
}

/** Lance la minuterie, UNE fois par processus. Renvoie faux si elle tournait déjà. */
export function demarrerTirageReserve(): boolean {
  const e = etatProcessus();
  if (e.minuterie) return false;
  const tour = () => void tourReserve();
  e.depart = setTimeout(tour, DEPART_RESERVE_MS);
  e.minuterie = setInterval(tour, INTERVALLE_RESERVE_MS);
  e.depart.unref?.();
  e.minuterie.unref?.();
  return true;
}

/** Verrou perdu, ou arrêt : la minuterie s'arrête ; elle repart à la reprise du verrou. */
export function arreterTirageReserve(): void {
  const e = etatProcessus();
  if (e.depart) clearTimeout(e.depart);
  if (e.minuterie) clearInterval(e.minuterie);
  e.depart = undefined;
  e.minuterie = undefined;
}
