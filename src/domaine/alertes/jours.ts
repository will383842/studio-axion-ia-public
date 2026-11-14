/**
 * RC-14 : calcul de jours (Paris), pur. Aucune horloge ici : l'instant est toujours fourni par l'appelant.
 */
const JOUR_MS = 86_400_000;
const FORMAT_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Jour de Paris (AAAA-MM-JJ) d'un instant. */
export function jourParis(d: Date): string {
  return FORMAT_PARIS.format(d);
}
function numeroJour(jour: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : Math.round(t / JOUR_MS);
}
/** Nombre de jours de `jour` à partir d'aujourd'hui (négatif = passé), ou null si la date est illisible. */
export function ecartJours(aujourdhui: string, jour: string): number | null {
  const a = numeroJour(aujourdhui);
  const b = numeroJour(jour);
  return a === null || b === null ? null : b - a;
}

/** Vrai si l'écart est dans [0, n] jours (aujourd'hui compris) ; un écart inconnu n'est dans aucune fenêtre. */
export function dansFenetre(ecart: number | null, n: number): boolean {
  return ecart !== null && ecart >= 0 && ecart <= n;
}
