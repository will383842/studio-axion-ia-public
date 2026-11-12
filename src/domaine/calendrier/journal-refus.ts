/**
 * CAL-20 — Journal des refus du calendrier éditorial (fonctions pures).
 * Un refus est noté avec son motif, sa date et son réseau ; rien n'est supprimé.
 * Au 3e refus pour le même motif, une règle est PROPOSÉE au fondateur.
 * Une règle proposée ne s'applique qu'après son accord (garde-fou dans le code).
 */

export type ReseauRefus = "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube" | "autre";

export type Refus = {
  readonly id: string;
  readonly motif: string;
  readonly reseau: ReseauRefus;
  readonly date: Date;
};

export type StatutRegle = "proposee" | "appliquee" | "ecartee";

export type RegleProposee = {
  readonly id: string;
  readonly motif: string;
  readonly nombreRefus: number;
  readonly statut: StatutRegle;
  readonly proposeeLe: Date;
  readonly decideeLe?: Date;
};

export const SEUIL_REGLE_PROPOSEE = 3;

/** Clé de comparaison : sans casse, espaces multiples réduits. */
export function cleMotif(motif: string): string {
  return motif.trim().replace(/\s+/g, " ").toLowerCase();
}

export function compterRefusParMotif(refus: readonly Refus[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of refus) {
    const k = cleMotif(r.motif);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Clés de motif ayant atteint le seuil et pas encore proposées. */
export function motifsAProposer(refus: readonly Refus[], dejaProposes: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const [k, n] of compterRefusParMotif(refus)) {
    if (n >= SEUIL_REGLE_PROPOSEE && !dejaProposes.has(k)) out.push(k);
  }
  return out;
}
