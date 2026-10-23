/**
 * ÉVALUATIONS DES RÔLES (plan v5 B.3.1, méthode Anthropic : écrites AVANT la consigne ; lot G4). PUR.
 *
 * Chaque rôle déclare, en tête de son module, la liste de ses évaluations : des vérifications par code de sa sortie,
 * relancées sur les fixtures (sans clé), au banc et à chaque nouvelle version de consigne. Une évaluation renvoie la
 * liste de ses échecs (vide : réussie).
 */

/** Ce qu'une évaluation sait du contexte de l'appel (ids fournis, structures transmises…). */
export interface ContexteEvaluation {
  preuveIds: ReadonlySet<string>;
  matiereIds: ReadonlySet<string>;
  /** Structures transmises par l'étape 0. */
  structures: readonly string[];
  /** Familles d'accroche permises par la recette. */
  famillesPermises: readonly string[];
  /** Ids des accroches finalistes (déclinaisons). */
  finalistes?: readonly string[];
  /** Nombres non prouvés présents dans les matières (« 99 % ») : jamais dits. */
  chiffresNonProuves?: readonly string[];
  /** Blocs du corps permis par la recette. */
  blocsCorps?: readonly string[];
  /** Index des segments « corps » du plan validé (la prose doit tous les écrire). */
  planCorps?: readonly number[];
  /** Appels permis sur le réseau de la déclinaison. */
  appelsPermis?: readonly string[];
}

export interface Evaluation<T> {
  id: string;
  texte: string;
  /** Critique : son échec déclenche UNE reprise ciblée (invention, chiffre non prouvé, sortie inutilisable). Les autres
   *  sont relevées (journal, banc) et corrigées par le code ou par l'étape suivante, sans payer un nouvel appel. */
  critique?: boolean;
  verifier(sortie: T, ctx: ContexteEvaluation): string[];
}

/** Lance toutes les évaluations d'un rôle ; renvoie les échecs « id : détail ». */
export function evaluer<T>(evaluations: readonly Evaluation<T>[], sortie: T, ctx: ContexteEvaluation): string[] {
  return evaluations.flatMap((e) => e.verifier(sortie, ctx).map((m) => `${e.id} : ${m}`));
}

/** Ids cités qui ne sont pas dans les données fournies. */
export function idsInconnus(ids: readonly string[] | undefined, connus: ReadonlySet<string>): string[] {
  return (ids ?? []).filter((x) => !connus.has(x));
}

/** Un texte qui dit un nombre non prouvé. */
export function ditNonProuve(texte: string, ctx: ContexteEvaluation): string[] {
  const n = texte.replace(/\s+/g, " ");
  return (ctx.chiffresNonProuves ?? []).filter((c) => c.trim() && n.includes(c.replace(/\s+/g, " ")));
}
