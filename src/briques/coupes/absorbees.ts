/**
 * BRIQUE COUPES — REPRISES ABSORBÉES par l'alignement forcé (mode texte ; cas IMG_7747 v2 du 10/10). PUR.
 *
 * Quand la transcription est un alignement FORCÉ du texte validé sur le son, chaque mot du texte n'existe qu'une fois :
 * une phrase commencée, abandonnée puis redite entièrement n'apparaît pas deux fois. L'aligneur « absorbe » la reprise
 * en étirant des mots (« Si » 1,3 s, « sentez » 3,4 s, « échappe » 3,6 s, de la voix dedans) ou en laissant un trou au
 * milieu d'une phrase. On la retrouve ainsi :
 *  1. mots étirés (bien plus longs que leur nombre de lettres ne le permet) et trous de plus de 1,2 s au milieu d'une
 *     phrase, regroupés quand ils se suivent ; il faut au moins 2,5 s de temps « en trop » pour soupçonner une reprise ;
 *  2. la prise complète finit avec la dernière anomalie : la reprise y est logée. Son point de départ est le début de
 *     la phrase (ou d'une des 2 phrases d'avant) dont le nombre de mots correspond au temps en trop, au débit de la
 *     personne mesuré sur toute la vidéo ; si une transcription LIBRE (Whisper) est fournie, le départ est lu dedans
 *     (dernière occurrence du début de phrase), ce qui est exact ;
 *  3. dans le doute, on GARDE : pas assez de temps en trop, aucun départ plausible (écart de plus de 40 % entre le
 *     nombre de mots estimé et le début de phrase le plus proche), ou départ libre introuvable → rien n'est retiré.
 * Les mots de la phrase reprise sont recalés sur la prise complète (proportionnellement à leurs lettres) : sous-titres
 * et cartes tombent sur la bonne prise, et la première tentative ne contient plus aucun mot (elle devient une `reprise`).
 */
import type { MotHorodate } from "@/domaine/types";
import { finitPhrase, memeMot, tokens } from "./texte";

export const REGLES_ABSORBEES = {
  /** Un mot est étiré au-delà de max(0,9 s, 3 × sa durée attendue). */
  etireMinSec: 0.9,
  etireFacteur: 3,
  /** Trou au milieu d'une phrase (le mot d'avant ne finit pas une phrase). */
  trouMinSec: 1.2,
  /** Temps « en trop » cumulé à partir duquel une reprise est soupçonnée. */
  excesMinSec: 2.5,
  /** Deux anomalies à moins de 3 s font partie de la même zone. */
  regroupementSec: 3,
  /** Phrases d'avant regardées pour le point de départ de la reprise. */
  phrasesAvant: 2,
  /** Écart toléré entre le nombre de mots estimé et le début de phrase retenu (rapport). */
  toleranceMots: 1.4,
  /** Marge laissée avant le départ estimé de la prise complète (on préfère garder un souffle que couper un mot). */
  margeDepartSec: 0.15,
} as const;

/** Durée attendue d'un mot (s) d'après ses lettres : « Si » ≈ 0,16 s, « échappe » ≈ 0,41 s. */
export function dureeAttendue(mot: string): number {
  return 0.06 + 0.05 * mot.replace(/[^\p{L}\p{N}]/gu, "").length;
}

export interface RepriseAbsorbee {
  /** Index (dans les mots triés) du premier et du dernier mot de la phrase reprise. */
  premier: number;
  dernier: number;
  /** Première tentative retirée : du premier mot (temps d'origine) au départ de la prise complète. */
  debutSec: number;
  finSec: number;
  /** Nouveaux temps des mots premier → dernier, sur la prise complète. */
  recalages: { index: number; debutSec: number; finSec: number }[];
  /** Comment le départ a été trouvé. */
  source: "transcription-libre" | "debit";
}

interface Anomalie {
  /** Mot étiré (fin = sa fin) ou mot qui suit un trou (fin = son début). */
  mot: number;
  debutSec: number;
  finSec: number;
  exces: number;
  /** Le mot est étiré (la reprise est logée DANS le mot) ; sinon c'est un trou avant lui. */
  etire: boolean;
}

/** Pas moyen entre deux mots d'une même phrase (débit de la personne), hors anomalies ; 0,24 s par défaut. */
function pasMoyen(mots: MotHorodate[], gardes: number[], exclus: Set<number>): number {
  const pas: number[] = [];
  for (let k = 0; k + 1 < gardes.length; k++) {
    const a = gardes[k];
    const b = gardes[k + 1];
    if (b !== a + 1 || exclus.has(a) || exclus.has(b) || finitPhrase(mots[a].mot)) continue;
    const p = mots[b].debutSec - mots[a].debutSec;
    if (p > 0 && p < 0.8) pas.push(p);
  }
  return pas.length >= 10 ? pas.reduce((s, x) => s + x, 0) / pas.length : 0.24;
}

/**
 * Reprises absorbées dans les mots gardés d'un plan en mode texte.
 * @param gardes index des mots gardés (dans l'ordre) ; @param debutsPhrases index du premier mot de chaque phrase gardée.
 * @param motsLibres transcription libre facultative (Whisper, temps de la prise) : départ exact de la prise complète.
 */
export function reprisesAbsorbees(mots: MotHorodate[], gardes: number[], debutsPhrases: number[], motsLibres?: MotHorodate[], regles = REGLES_ABSORBEES): RepriseAbsorbee[] {
  const anomalies: Anomalie[] = [];
  gardes.forEach((i, k) => {
    const m = mots[i];
    const attendue = dureeAttendue(m.mot);
    const duree = m.finSec - m.debutSec;
    if (duree > Math.max(regles.etireMinSec, regles.etireFacteur * attendue)) anomalies.push({ mot: i, debutSec: m.debutSec, finSec: m.finSec, exces: duree - attendue, etire: true });
    const prec = k > 0 ? gardes[k - 1] : -1;
    if (prec >= 0 && !finitPhrase(mots[prec].mot) && !debutsPhrases.includes(i)) {
      const trou = m.debutSec - mots[prec].finSec;
      if (trou > regles.trouMinSec) anomalies.push({ mot: i, debutSec: mots[prec].finSec, finSec: m.debutSec, exces: trou - 0.3, etire: false });
    }
  });
  if (!anomalies.length) return [];
  anomalies.sort((a, b) => a.debutSec - b.debutSec);
  const zones: Anomalie[][] = [];
  for (const a of anomalies) {
    const z = zones[zones.length - 1];
    if (z && a.debutSec - z[z.length - 1].finSec <= regles.regroupementSec) z.push(a);
    else zones.push([a]);
  }
  const pas = pasMoyen(mots, gardes, new Set(anomalies.filter((a) => a.etire).map((a) => a.mot)));
  const sortie: RepriseAbsorbee[] = [];
  for (const z of zones) {
    if (z.reduce((s, a) => s + a.exces, 0) < regles.excesMinSec) continue;
    const derniere = z[z.length - 1];
    const premiereAnomalie = z[0].mot;
    // Dernier mot de la prise complète : le mot étiré lui-même, ou le mot d'avant le trou.
    const dernierMot = derniere.etire ? derniere.mot : gardes[gardes.indexOf(derniere.mot) - 1];
    if (dernierMot === undefined) continue;
    const finComplete = derniere.finSec;
    // Débuts de phrase candidats : celui de la première anomalie (ou d'avant), jusqu'à 2 phrases plus tôt.
    const avant = debutsPhrases.filter((d) => d <= premiereAnomalie).sort((a, b) => b - a);
    const candidats = avant.slice(0, regles.phrasesAvant + 1).filter((d) => d <= dernierMot);
    if (!candidats.length) continue;
    const nbMots = (d: number) => gardes.filter((i) => i >= d && i <= dernierMot).length;
    let premier: number | undefined;
    let departSec: number | undefined;
    let source: RepriseAbsorbee["source"] = "debit";
    if (motsLibres?.length) {
      // Transcription libre : le début de phrase dit DEUX fois dans la zone ; la prise complète part du dernier.
      for (const d of candidats) {
        const tete = tokens(gardes.filter((i) => i >= d).slice(0, 4).map((i) => mots[i].mot).join(" ")).slice(0, 3);
        const libres = motsLibres.filter((m) => m.debutSec >= mots[d].debutSec - 1.5 && m.debutSec < finComplete).flatMap((m) => tokens(m.mot).map((forme) => ({ forme, debutSec: m.debutSec })));
        const departs = libres.map((_, p) => p).filter((p) => tete.length >= 2 && tete.every((f, k) => p + k < libres.length && memeMot(f, libres[p + k].forme)));
        if (departs.length >= 2) {
          premier = d;
          departSec = libres[departs[departs.length - 1]].debutSec;
          source = "transcription-libre";
          break;
        }
      }
      if (premier === undefined) continue; // la transcription libre ne montre aucune phrase redite : on garde
    } else {
      // Débit : le temps en trop du dernier mot (ou du trou) est celui des mots redits avant lui.
      const estimes = derniere.exces / pas + (derniere.etire ? 1 : 0);
      const meilleur = candidats.map((d) => ({ d, n: nbMots(d) })).sort((a, b) => Math.abs(Math.log(a.n / estimes)) - Math.abs(Math.log(b.n / estimes)))[0];
      if (!meilleur || Math.max(meilleur.n / estimes, estimes / meilleur.n) > regles.toleranceMots) continue;
      premier = meilleur.d;
      departSec = finComplete - meilleur.n * pas - regles.margeDepartSec;
    }
    const redits = gardes.filter((i) => i >= premier! && i <= dernierMot);
    // La prise complète doit commencer APRÈS le début de la première tentative (sinon rien n'a été absorbé).
    if (departSec! <= mots[premier].debutSec + 0.5 || departSec! >= finComplete) continue;
    const poids = redits.map((i) => dureeAttendue(mots[i].mot));
    const total = poids.reduce((s, x) => s + x, 0);
    let t = departSec!;
    const recalages = redits.map((index, k) => {
      const d = t;
      t += ((finComplete - departSec!) * poids[k]) / total;
      return { index, debutSec: +d.toFixed(3), finSec: +(k === redits.length - 1 ? finComplete : t).toFixed(3) };
    });
    sortie.push({ premier: premier!, dernier: dernierMot, debutSec: +mots[premier!].debutSec.toFixed(3), finSec: +departSec!.toFixed(3), recalages, source });
  }
  return sortie;
}
