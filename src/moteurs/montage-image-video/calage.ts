/**
 * IMAGE → VIDÉO · Calage du script sur la voix (lot L11, plan 50 § 1 [8]). PUR, déterministe.
 *
 * La voix est déjà assemblée par L12 : ses mots sont sur l'horloge de la PISTE VOIX SEULE (blancs resserrés, raccord
 * corps + fin, tempo ×1,05 appliqué). Le calage relie chaque mot écrit de la fiche (écran par écran, puis le segment de
 * fin : question de commentaire et phrases de la banque) au mot horodaté qui le dit. Alignement par plus longue suite
 * commune sur les mots comparables (minuscules, sans accents ni ponctuation) : un mot que l'aligneur a coupé ou fusionné
 * autrement prend une heure interpolée entre ses voisins calés. Trop de mots sans heure = la voix ne suit pas le script :
 * refus (jamais une mise en scène calée au hasard).
 *
 * Les heures SIMULÉES (débit de référence 3,4 mots/s, § 3) servent aux tests et au banc sans dépense.
 */
import type { MotHorodate } from "@/domaine/types";
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { motsDits, type FicheImage } from "@/domaine/image-video/fiche";
import { texteCompare } from "@/domaine/controles-script/texte";

/** Part minimale des mots écrits retrouvés dans la voix (le reste est interpolé). */
export const PART_CALEE_MIN = 0.9;

/** Un mot écrit, calé sur la voix. */
export interface MotCale {
  /** Le mot tel qu'écrit dans la fiche. */
  mot: string;
  debutSec: number;
  finSec: number;
  /** Faux : heure interpolée (le mot n'a pas été retrouvé tel quel dans la voix). */
  cale: boolean;
}

/** Les mots d'un écran de la fiche, calés. */
export interface EcranCaleIV {
  id: string;
  mots: MotCale[];
}

export interface CalageIV {
  ecrans: EcranCaleIV[];
  /** Mots du segment de fin (question puis phrases de la banque) ; vide sur LinkedIn (muet). */
  fin: MotCale[];
  /** Mots de la voix tels quels (sous-titres). */
  voix: MotHorodate[];
  /** Part des mots écrits retrouvés dans la voix. */
  partCalee: number;
}

export class ErreurCalageIV extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurCalageIV";
  }
}

/** Forme comparable d'un mot : « l'objet » = « l objet », « Quatre-vingts » = « quatre vingts ». */
export function cleMot(m: string): string {
  return texteCompare(m).replace(/['’-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Plus longue suite commune entre deux listes de clés : paires d'indices alignés, dans l'ordre. */
function alignement(a: readonly string[], b: readonly string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  const L: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const paires: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      paires.push([i, j]);
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return paires;
}

/**
 * Cale une suite de mots écrits sur des mots horodatés. Un mot non retrouvé prend une heure interpolée entre ses voisins
 * calés (au prorata de son rang) ; avant le premier ou après le dernier calé, il suit au débit moyen.
 */
export function calerMots(ecrits: readonly string[], voix: readonly MotHorodate[], debutSec = 0, finSec?: number): MotCale[] {
  if (ecrits.length === 0) return [];
  const paires = alignement(ecrits.map(cleMot), voix.map((m) => cleMot(m.mot)));
  const parEcrit = new Map(paires.map(([i, j]) => [i, voix[j]]));
  const fin = finSec ?? (voix.length ? voix[voix.length - 1].finSec : debutSec + ecrits.length / DEBIT_MOTS_PAR_SEC);
  const pas = 1 / DEBIT_MOTS_PAR_SEC;
  const res: MotCale[] = [];
  for (let i = 0; i < ecrits.length; i++) {
    const v = parEcrit.get(i);
    if (v) {
      res.push({ mot: ecrits[i], debutSec: v.debutSec, finSec: v.finSec, cale: true });
      continue;
    }
    let a = i - 1;
    while (a >= 0 && !parEcrit.has(a)) a--;
    let b = i + 1;
    while (b < ecrits.length && !parEcrit.has(b)) b++;
    // Trou de `n` mots entre deux mots calés (ou les bords) : chacun prend une part égale de l'intervalle.
    const n = b - a - 1;
    const tA = a >= 0 ? parEcrit.get(a)!.finSec : debutSec;
    const tB = b < ecrits.length ? parEcrit.get(b)!.debutSec : Math.max(tA + n * pas, Math.min(fin, tA + n * pas));
    const largeur = Math.max(0.05, (tB - tA) / n);
    const debut = tA + (i - a - 1) * largeur;
    res.push({ mot: ecrits[i], debutSec: arrondi(debut), finSec: arrondi(debut + largeur * 0.85), cale: false });
  }
  return res;
}

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** Texte dit du segment de fin d'une version : question puis phrases de la banque (même ordre que la voix, L12). */
export function motsDeLaFin(fin: { question?: { dit: string }; appels: readonly { dit: string }[] } | null | undefined): string[] {
  if (!fin) return [];
  return [fin.question?.dit ?? "", ...fin.appels.map((a) => a.dit)].flatMap((t) => motsDits(t.trim()));
}

/**
 * Cale la fiche (corps) et le segment de fin sur les mots de la piste voix seule. `motsCorps` = nombre de mots de la
 * voix qui appartiennent au corps (L12) : les suivants sont ceux de la fin. Refus si moins de 90 % des mots écrits sont
 * retrouvés.
 */
export function calerFiche(
  fiche: Pick<FicheImage, "ecrans">,
  voix: { mots: readonly MotHorodate[]; motsCorps: number },
  fin?: { question?: { dit: string }; appels: readonly { dit: string }[] } | null,
): CalageIV {
  const corpsVoix = voix.mots.slice(0, voix.motsCorps);
  const finVoix = voix.mots.slice(voix.motsCorps);
  const parEcran = fiche.ecrans.map((e) => motsDits(e.texteDit));
  const ecrits = parEcran.flat();
  const corps = calerMots(ecrits, corpsVoix, 0, corpsVoix.length ? corpsVoix[corpsVoix.length - 1].finSec : undefined);
  const ecritsFin = motsDeLaFin(fin);
  const debutFin = corps.length ? corps[corps.length - 1].finSec : 0;
  const motsFin = calerMots(ecritsFin, finVoix, finVoix.length ? finVoix[0].debutSec : debutFin);
  const total = corps.length + motsFin.length;
  const cales = corps.filter((m) => m.cale).length + motsFin.filter((m) => m.cale).length;
  const partCalee = total ? cales / total : 0;
  if (total === 0) throw new ErreurCalageIV("Le script n'a aucun mot à caler sur la voix.");
  if (partCalee < PART_CALEE_MIN) {
    throw new ErreurCalageIV(`La voix ne suit pas le script : ${Math.round(partCalee * 100)} % des mots seulement s'y retrouvent (${PART_CALEE_MIN * 100} % au moins). Relancez l'alignement de la voix.`);
  }
  let k = 0;
  const ecrans = fiche.ecrans.map((e, i) => {
    const mots = corps.slice(k, k + parEcran[i].length);
    k += parEcran[i].length;
    return { id: e.id, mots };
  });
  return { ecrans, fin: motsFin, voix: [...voix.mots], partCalee };
}

/* ------------------------------------------------------------------ */
/* Heures simulées (tests, banc sans dépense)                            */
/* ------------------------------------------------------------------ */

/** Mots horodatés réguliers, au débit donné (3,4 mots/s par défaut), à partir de `departSec`. */
export function heuresSimulees(textes: readonly string[], options: { debit?: number; departSec?: number } = {}): MotHorodate[] {
  const pas = 1 / (options.debit ?? DEBIT_MOTS_PAR_SEC);
  let t = options.departSec ?? 0.2;
  const res: MotHorodate[] = [];
  for (const m of textes.flatMap((x) => motsDits(x))) {
    res.push({ mot: m, debutSec: arrondi(t), finSec: arrondi(t + pas * 0.85) });
    t += pas;
  }
  return res;
}

/** Piste voix simulée d'une version (forme lue de `PisteVoixSeuleIV`, L12) : corps puis fin, au débit de référence. */
export function pisteSimulee(
  fiche: Pick<FicheImage, "ecrans">,
  fin?: { question?: { dit: string }; appels: readonly { dit: string }[] } | null,
  options: { debit?: number; departSec?: number; blancFinSec?: number } = {},
): { mots: MotHorodate[]; motsCorps: number; dureeSec: number; finVoixSec: number } {
  const corps = heuresSimulees(fiche.ecrans.map((e) => e.texteDit), options);
  const pas = 1 / (options.debit ?? DEBIT_MOTS_PAR_SEC);
  const departFin = (corps.length ? corps[corps.length - 1].debutSec + pas : 0) + 0.3;
  const finMots = heuresSimulees([motsDeLaFin(fin).join(" ")], { ...options, departSec: departFin });
  const mots = [...corps, ...finMots];
  const finVoixSec = mots.length ? mots[mots.length - 1].finSec : 0;
  return { mots, motsCorps: corps.length, dureeSec: arrondi(finVoixSec + (options.blancFinSec ?? 0.5)), finVoixSec };
}
