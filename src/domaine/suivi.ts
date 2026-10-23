/**
 * SUIVI DE LA FABRICATION (lot M1b, B.9 ter) — fonctions PURES, sans dépôt ni réseau :
 * file d'attente (concurrence, rang, heure de début), reprise automatique après une panne d'un fournisseur,
 * temps restant en minutes et heure de fin, dépense en direct.
 */
import { centimes } from "@/lib/montants";
import type { EtapeTravail, Montant, RepriseTravail, Travail } from "./types";
import { formateurDate } from "@/lib/intl";

/* --- File d'attente ------------------------------------------------ */

/** Vidéos fabriquées en même temps chez les fournisseurs (défaut, réglage `fabrication.concurrence`). */
export const CONCURRENCE_PAR_DEFAUT = 2;

export interface PlaceFile {
  rang: number;
  /** Début estimé (ms epoch). */
  debutEstime: number;
}

/**
 * Répartit les travaux actifs : ceux qu'on fait avancer maintenant, et ceux qui attendent leur tour.
 * - « urgent » passe devant, puis l'ordre de lancement ;
 * - un travail déjà commencé (`en_cours`) n'est jamais remis en attente ;
 * - les exemples (`estDemo`) ne prennent jamais de place et n'attendent jamais.
 */
export function calculerFile(actifs: Travail[], concurrence: number, maintenant: number): { aAvancer: Travail[]; enAttente: Map<string, PlaceFile> } {
  const limite = Math.max(1, Math.floor(concurrence));
  const ordre = [...actifs].sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || a.creeLe.localeCompare(b.creeLe) || a.id.localeCompare(b.id));
  const aAvancer: Travail[] = [];
  const enAttente = new Map<string, PlaceFile>();
  const fins: number[] = [];
  let occupes = 0;
  for (const t of ordre) {
    if (t.estDemo) {
      aAvancer.push(t);
      continue;
    }
    if (t.statut === "en_cours") {
      aAvancer.push(t);
      occupes++;
      fins.push(finEstimee(t, maintenant));
    }
  }
  for (const t of ordre) {
    if (t.estDemo || t.statut === "en_cours") continue;
    if (occupes < limite) {
      aAvancer.push(t);
      occupes++;
      fins.push(finEstimee(t, maintenant));
      continue;
    }
    // Début estimé : la place qui se libère la première, puis on prend la place à son tour.
    fins.sort((a, b) => a - b);
    const debut = Math.max(maintenant, fins.shift() ?? maintenant);
    enAttente.set(t.id, { rang: enAttente.size + 1, debutEstime: debut });
    fins.push(debut + dureeTotale(t));
  }
  return { aAvancer, enAttente };
}

function dureeTotale(t: Travail): number {
  const debut = t.debuteLe ? new Date(t.debuteLe).getTime() : NaN;
  const fin = t.finEstimee ? new Date(t.finEstimee).getTime() : NaN;
  return Number.isFinite(debut) && Number.isFinite(fin) && fin > debut ? fin - debut : 60_000;
}

/* --- Temps restant -------------------------------------------------- */

/**
 * Fin estimée (ms epoch) : celle du moteur tant qu'elle est devant nous ; une fois dépassée, extrapolée
 * à partir du temps réellement passé et de l'avancement (« durées mesurées des étapes passées »).
 */
export function finEstimee(t: Travail, maintenant: number): number {
  const prevue = t.finEstimee ? new Date(t.finEstimee).getTime() : NaN;
  if (Number.isFinite(prevue) && prevue > maintenant) return prevue;
  const debut = t.debuteLe ? new Date(t.debuteLe).getTime() : NaN;
  if (Number.isFinite(debut) && t.progression >= 5 && t.progression < 100) {
    const ecoule = Math.max(0, maintenant - debut);
    return maintenant + Math.round((ecoule * (100 - t.progression)) / t.progression);
  }
  return Number.isFinite(prevue) ? Math.max(prevue, maintenant) : maintenant;
}

/** Minutes restantes, arrondies au-dessus (au moins 1 tant que ce n'est pas fini). */
export function minutesRestantes(t: Travail, maintenant: number): number {
  if (t.statut === "termine" || t.statut === "annule" || t.statut === "echec") return 0;
  return Math.max(1, Math.ceil((finEstimee(t, maintenant) - maintenant) / 60_000));
}

/** « 15 h 40 », heure de Paris. */
export function formaterHeure(ms: number): string {
  const p = formateurDate("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).formatToParts(new Date(ms));
  const h = p.find((x) => x.type === "hour")?.value ?? "00";
  const m = p.find((x) => x.type === "minute")?.value ?? "00";
  return `${Number(h)} h ${m}`;
}

/** Ce qui est déjà dépensé : le coût réel des étapes terminées (centimes). */
export function depenseDesEtapes(etapes: EtapeTravail[]): Montant {
  const c = etapes.filter((e) => e.statut === "terminee").reduce((s, e) => s + (e.coutReel?.centimes ?? 0), 0);
  return centimes(Math.round(c));
}

/* --- Reprise automatique ------------------------------------------- */

/** Délais avant les 3 nouvelles tentatives après une panne (30 s, 2 min, 5 min). */
export const DELAIS_REPRISE_MS = [30_000, 120_000, 300_000] as const;
/** Ensuite : « en attente du fournisseur », relancé toutes les 10 min… */
export const RELANCE_ATTENTE_MS = 10 * 60_000;
/** … pendant 24 h au plus, puis échec avec notification. */
export const ATTENTE_MAX_MS = 24 * 3600_000;

/**
 * Après une panne (5xx, délai dépassé) : prochain essai, passage « en attente du fournisseur », ou abandon.
 * Aucune étape terminée n'est refaite : seule l'interrogation du fournisseur est rejouée.
 */
export function apresPanne(reprise: RepriseTravail | undefined, maintenant: number, message: string): { reprise: RepriseTravail; abandon: boolean } {
  const echecs = (reprise?.echecs ?? 0) + 1;
  const iso = (ms: number) => new Date(ms).toISOString();
  const premiereLe = reprise?.premiereLe ?? iso(maintenant);
  if (echecs <= DELAIS_REPRISE_MS.length) {
    return { reprise: { echecs, premiereLe, prochainEssai: iso(maintenant + DELAIS_REPRISE_MS[echecs - 1]), derniereErreur: message }, abandon: false };
  }
  const attenteDepuis = reprise?.attenteDepuis ?? iso(maintenant);
  const abandon = maintenant - new Date(attenteDepuis).getTime() >= ATTENTE_MAX_MS;
  return { reprise: { echecs, premiereLe, attenteDepuis, prochainEssai: iso(maintenant + RELANCE_ATTENTE_MS), derniereErreur: message }, abandon };
}

/** Le travail peut-il être interrogé maintenant (pas de prochain essai programmé plus tard) ? */
export function peutAvancer(t: Travail, maintenant: number): boolean {
  return !t.reprise || new Date(t.reprise.prochainEssai).getTime() <= maintenant;
}
