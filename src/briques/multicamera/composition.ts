/**
 * BRIQUE MULTICAMÉRA — pose de la piste multicaméra dans les plans d'une composition (mission H, tous les formats). PUR,
 * sans alias « @/ ».
 *
 * La piste multicaméra est une couche AU-DESSUS des plans du format : elle ne choisit que la SOURCE du visage. Chaque
 * plan « double » est coupé aux instants des plans de caméra ; un morceau montré de côté ou en contre-plongée porte
 * `camera`, la face reste la piste principale (aucun champ : comportement d'avant). Le zoom d'un plan reste continu :
 * chaque morceau reçoit le zoom qu'avait le plan à ses bornes (zoom lent linéaire, comme `zoomAuTemps`), il s'applique
 * donc sur l'angle montré. Illustrations, cartes et écrans partagés ne sont pas touchés.
 */
import type { CameraScene, PlanScene } from "../composition/scene";
import type { AngleMulticamera, PlanCamera } from "./types";

/** Ce que la composition reçoit : les plans de caméra et la clé de chaque angle fabriqué retenu. */
export interface MulticameraComposition {
  plans: Pick<PlanCamera, "angle" | "debutSec" | "finSec">[];
  sources: Partial<Record<CameraScene, string>>;
}

const zoomA = (p: PlanScene, t: number) => {
  const d = Math.max(1e-6, p.finSec - p.debutSec);
  const k = Math.min(1, Math.max(0, (t - p.debutSec) / d));
  return p.cadrage.zoom + (p.cadrage.zoomFin - p.cadrage.zoom) * k;
};

/** Angle montré à l'instant t (face hors des plans de caméra). */
function angleA(plans: MulticameraComposition["plans"], t: number): AngleMulticamera {
  for (const p of plans) if (t >= p.debutSec - 1e-6 && t < p.finSec - 1e-6) return p.angle;
  return "face";
}

/**
 * Plans de la scène avec la source du visage de chaque morceau. Un angle sans source (écarté au contrôle) reste de
 * face. Sans plan de caméra ou sans source : plans inchangés (même objet).
 */
export function poserPlansCamera(plans: PlanScene[], m: MulticameraComposition | undefined): PlanScene[] {
  if (!m?.plans.length || !plans.length || !Object.values(m.sources).some(Boolean)) return plans;
  const coupes = [...new Set(m.plans.flatMap((p) => [p.debutSec, p.finSec]).map((x) => +x.toFixed(3)))].sort((a, b) => a - b);
  const sortie: PlanScene[] = [];
  for (const pl of plans) {
    if (pl.type !== "double") {
      sortie.push(pl);
      continue;
    }
    const bornes = [pl.debutSec, ...coupes.filter((x) => x > pl.debutSec + 1e-3 && x < pl.finSec - 1e-3), pl.finSec];
    for (let i = 0; i + 1 < bornes.length; i++) {
      const [a, b] = [bornes[i], bornes[i + 1]];
      const angle = angleA(m.plans, (a + b) / 2);
      const camera = angle !== "face" && m.sources[angle] ? angle : undefined;
      const morceau: PlanScene = bornes.length === 2 ? { ...pl } : { ...pl, debutSec: +a.toFixed(3), finSec: +b.toFixed(3), cadrage: { ...pl.cadrage, zoom: +zoomA(pl, a).toFixed(5), zoomFin: +zoomA(pl, b).toFixed(5) } };
      // Un écran partagé coupé garde sa carte à l'instant juste (la suite n'entre pas une seconde fois).
      if (pl.ecranPartage && i > 0) morceau.ecranPartage = { ...pl.ecranPartage, entreeImages: 0, carteDebutSec: +(pl.ecranPartage.carteDebutSec + (a - pl.debutSec)).toFixed(3) };
      if (camera) morceau.camera = camera;
      // Deux morceaux voisins sur la même source et le même cadrage se recollent.
      const prec = sortie.at(-1);
      if (prec && i > 0 && prec.type === "double" && prec.camera === morceau.camera && !morceau.ecranPartage && !prec.ecranPartage && Math.abs(prec.finSec - morceau.debutSec) < 1e-3 && bornes.length > 2) {
        prec.finSec = morceau.finSec;
        prec.cadrage = { ...prec.cadrage, zoomFin: morceau.cadrage.zoomFin };
        continue;
      }
      sortie.push(morceau);
    }
  }
  return sortie;
}

/** Part de la durée montrée sur chaque angle (contrôle, journal). */
export function partsDesAngles(m: MulticameraComposition, dureeSec: number): Record<AngleMulticamera, number> {
  const parts: Record<AngleMulticamera, number> = { face: 0, cote: 0, "contre-plongee": 0 };
  let couvert = 0;
  for (const p of m.plans) {
    const d = Math.max(0, Math.min(dureeSec, p.finSec) - Math.max(0, p.debutSec));
    const a = p.angle !== "face" && !m.sources[p.angle] ? "face" : p.angle;
    parts[a] += d;
    couvert += d;
  }
  parts.face += Math.max(0, dureeSec - couvert);
  return parts;
}
