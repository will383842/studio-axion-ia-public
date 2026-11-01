/**
 * IMP-2 — DÉBIT ET PLAFONDS DE L'IMPORT (PURS : horloge passée en paramètre, aucune requête, aucun sommeil).
 *  - 25 requêtes par minute au plus, pause sur Retry-After, jamais de boucle ;
 *  - au plus 20 créations ou promotions par heure et par compte (plafond Zernio : 25) ;
 *  - au plus 90 par jour sur Instagram et Facebook (plafond 100), 45 sur LinkedIn (plafond 50) ;
 *  - grille contrôlée avant chaque lot : jamais plus de 20 publications dans la même heure sur un compte ;
 *  - dates passées interdites : création ≥ maintenant + 3 h, promotion ≥ maintenant + 30 min.
 */
const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

export const REQUETES_PAR_MINUTE = 25;
export const OPERATIONS_PAR_HEURE_ET_COMPTE = 20;
export const OPERATIONS_PAR_JOUR: Readonly<Record<string, number>> = { instagram: 90, facebook: 90, linkedin: 45 };
export const MARGE_CREATION_MS = 3 * HEURE;
export const MARGE_PROMOTION_MS = 30 * MINUTE;
/** Pause maximale acceptée sur un Retry-After (au-delà : le lot s'arrête, jamais de boucle). */
export const PAUSE_MAX_MS = 5 * MINUTE;

const JOUR_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
export const jourParisDe = (t: number): string => JOUR_PARIS.format(new Date(t));

export type GenreDate = "creation" | "promotion";

/** Une date est utilisable si elle est lisible et assez lointaine ; sinon la raison, en phrase simple. */
export function dateUtilisable(dateIso: string | undefined, maintenant: number, genre: GenreDate = "creation"): { ok: true } | { ok: false; raison: string } {
  const t = dateIso ? Date.parse(dateIso) : NaN;
  if (!Number.isFinite(t)) return { ok: false, raison: "date illisible" };
  const marge = genre === "creation" ? MARGE_CREATION_MS : MARGE_PROMOTION_MS;
  if (t < maintenant + marge) return { ok: false, raison: genre === "creation" ? "date à moins de 3 h : reste à Buffer" : "date à moins de 30 min : à reprogrammer" };
  return { ok: true };
}

export interface PostGrille {
  /** Identifiant du post (Buffer) pour le rapport. */
  id: string;
  compte: string;
  reseau: string;
  dateIso: string;
}

export interface ViolationGrille {
  compte: string;
  type: "heure" | "jour";
  detail: string;
  ids: string[];
}

/** Contrôle de la grille d'un lot : fenêtre glissante d'une heure (≤ 20 par compte) et plafond du jour de Paris. */
export function controlerGrille(posts: PostGrille[]): ViolationGrille[] {
  const violations: ViolationGrille[] = [];
  const parCompte = new Map<string, PostGrille[]>();
  for (const p of posts) parCompte.set(p.compte, [...(parCompte.get(p.compte) ?? []), p]);
  for (const [compte, liste] of parCompte) {
    const tries = liste.map((p) => ({ p, t: Date.parse(p.dateIso) })).filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
    // Fenêtre glissante : [t_i, t_i + 1 h[
    let fin = 0;
    const vus = new Set<string>();
    for (let i = 0; i < tries.length; i++) {
      if (fin < i) fin = i;
      while (fin < tries.length && tries[fin].t < tries[i].t + HEURE) fin++;
      if (fin - i > OPERATIONS_PAR_HEURE_ET_COMPTE) {
        const ids = tries.slice(i, fin).map((x) => x.p.id);
        const cle = ids.join("|");
        if (!vus.has(cle)) {
          vus.add(cle);
          violations.push({ compte, type: "heure", detail: `${ids.length} publications dans la même heure (plafond ${OPERATIONS_PAR_HEURE_ET_COMPTE})`, ids });
        }
      }
    }
    const parJour = new Map<string, PostGrille[]>();
    for (const x of tries) {
      const j = jourParisDe(x.t);
      parJour.set(j, [...(parJour.get(j) ?? []), x.p]);
    }
    for (const [jour, l] of parJour) {
      const max = OPERATIONS_PAR_JOUR[l[0].reseau];
      if (max !== undefined && l.length > max) violations.push({ compte, type: "jour", detail: `${l.length} publications le ${jour} (plafond ${max})`, ids: l.map((p) => p.id) });
    }
  }
  return violations;
}

/**
 * Suivi du débit réel d'un lot : requêtes par minute, créations par heure et par compte, créations par jour.
 * `delaiAvant` rend l'attente (ms) à respecter avant la prochaine requête ; 0 = tout de suite. Il ne dort pas.
 */
export class SuiviDebitImport {
  private requetes: number[] = [];
  private operations = new Map<string, number[]>();
  private pauseJusqua = 0;

  /** Pause demandée par Zernio (Retry-After en secondes) : au-delà du maximum, l'appelant arrête le lot. */
  pauseRetryAfter(secondes: number, maintenant: number): { ok: boolean; attenteMs: number } {
    const ms = Math.max(0, Math.ceil(secondes * 1000));
    if (ms > PAUSE_MAX_MS) return { ok: false, attenteMs: ms };
    this.pauseJusqua = Math.max(this.pauseJusqua, maintenant + ms);
    return { ok: true, attenteMs: ms };
  }

  delaiAvant(maintenant: number): number {
    this.requetes = this.requetes.filter((t) => t > maintenant - MINUTE);
    const pause = Math.max(0, this.pauseJusqua - maintenant);
    const debit = this.requetes.length >= REQUETES_PAR_MINUTE ? this.requetes[0] + MINUTE - maintenant : 0;
    return Math.max(pause, debit);
  }

  noterRequete(maintenant: number): void {
    this.requetes.push(maintenant);
  }

  /** Refuse (avec la raison) une création de plus sur ce compte, d'après les créations déjà faites. */
  peutOperer(compte: string, reseau: string, maintenant: number): { ok: true } | { ok: false; raison: string; attenteMs?: number } {
    const l = (this.operations.get(compte) ?? []).filter((t) => t > maintenant - 24 * HEURE);
    const derniereHeure = l.filter((t) => t > maintenant - HEURE);
    if (derniereHeure.length >= OPERATIONS_PAR_HEURE_ET_COMPTE) return { ok: false, raison: "plafond horaire du compte atteint", attenteMs: derniereHeure[0] + HEURE - maintenant };
    const max = OPERATIONS_PAR_JOUR[reseau];
    const jour = jourParisDe(maintenant);
    if (max !== undefined && l.filter((t) => jourParisDe(t) === jour).length >= max) return { ok: false, raison: "plafond du jour atteint" };
    return { ok: true };
  }

  noterOperation(compte: string, maintenant: number): void {
    this.operations.set(compte, [...(this.operations.get(compte) ?? []), maintenant]);
  }
}
