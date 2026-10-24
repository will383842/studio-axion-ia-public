/**
 * CAS RETIRÉS (24/10/2026). Will retire un cas de la liste de /cas-concret ; c'est réversible (« Remettre ce cas ») et rien
 * n'est supprimé. PUR : aucun accès au serveur. Un cas est retiré quand `retireLe` existe et que `remisLe` est absent ou plus
 * ancien : la remise est écrite à côté, jamais en effaçant le retrait.
 */

export interface RetraitCas {
  retireLe: string;
  remisLe?: string;
  titre: string;
}

export const PHRASE_CAS_RETIRE = "Ce cas est retiré : il n'est plus proposé. Pour le reprendre : Cas concret MD › Cas retirés › Remettre ce cas.";
export const PHRASE_RELANCE_CAS_RETIRE = "Ce cas est retiré : cette relance est refusée, rien n'est dépensé. Remettez-le d'abord (Cas concret MD › Cas retirés).";

const estDate = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));

/** Retiré maintenant ? `remisLe` plus ancien (ou absent) que `retireLe` : oui ; une remise plus récente : non. */
export function estRetire(r?: Partial<RetraitCas> | null): boolean {
  if (!r || !estDate(r.retireLe)) return false;
  if (!estDate(r.remisLe)) return true;
  return Date.parse(r.remisLe) < Date.parse(r.retireLe);
}

/** Les identifiants retirés d'un réglage lu tel quel : toute entrée mal formée est ignorée. */
export function casRetires(map: Record<string, unknown> | null | undefined): Set<string> {
  const sortie = new Set<string>();
  if (!map || typeof map !== "object" || Array.isArray(map)) return sortie;
  for (const [id, r] of Object.entries(map)) {
    if (r && typeof r === "object" && !Array.isArray(r) && estRetire(r as Partial<RetraitCas>)) sortie.add(id);
  }
  return sortie;
}
