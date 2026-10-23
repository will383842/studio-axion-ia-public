/**
 * POSE DES CARTES PLEIN ÉCRAN dans les plans d'une composition (brique `motion`, tous les formats) : la carte (MP4
 * déjà rendu par l'opération `composition` sans mode) devient UN plan d'illustration vidéo sur son intervalle, coupe
 * franche à l'entrée et à la sortie. Les plans qu'elle recouvre sont raccourcis. PUR, sans alias « @/ ».
 */
import { PREFIXE_ENTREE, type PlanScene } from "../composition/scene";

export interface CartePleinEcran {
  debutSec: number;
  finSec: number;
  /** Nom de l'entrée de la demande (la clé de stockage est donnée à part). */
  entree: string;
}

export function poserCartesPleinEcran(plans: PlanScene[], cartes: CartePleinEcran[]): PlanScene[] {
  if (!cartes.length || !plans.length) return plans;
  const triees = [...cartes].sort((a, b) => a.debutSec - b.debutSec);
  const sortie: PlanScene[] = [];
  for (const pl of plans) {
    let morceaux: [number, number][] = [[pl.debutSec, pl.finSec]];
    for (const c of triees) morceaux = morceaux.flatMap(([a, b]) => (c.finSec <= a || c.debutSec >= b ? [[a, b] as [number, number]] : ([[a, c.debutSec], [c.finSec, b]] as [number, number][]).filter(([x, y]) => y - x > 1e-3)));
    for (const [a, b] of morceaux) sortie.push({ ...pl, debutSec: +a.toFixed(3), finSec: +b.toFixed(3) });
  }
  const modele = plans[0];
  for (const c of triees) {
    sortie.push({ debutSec: c.debutSec, finSec: c.finSec, type: "illustration", angle: "principal", cadrage: { ...modele.cadrage, zoom: 1, zoomFin: 1 }, illustration: { url: `${PREFIXE_ENTREE}${c.entree}`, video: true }, sansLook: true }); // Lot I : jamais de Look en double
  }
  return sortie.sort((a, b) => a.debutSec - b.debutSec);
}
