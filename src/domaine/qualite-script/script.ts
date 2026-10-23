/**
 * SOCLE QUALITÉ · lecture du script normalisé : mots, phrases et horloge (débit déclaré par la recette → secondes). PUR.
 * Réutilise les outils de texte des contrôles d'Écrire (`controles-script/texte.ts`).
 *
 * Les phrases se lisent sur le texte ENTIER (un écran du cas concret peut couper une phrase en deux) ; chaque mot garde
 * sa ligne et son horaire. Avec un horodatage réel (`debutSec`/`finSec`), les mots de la ligne s'y répartissent.
 */
import { mots as motsDe, normaliser } from "@/domaine/controles-script/texte";
import type { Debit, LigneNormalisee, Partie, ScriptNormalise } from "./types";

export interface MotLu {
  mot: string;
  /** Index de la ligne dans le script. */
  ligne: number;
  /** Rang du mot dans sa ligne. */
  rang: number;
  debutSec: number;
  finSec: number;
}

export interface PhraseLue {
  texte: string;
  /** Mots de la phrase (index dans `Lecture.mots`). */
  premier: number;
  dernier: number;
  nbMots: number;
  debutSec: number;
  finSec: number;
  /** Ligne où la phrase commence. */
  ligne: number;
}

export interface Lecture {
  mots: MotLu[];
  phrases: PhraseLue[];
  dureeSec: number;
  /** Début (s) de chaque ligne. */
  debutLigne: number[];
}

/** Durée d'un mot au débit déclaré (caractères : le mot et son espace, comme `duree-tableau.ts`). */
function dureeMot(mot: string, debit: Debit): number {
  const v = Math.max(0.1, debit.parSeconde);
  return debit.unite === "mots" ? 1 / v : (mot.length + 1) / v;
}

/** Lit le script : chaque mot (lettres ou chiffres) avec sa ligne et son horaire, puis les phrases. */
export function lire(script: ScriptNormalise, debit: Debit): Lecture {
  const mots: MotLu[] = [];
  const debutLigne: number[] = [];
  let t = 0;
  script.lignes.forEach((l, i) => {
    const brut = l.dit.split(/\s+/).filter(Boolean);
    const estimees = brut.map((m) => dureeMot(m, debit));
    const total = estimees.reduce((s, d) => s + d, 0);
    const reel = l.debutSec !== undefined && l.finSec !== undefined && l.finSec > l.debutSec;
    let u = reel ? l.debutSec! : t;
    const facteur = reel && total > 0 ? (l.finSec! - l.debutSec!) / total : 1;
    debutLigne.push(u);
    let rang = 0;
    brut.forEach((m, k) => {
      const d = estimees[k] * facteur;
      // La ponctuation isolée (« : », « ? ») n'est pas un mot lu, mais elle compte dans la phrase précédente.
      if (/[\p{L}\p{N}]/u.test(m)) mots.push({ mot: m, ligne: i, rang: rang++, debutSec: u, finSec: u + d });
      else if (mots.length) mots[mots.length - 1] = { ...mots[mots.length - 1], mot: `${mots[mots.length - 1].mot} ${m}` };
      u += d;
    });
    t = reel ? l.finSec! : u;
  });
  const phrases: PhraseLue[] = [];
  let debut = 0;
  mots.forEach((m, i) => {
    const fin = /[.!?…]["»”)]*$/.test(m.mot) || i === mots.length - 1;
    if (!fin) return;
    const tranche = mots.slice(debut, i + 1);
    phrases.push({ texte: tranche.map((x) => x.mot).join(" "), premier: debut, dernier: i, nbMots: tranche.length, debutSec: tranche[0].debutSec, finSec: m.finSec, ligne: tranche[0].ligne });
    debut = i + 1;
  });
  return { mots, phrases, dureeSec: mots.length ? mots[mots.length - 1].finSec : 0, debutLigne };
}

/** Position d'un instant dans le script (0 à 1). */
export function part(lecture: Lecture, sec: number): number {
  return lecture.dureeSec > 0 ? sec / lecture.dureeSec : 0;
}

/** Les lignes d'une ou plusieurs parties. */
export function lignesDe(script: ScriptNormalise, ...parties: Partie[]): LigneNormalisee[] {
  return script.lignes.filter((l) => parties.includes(l.partie));
}

/** Texte normalisé (minuscules, sans accents) de lignes. */
export function texteNormal(lignes: readonly Pick<LigneNormalisee, "dit">[]): string {
  return normaliser(lignes.map((l) => l.dit).join(" "));
}

/** Mots lus d'un texte (même découpe que les contrôles d'Écrire). */
export const nbMots = (t: string) => motsDe(t).length;

/**
 * Unités de lecture d'une phrase pour la règle « phrase longue » : la phrase coupée aux « : » et « ; » ; une
 * ÉNUMÉRATION (au moins 4 éléments séparés par des virgules, 4 mots au plus chacun) se lit comme une liste, pas comme
 * une phrase (W02 de la v4 : « trier les candidatures, répondre à chacun, relancer… », modèle validé par Will).
 */
export function unitesDeLecture(phrase: string): string[] {
  return phrase
    .split(/\s[:;]\s|[;:]\s/)
    .flatMap((u) => {
      const elements = u.split(/,\s*/).filter((e) => nbMots(e) > 0);
      return elements.length >= 4 && elements.every((e) => nbMots(e) <= 4) ? elements : [u];
    })
    .filter((u) => nbMots(u) > 0);
}

/** Mots de la plus longue unité de lecture d'une phrase. */
export function motsUniteMax(phrase: string): number {
  return Math.max(0, ...unitesDeLecture(phrase).map(nbMots));
}

/** Test d'une expression (texte normalisé, mots entiers). */
export function contient(texteNormalise: string, motif: RegExp): RegExpExecArray | null {
  return motif.exec(texteNormalise);
}
