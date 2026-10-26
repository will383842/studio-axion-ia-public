/**
 * IMAGE → VIDÉO · Ressemblance des SQUELETTES de scènes entre vidéos (PUR, nouveau fichier : `regles.ts` n'est pas touché).
 *
 * Deux vidéos se ressemblent si elles enchaînent les mêmes scènes dans le même ordre. Mesure : moyenne de la part de
 * scènes communes (ensemble) et de la part de paires de scènes consécutives communes (enchaînement), de 0 à 1.
 *
 * POUR LE BRANCHER PLUS TARD dans `regles.ts` (à faire par la personne qui détient ce fichier) :
 *  1. ajouter à `ContexteRegles` un champ `squelettesRecents?: readonly (readonly Scene[])[]` ;
 *  2. dans `verifierScript`, ajouter une règle (par exemple `Q12`, priorité 5, « à corriger par Claude ») qui appelle
 *     `manquementRessemblanceScenes(squeletteDe(fiche), ctx.squelettesRecents ?? [])` et pousse le message s'il n'est pas `null` ;
 *  3. dans `fabrication.ts`, passer `squelettesRecents` (déjà lus par `squelettesRecentsIV`) à `verifierScript`.
 * Tant que ce n'est pas branché, le seul levier actif est la consigne `<a_eviter>` (voir `parcours-varies.ts`).
 */
import type { Scene } from "@/domaine/image-video/fiche";

/** Au-dessus de ce score avec l'une des trois dernières vidéos, le squelette est trop proche. */
export const SEUIL_RESSEMBLANCE_SCENES = 0.8;

const paires = (s: readonly Scene[]) => new Set(s.slice(1).map((x, i) => `${s[i]}>${x}`));

function part(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  const union = new Set([...a, ...b]);
  if (!union.size) return 1;
  let commun = 0;
  for (const x of a) if (b.has(x)) commun++;
  return commun / union.size;
}

/** De 0 (aucune scène ni enchaînement en commun) à 1 (même suite de scènes). Symétrique. */
export function ressemblanceScenes(a: readonly Scene[], b: readonly Scene[]): number {
  return (part(new Set(a), new Set(b)) + part(paires(a), paires(b))) / 2;
}

/** Plus forte ressemblance avec les squelettes récents (0 sans historique). */
export function ressemblanceScenesMax(squelette: readonly Scene[], recents: readonly (readonly Scene[])[]): number {
  return recents.reduce((m, r) => Math.max(m, ressemblanceScenes(squelette, r)), 0);
}

/** Message de refus (français) si le squelette ressemble trop à l'un des récents, sinon `null`. */
export function manquementRessemblanceScenes(squelette: readonly Scene[], recents: readonly (readonly Scene[])[], seuil = SEUIL_RESSEMBLANCE_SCENES): string | null {
  const max = ressemblanceScenesMax(squelette, recents);
  return max >= seuil ? `Le squelette de scènes ressemble trop à celui d'une vidéo récente (${Math.round(max * 100)} %) : changez l'enchaînement des scènes de l'explication.` : null;
}
