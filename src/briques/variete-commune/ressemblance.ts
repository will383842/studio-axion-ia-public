/**
 * Ressemblance pondérée entre deux empreintes visuelles (E2-ANTI-REPETITION, X2-03). PUR : ni date, ni hasard, ni réseau.
 * Aucun appelant (tout éteint). Poids repris de `moteurs/montage-image-video/variete/ressemblance.ts`.
 */
import type { AxeCommun, EmpreinteVideo } from "./types";

/** Ce que l'œil remarque : poids de chaque axe. */
export const POIDS_COMMUNS: Readonly<Record<AxeCommun, number>> = Object.freeze({
  ouverture: 3,
  palette: 2,
  habillage: 2,
  sousTitres: 2,
  recit: 2,
  transitions: 1.5,
  objets: 1.5,
  camera: 1.5,
  typo: 1,
  fin: 1,
  sons: 1,
  dosage: 1,
} as Record<AxeCommun, number>);

/** Une nouvelle vidéo reste STRICTEMENT sous ce score avec chaque voisine. */
export const SEUIL_COMMUN = 0.5;

/** Nombre minimal d'axes comptés ; en dessous, aucun score. */
const MIN_AXES_COMPTES = 4;

/** Valeurs sans effet visible (liste de X2-02 non encore livrée : vide). */
export const NEUTRES: readonly string[] = Object.freeze([]);

export interface ResultatRessemblance {
  score: number | null;
  axesCommuns: AxeCommun[];
}

/** De 0 (rien de commun) à 1 (identiques) ; `null` si moins de 4 axes comptés. Symétrique, ne modifie pas ses entrées. */
export function ressemblance(a: EmpreinteVideo, b: EmpreinteVideo, neutres: readonly string[] = NEUTRES): ResultatRessemblance {
  let commun = 0;
  let total = 0;
  let comptes = 0;
  const axesCommuns: AxeCommun[] = [];
  for (const axe of Object.keys(POIDS_COMMUNS) as AxeCommun[]) {
    const va = a.axes[axe];
    const vb = b.axes[axe];
    if (!va || !vb) continue;
    const sa = new Set(va.filter((v) => !neutres.includes(v)));
    const sb = new Set(vb.filter((v) => !neutres.includes(v)));
    if (sa.size === 0 && sb.size === 0) continue;
    let inter = 0;
    for (const v of sa) if (sb.has(v)) inter++;
    const part = inter / (sa.size + sb.size - inter);
    const poids = POIDS_COMMUNS[axe];
    comptes++;
    total += poids;
    commun += poids * part;
    if (inter > 0) axesCommuns.push(axe);
  }
  if (comptes < MIN_AXES_COMPTES) return { score: null, axesCommuns };
  return { score: commun / total, axesCommuns };
}
