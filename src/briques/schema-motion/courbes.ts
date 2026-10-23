/**
 * Courbes de temps des composants « Image → vidéo » (bornage, progrès, sorties douces, rebond). PUR, sans alias « @/ » :
 * lues par le plan des objets (`plan-objets.ts`), donc par `studio-rendu` ET par le contrôle de mise en page du moteur.
 * MÊMES formules que `studio-rendu/compositions/cas-concret/plans/commun.ts` (propriété du cas concret, que `src/` ne
 * peut pas importer) : un test vérifie l'égalité des valeurs.
 */

/** Borne dans [0, 1]. */
export const c01 = (x: number) => Math.max(0, Math.min(1, x));
/** Progrès d'une animation qui commence à `debut` et dure `duree` (s), au temps `t`. */
export const progres = (t: number, debut: number, duree: number) => (duree <= 0 ? (t >= debut ? 1 : 0) : c01((t - debut) / duree));
/** Sortie douce (cubique). */
export const doux = (x: number) => 1 - Math.pow(1 - c01(x), 3);
/** Entrée et sortie douces (cubique). */
export const va = (x: number) => {
  const y = c01(x);
  return y < 0.5 ? 4 * y * y * y : 1 - Math.pow(-2 * y + 2, 3) / 2;
};
/** Petit dépassement puis repos. */
export const rebond = (x: number) => {
  const c = 1.7;
  const y = c01(x);
  return 1 + (c + 1) * Math.pow(y - 1, 3) + c * Math.pow(y - 1, 2);
};
