/**
 * REPORT DE L'HORODATAGE SUR LE TEXTE VALIDÉ (B.5). PUR.
 * Le texte affiché est TOUJOURS celui du script validé, mot pour mot (chiffres en chiffres) ; l'horodatage vient de
 * la voix. Quand le moteur a déjà reporté les temps (moteur avocat, `montage-avocat/report.ts`), les deux listes ont
 * le même nombre de mots et le report est direct. Sinon (découpage différent du fournisseur, mot ajouté ou retiré),
 * les deux suites sont alignées (distance d'édition sur les mots normalisés) : un mot validé sans équivalent prend
 * une part du temps entre ses voisins, un mot entendu sans équivalent allonge le mot validé qui le précède.
 */
import type { MotHorodate } from "@/domaine/types";

/** Durée au plus (s) d'un mot de tête ou de fin sans équivalent entendu. */
const DUREE_MOT_SANS_EQUIVALENT_SEC = 0.3;
/** Durée minimale (s) voulue par mot de tête quand la place manque. */
const DUREE_MIN_MOT_SEC = 0.08;

function forme(mot: string): string {
  return mot
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/€/g, "eur")
    .replace(/[^a-z0-9]/g, "");
}

/** Alignement (Needleman-Wunsch simplifié) : pour chaque mot validé, l'index du mot entendu, ou -1. */
function aligner(valides: string[], entendus: string[]): number[] {
  const n = valides.length;
  const m = entendus.length;
  const a = valides.map(forme);
  const b = entendus.map(forme);
  const cout: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const egal = a[i - 1] === b[j - 1] ? 0 : 1;
      cout[i][j] = Math.min(cout[i - 1][j - 1] + egal, cout[i - 1][j] + 1, cout[i][j - 1] + 1);
    }
  }
  const lien = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const egal = a[i - 1] === b[j - 1] ? 0 : 1;
    if (cout[i][j] === cout[i - 1][j - 1] + egal) {
      lien[i - 1] = j - 1;
      i--;
      j--;
    } else if (cout[i][j] === cout[i - 1][j] + 1) i--;
    else j--;
  }
  return lien;
}

/** Les mots [de, a) se partagent [debut, fin] au prorata de leurs lettres. */
function partager(sortie: (MotHorodate | null)[], mots: string[], de: number, a: number, debut: number, fin: number): void {
  const poids = (k: number) => Math.max(1, forme(mots[k]).length);
  let total = 0;
  for (let k = de; k < a; k++) total += poids(k);
  let t = debut;
  for (let k = de; k < a; k++) {
    const part = ((fin - debut) * poids(k)) / total;
    sortie[k] = { mot: mots[k], debutSec: +t.toFixed(3), finSec: +(t + part).toFixed(3) };
    t += part;
  }
}

/**
 * Horodatage des mots VALIDÉS (`motsValides`, dans l'ordre) depuis les mots ENTENDUS horodatés.
 * `enValeur` est recalculé par l'appelant ; le texte rendu est exactement `motsValides`.
 */
export function reporterSurTexteValide(motsValides: string[], entendus: MotHorodate[]): MotHorodate[] {
  if (!motsValides.length) return [];
  if (entendus.length === motsValides.length) {
    return motsValides.map((mot, i) => ({ mot, debutSec: entendus[i].debutSec, finSec: entendus[i].finSec }));
  }
  // Aucun mot entendu : chaque mot reçoit une durée (jamais 0-0, la ligne ne serait jamais dessinée).
  if (!entendus.length) return motsValides.map((mot, i) => ({ mot, debutSec: +(i * DUREE_MOT_SANS_EQUIVALENT_SEC).toFixed(3), finSec: +((i + 1) * DUREE_MOT_SANS_EQUIVALENT_SEC).toFixed(3) }));
  const lien = aligner(motsValides, entendus.map((e) => e.mot));
  const sortie: (MotHorodate | null)[] = motsValides.map((mot, i) => (lien[i] >= 0 ? { mot, debutSec: entendus[lien[i]].debutSec, finSec: entendus[lien[i]].finSec } : null));
  // Mots entendus sans équivalent, entre deux mots validés voisins : le premier s'allonge jusqu'à eux.
  for (let i = 0; i < sortie.length; i++) {
    const s = sortie[i];
    if (!s) continue;
    const suivant = i + 1 < sortie.length ? lien[i + 1] : entendus.length;
    if (suivant >= 0 && suivant - 1 > lien[i]) s.finSec = Math.max(s.finSec, entendus[suivant - 1].finSec);
  }
  // Mots validés sans temps : part égale de l'intervalle entre leurs voisins horodatés (mots entendus non liés
  // compris). S'il n'y a pas de place, ils partagent le temps du mot précédent.
  let i = 0;
  while (i < sortie.length) {
    if (sortie[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < sortie.length && !sortie[j]) j++;
    if (i === 0 && j < sortie.length) {
      // Mots de tête sans équivalent : étalés AVANT le premier mot entendu (0,3 s au plus chacun, sans descendre sous 0) ;
      // faute de place, ils partagent la durée du premier mot.
      const premierMot = sortie[j]!;
      if (premierMot.debutSec >= DUREE_MIN_MOT_SEC * j) {
        const part = Math.min(DUREE_MOT_SANS_EQUIVALENT_SEC, premierMot.debutSec / j);
        for (let k = 0; k < j; k++) sortie[k] = { mot: motsValides[k], debutSec: +(premierMot.debutSec - (j - k) * part).toFixed(3), finSec: +(premierMot.debutSec - (j - k - 1) * part).toFixed(3) };
      } else {
        const fin = premierMot.finSec > premierMot.debutSec ? premierMot.finSec : premierMot.debutSec + DUREE_MIN_MOT_SEC * (j + 1);
        partager(sortie, motsValides, 0, j + 1, premierMot.debutSec, fin);
      }
      i = j;
      continue;
    }
    if (j === sortie.length && i > 0) {
      // Mots de fin sans équivalent : étalés après le dernier mot entendu (0,3 s au plus chacun).
      const debut = sortie[i - 1]!.finSec;
      for (let k = i; k < j; k++) sortie[k] = { mot: motsValides[k], debutSec: +(debut + (k - i) * DUREE_MOT_SANS_EQUIVALENT_SEC).toFixed(3), finSec: +(debut + (k - i + 1) * DUREE_MOT_SANS_EQUIVALENT_SEC).toFixed(3) };
      i = j;
      continue;
    }
    let debut = i > 0 ? sortie[i - 1]!.finSec : entendus[0].debutSec;
    const fin = j < sortie.length ? sortie[j]!.debutSec : Math.max(entendus.at(-1)!.finSec, debut);
    let premier = i;
    if (fin - debut < 0.08 * (j - i) && i > 0) {
      premier = i - 1;
      debut = sortie[i - 1]!.debutSec;
    }
    const part = Math.max(0, fin - debut) / (j - premier);
    for (let k = premier; k < j; k++) {
      const d = debut + (k - premier) * part;
      sortie[k] = { mot: motsValides[k], debutSec: +d.toFixed(3), finSec: +(d + part).toFixed(3) };
    }
    i = j;
  }
  return sortie as MotHorodate[];
}
