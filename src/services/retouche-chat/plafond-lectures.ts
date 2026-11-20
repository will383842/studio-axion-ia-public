/**
 * C7-17 : barrière DURE par vidéo du chat de retouche (PUR, ÉTEINT par construction : aucun importeur).
 * Deux contrôles indépendants du mode de budget : un compteur de lectures et « engagé + pire cas × 1,2 ≤ plafond ».
 * Les littéraux d'étape et de préfixe vivent chez l'appelant (S2-07) : ici, des paramètres. Aucun import d'argent.
 */
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { ErreurClaude } from "@/fournisseurs/claude/client";

export const LECTURES_MAX_PAR_VIDEO = 3;
const REFUS = "La limite de cette vidéo pour la lecture des demandes est atteinte : rien n'a été payé.";

export interface DepenseLue {
  lignes: readonly { etape: string }[];
}
export interface ReservationLue {
  travailId?: string;
}
export interface ParamsCompteur {
  etape: string;
  prefixeAppel: string;
  depenses: readonly DepenseLue[];
  reservationsActives: readonly ReservationLue[];
}
export interface DepsLectures {
  etape: string;
  prefixeAppel: string;
  lireDepenses: (videoId: string) => Promise<readonly DepenseLue[]>;
  lireReservationsActives: (videoId: string) => Promise<readonly ReservationLue[]>;
}

/** Lectures déjà faites ou en cours pour la vidéo : dépenses de l'étape + réservations actives du préfixe. */
export function compterLectures(_videoId: string, p: ParamsCompteur): number {
  const faites = p.depenses.filter((d) => d.lignes.some((l) => l.etape.startsWith(p.etape))).length;
  const enCours = p.reservationsActives.filter((r) => !!r.travailId?.startsWith(p.prefixeAppel)).length;
  return faites + enCours;
}

/** Lectures encore permises ; port qui lève ou valeur non finie : 0 (prudent). */
export async function lecturesRestantes(videoId: string, deps: DepsLectures): Promise<number> {
  try {
    const [depenses, reservationsActives] = await Promise.all([deps.lireDepenses(videoId), deps.lireReservationsActives(videoId)]);
    const n = compterLectures(videoId, { etape: deps.etape, prefixeAppel: deps.prefixeAppel, depenses, reservationsActives });
    return Number.isFinite(n) ? Math.max(0, LECTURES_MAX_PAR_VIDEO - n) : 0;
  } catch {
    return 0;
  }
}

/** Demande de réservation : pire cas × 1,2 (marge du Studio), en centimes, arrondi au-dessus. */
export function demandeCentimes(pireUsd: number): number {
  return Math.ceil(pireUsd * 100 * 1.2 - 1e-9);
}

/** Vrai seulement si l'engagé plus la demande tient dans le plafond. Aucune notion d'origine ni de mode de budget. */
export function sousPlafond(e: { engageCentimes: number; plafondUsd: number; pireUsd: number }): boolean {
  const { engageCentimes, plafondUsd, pireUsd } = e;
  if (![engageCentimes, plafondUsd, pireUsd].every(Number.isFinite) || plafondUsd < 0 || pireUsd <= 0) return false;
  return engageCentimes + demandeCentimes(pireUsd) <= Math.round(plafondUsd * 100);
}

/** Vérifie AVANT d'appeler : faux ou exception → refus sans appel ; vrai → un seul appel. */
export function appelSousBarriere(appeler: AppelClaude, verifier: (requete: Parameters<AppelClaude>[0]) => Promise<boolean> | boolean): AppelClaude {
  return async (requete) => {
    let permis = false;
    try {
      permis = (await verifier(requete)) === true;
    } catch {
      permis = false;
    }
    if (!permis) throw new ErreurClaude("requete", REFUS);
    return appeler(requete);
  };
}
