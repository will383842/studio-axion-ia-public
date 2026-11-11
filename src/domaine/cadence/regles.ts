/**
 * RÈGLES DE CADENCE TYPÉES, au-dessus de `reseaux()`. PUR : aucune écriture, aucun réseau.
 *
 * Deux niveaux :
 *  - DUR : plafonds des réseaux et du diffuseur, datés et sourcés ailleurs (fiche L8-01) ; non porté ici.
 *  - CONSEIL : la cadence (rythme par semaine, écart entre deux publications). C'est ce que lit ce fichier,
 *    toujours marqué « conseil » ; « confirmée » seulement si la source de la règle prouve quelque chose.
 * Les valeurs encore inconnues s'écrivent « inconnu » dans les bases et deviennent `null` ici.
 * Les autres modules de cadence lisent ces mêmes constantes.
 */
import { SOURCES_NON_CONFIRMEES, reseaux } from "../../donnees/bases-usine";

export interface RythmeSemaine {
  min: number;
  max: number;
}

export interface RegleCadence {
  code: string;
  reseau: string;
  niveau: "conseil";
  /** Publications par semaine : `null` si inconnu. */
  rythme: RythmeSemaine | null;
  /** Écart minimal entre deux publications, en heures : `null` si inconnu. */
  ecartMinH: number | null;
  /** Faux tant que la source est vide, « inconnu » ou « exemple inventé ». */
  confirmee: boolean;
}

/** « 5-7 » → {min 5, max 7} ; « 4 » → {4, 4} ; tout le reste (« inconnu », « 7-5 », vide) → null. */
export function analyserRythme(texte: string): RythmeSemaine | null {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(texte);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] === undefined ? min : Number(m[2]);
  return max >= min ? { min, max } : null;
}

/** « 3 » → 3 ; « inconnu », vide ou négatif → null. */
export function analyserEcartH(texte: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(texte);
  return m ? Number(m[1].replace(",", ".")) : null;
}

export function estConfirmee(source: string): boolean {
  return !SOURCES_NON_CONFIRMEES.includes(source.trim().toLowerCase());
}

/** Règles de cadence (conseil), toutes ou d'un réseau. */
export function reglesCadence(reseau?: string): RegleCadence[] {
  return reseaux(reseau).map((r) => ({
    code: r.code,
    reseau: r.reseau,
    niveau: "conseil" as const,
    rythme: analyserRythme(r.rythmeMaxSemaine),
    ecartMinH: analyserEcartH(r.ecartMinH),
    confirmee: estConfirmee(r.source),
  }));
}
