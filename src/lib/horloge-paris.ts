/**
 * HORLOGE PARIS : source unique des conversions « jour + heure à Paris » → instant (D6-01). PUR, sans réseau.
 *
 * - Heure inexistante (saut de printemps, ex. 28/03/2027 02:30) : on prend l'heure suivante (03:30) et on avertit.
 * - Heure répétée (retour d'automne, ex. 25/10/2026 02:30) : première occurrence (heure d'été).
 */
import { formateurDate } from "@/lib/intl";

export interface HeureParisResolue {
  /** Instant ISO (UTC). */
  instant: string;
  /** Présent seulement quand l'heure demandée n'existe pas à Paris. */
  avertissement?: string;
}

const HEURE_MS = 3_600_000;

/** Ce que l'horloge de Paris affiche à l'instant donné, relu comme un « faux UTC » (comparable à la saisie). */
function affichageParis(instantMs: number): number {
  const p = Object.fromEntries(
    formateurDate("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(instantMs))
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}

export function resoudreHeureParis(jour: string, heure: string): HeureParisResolue {
  const [a, m, j] = jour.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const mur = Date.UTC(a, m - 1, j, h, mi);
  // Paris est à UTC+1 (hiver) ou UTC+2 (été) : on teste les deux, le plus tôt d'abord (= première occurrence).
  const valides = [mur - 2 * HEURE_MS, mur - HEURE_MS].filter((c) => affichageParis(c) === mur);
  if (valides.length > 0) return { instant: new Date(valides[0]).toISOString() };
  // Heure inexistante : le même décalage d'hiver donne l'heure suivante (02:30 → 03:30).
  return {
    instant: new Date(mur - HEURE_MS).toISOString(),
    avertissement: `${heure} le ${jour} n'existe pas à Paris (changement d'heure) : l'heure suivante est retenue.`,
  };
}

/** « 2026-10-06 » + « 09:00 » à l'heure de Paris → instant ISO. */
export function instantParis(jour: string, heure: string): string {
  return resoudreHeureParis(jour, heure).instant;
}

/** Ajoute (ou retire) des jours calendaires à un jour « AAAA-MM-JJ », sans glissement dû au changement d'heure. */
export function ajouterJoursParis(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}
