/**
 * C11-H5 (effet CAM-02) : courbes d'accélération de la caméra virtuelle. PUR et déterministe, NON BRANCHÉ (le
 * branchement sur `ZoomCamera` est une fiche ultérieure ; jamais de mouvement sur un plan « double », Q7).
 * Les profils se construisent depuis la table commune (`progres`, `courbe`) : aucune courbe écrite ici.
 * Fichier lu par le rendu : imports relatifs seulement.
 */
import { progres } from "../courbes";
import type { NomCourbe } from "../jetons";

export type NomProfilCamera = "accostage" | "travelling" | "poussee-lente";

/** Chaque profil lit une courbe nommée de la table commune. */
const COURBE_DU_PROFIL: Record<NomProfilCamera, NomCourbe> = {
  accostage: "signature",
  travelling: "glisse",
  "poussee-lente": "douce",
};

/** Zoom : échelle toujours dans [1, 1,6]. */
export const ECHELLE_MIN = 1;
export const ECHELLE_MAX = 1.6;

/** Progrès de la caméra (0 → 1, monotone) à l'avancement `t` ∈ [0, 1] (borné ; NaN → 0). */
export function profilCamera(nom: NomProfilCamera, t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (t >= 1) return 1;
  return progres(t, 0, 1, COURBE_DU_PROFIL[nom]);
}

export type PointPct = { x: number; y: number };

/**
 * Point d'un travelling le long d'une courbe de Bézier à 3 (quadratique) ou 4 points (cubique), en %.
 * `t` est l'avancement déjà courbé (voir `profilCamera`), borné à [0, 1]. Passe exactement par les extrémités.
 */
export function trajetSurCourbe(points: readonly PointPct[], t: number): PointPct {
  if (points.length !== 3 && points.length !== 4) throw new Error("trajetSurCourbe : 3 ou 4 points attendus");
  const k = !Number.isFinite(t) || t <= 0 ? 0 : t >= 1 ? 1 : t;
  if (k === 0) return { x: points[0].x, y: points[0].y };
  if (k === 1) {
    const f = points[points.length - 1];
    return { x: f.x, y: f.y };
  }
  const u = 1 - k;
  if (points.length === 3) {
    const [a, b, c] = points;
    return { x: u * u * a.x + 2 * u * k * b.x + k * k * c.x, y: u * u * a.y + 2 * u * k * b.y + k * k * c.y };
  }
  const [a, b, c, d] = points;
  return {
    x: u * u * u * a.x + 3 * u * u * k * b.x + 3 * u * k * k * c.x + k * k * k * d.x,
    y: u * u * u * a.y + 3 * u * u * k * b.y + 3 * u * k * k * c.y + k * k * k * d.y,
  };
}

/** Échelle de la caméra de `debut` à `fin` selon le profil `nom` ; résultat borné à [1, 1,6]. */
export function zoomCamera(debut: number, fin: number, t: number, nom: NomProfilCamera): number {
  const a = Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, debut));
  const b = Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, fin));
  const e = a + (b - a) * profilCamera(nom, t);
  return Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, e));
}
