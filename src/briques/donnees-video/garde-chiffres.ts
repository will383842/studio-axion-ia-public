/**
 * GARDE DES CHIFFRES (G4-03) — tout nombre écrit à l'écran ou dit dans la voix vient de la donnée
 * (indicateur, point de série) ou d'un calcul déclaré que le code recalcule lui-même.
 * Pure : aucun accès disque ou réseau. Rien ne l'importe en production (le branchement est G4-12).
 * Analyseur à 4 opérations écrit à la main : pas d'évaluation de code.
 */
import { memeValeur, nombresAffirmes } from "../../domaine/nombres-fr";
import type { TableauDeBord } from "./types";

export interface EvaluationCalculs {
  valeurs: Map<string, number>;
  erreurs: string[];
}

export interface NombreHorsDonnee {
  texte: string;
  brut: string;
  valeur: number;
}

export interface VerdictGarde {
  ok: boolean;
  horsDonnee: NombreHorsDonnee[];
  erreurs: string[];
}

function arrondir(v: number, precision: number): number {
  const f = 10 ** precision;
  return Math.round(v * f) / f;
}

/** Évalue `a + b * 2 …` : jetons séparés par des espaces, priorité `* /` puis `+ -`. Renvoie une erreur en texte. */
function evaluerFormule(formule: string, variables: Map<string, number>): number | string {
  const jetons = formule.trim().split(/\s+/);
  if (jetons.length % 2 === 0) return "formule incomplète";
  const lire = (j: string): number | string => {
    if (/^\d+(?:\.\d+)?$/.test(j)) return Number(j);
    const v = variables.get(j);
    return v === undefined ? `identifiant inconnu « ${j} »` : v;
  };
  // Première passe : * et /.
  const termes: number[] = [];
  const signes: string[] = [];
  const premier = lire(jetons[0]);
  if (typeof premier === "string") return premier;
  let courant = premier;
  for (let i = 1; i < jetons.length; i += 2) {
    const op = jetons[i];
    const droite = lire(jetons[i + 1]);
    if (typeof droite === "string") return droite;
    if (op === "*") courant *= droite;
    else if (op === "/") {
      if (droite === 0) return "division par zéro";
      courant /= droite;
    } else if (op === "+" || op === "-") {
      termes.push(courant);
      signes.push(op);
      courant = droite;
    } else return `opérateur inconnu « ${op} »`;
  }
  termes.push(courant);
  let total = termes[0];
  signes.forEach((s, i) => {
    total = s === "+" ? total + termes[i + 1] : total - termes[i + 1];
  });
  return Number.isFinite(total) ? total : "résultat non fini";
}

/** Recalcule chaque `calculs[].formule` à partir des indicateurs ; un résultat déclaré faux est une erreur. */
export function evaluerCalculs(donnee: TableauDeBord): EvaluationCalculs {
  const variables = new Map<string, number>(donnee.indicateurs.map((i) => [i.id, i.valeur]));
  const valeurs = new Map<string, number>();
  const erreurs: string[] = [];
  for (const c of donnee.calculs) {
    const r = evaluerFormule(c.formule, variables);
    if (typeof r === "string") {
      erreurs.push(`calcul ${c.id} impossible : ${r}`);
      continue;
    }
    valeurs.set(c.id, r);
    if (!memeValeur(r, c.resultat)) erreurs.push(`calcul ${c.id} faux : déclaré ${c.resultat}, recalculé ${r}`);
  }
  return { valeurs, erreurs };
}

/**
 * Valeurs qu'un texte a le droit de citer : indicateurs (telle quelle et arrondie à leur `precision`),
 * points de séries, calculs recalculés (jamais les `resultat` déclarés).
 */
export function nombresPermis(donnee: TableauDeBord): number[] {
  const permis: number[] = [];
  for (const i of donnee.indicateurs) permis.push(i.valeur, arrondir(i.valeur, i.precision));
  for (const s of donnee.series) for (const p of s.points) permis.push(p.valeur);
  const precisionMax = donnee.indicateurs.reduce((m, i) => Math.max(m, i.precision), 0);
  for (const v of evaluerCalculs(donnee).valeurs.values()) permis.push(v, arrondir(v, precisionMax));
  return permis;
}

/**
 * Contrôle les nombres affirmés (liste blanche d'origine exclue) dans chaque texte d'écran ET dans le texte dit.
 * Variante muette : `texteDit` absent ou vide, la garde porte quand même sur `textesEcran`
 * (trou D1-12 b : sans mots, aucune garde jusqu'ici).
 * Pourcentages : la valeur telle qu'écrite (« 35 % » = 35), aucune conversion devinée.
 */
export function garderChiffres(donnee: TableauDeBord, contenu: { textesEcran: string[]; texteDit?: string }): VerdictGarde {
  const { erreurs } = evaluerCalculs(donnee);
  const permis = nombresPermis(donnee);
  const horsDonnee: NombreHorsDonnee[] = [];
  const textes = [...contenu.textesEcran];
  if (contenu.texteDit && contenu.texteDit.trim() !== "") textes.push(contenu.texteDit);
  for (const texte of textes) {
    for (const n of nombresAffirmes(texte)) {
      if (!permis.some((p) => memeValeur(p, n.valeur))) horsDonnee.push({ texte, brut: n.brut, valeur: n.valeur });
    }
  }
  return { ok: horsDonnee.length === 0 && erreurs.length === 0, horsDonnee, erreurs };
}
