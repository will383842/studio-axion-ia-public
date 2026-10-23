/**
 * ZOOMS DEMANDÉS AU MONTEUR → PLANS (rapport V6, P0 n° 6). PUR.
 *
 * Un zoom demandé (« zoome quand je dis gratuit ») devient un PLAN SERRÉ (130 %) sur son passage, centré sur le même
 * visage que le plan qu'il coupe : le plan d'origine est scindé aux bornes du zoom (jamais au-delà d'une coupe, les
 * plans s'arrêtent déjà aux coupes). C'est un punch-in : coupe franche à l'entrée et à la sortie (grammaire B.19).
 * Le plan qui suit un zoom repasse à 100 % s'il était déjà serré (le zoom reste visible). Un zoom tient au moins
 * `ZOOM_MIN_SEC` (un mot seul ne ferait qu'un éclair) ; un reste de moins de `RESTE_MIN_SEC` est absorbé par le zoom.
 */
import { cadrePour, type CadreSource, type PlanCamera, type TaillePlan } from "./index";

export const ZOOM_TAILLE: TaillePlan = 130;
export const ZOOM_MIN_SEC = 2;
const RESTE_MIN_SEC = 0.4;
const arrondi = (x: number) => +x.toFixed(3);

export interface ZoomDemande {
  /** Temps du montage. */
  debutSec: number;
  finSec: number;
}

/** Centre des yeux d'un plan (fraction de la source), relu sur son cadre. */
function yeuxDu(plan: PlanCamera, source: { largeur: number; hauteur: number }): { yeuxX: number; yeuxY: number } {
  const c: CadreSource = plan.cadre;
  return { yeuxX: (c.x + c.largeur / 2) / source.largeur, yeuxY: (c.y + plan.yeuxHauteur * c.hauteur) / source.hauteur };
}

/** Plans avec les zooms demandés posés (plans d'origine inchangés hors des zooms). Aucun zoom : la liste telle quelle. */
export function appliquerZooms(plans: PlanCamera[], zooms: ZoomDemande[], source: { largeur: number; hauteur: number }, ratio = 9 / 16): PlanCamera[] {
  if (!zooms.length || !plans.length) return plans;
  const fin = plans[plans.length - 1].finSec;
  const plages = zooms
    .map((z) => ({ debutSec: Math.max(0, z.debutSec), finSec: Math.min(fin, Math.max(z.finSec, z.debutSec + ZOOM_MIN_SEC)) }))
    .filter((z) => z.finSec - z.debutSec > 0.2)
    .sort((a, b) => a.debutSec - b.debutSec);
  if (!plages.length) return plans;
  const dansZoom = (t: number) => plages.some((z) => t >= z.debutSec - 1e-6 && t < z.finSec - 1e-6);
  const sortie: PlanCamera[] = [];
  for (const p of plans) {
    // Bornes de découpe à l'intérieur du plan : débuts et fins des zooms ; les restes trop courts sont absorbés.
    const bornes = [p.debutSec, ...plages.flatMap((z) => [z.debutSec, z.finSec]).filter((t) => t > p.debutSec + 1e-6 && t < p.finSec - 1e-6), p.finSec].sort((a, b) => a - b);
    const morceaux: { debut: number; fin: number; zoom: boolean }[] = [];
    for (let k = 0; k + 1 < bornes.length; k++) morceaux.push({ debut: bornes[k], fin: bornes[k + 1], zoom: dansZoom((bornes[k] + bornes[k + 1]) / 2) });
    for (let k = 0; k < morceaux.length; k++) {
      const m = morceaux[k];
      if (m.zoom || m.fin - m.debut >= RESTE_MIN_SEC) continue;
      const voisin = morceaux[k - 1]?.zoom ? morceaux[k - 1] : morceaux[k + 1]?.zoom ? morceaux[k + 1] : null;
      if (voisin) m.zoom = true;
    }
    // Morceaux voisins de même nature fusionnés.
    const fusion: typeof morceaux = [];
    for (const m of morceaux) {
      const d = fusion[fusion.length - 1];
      if (d && d.zoom === m.zoom) d.fin = m.fin;
      else fusion.push({ ...m });
    }
    const yeux = yeuxDu(p, source);
    for (const m of fusion) {
      const taille: TaillePlan = m.zoom ? ZOOM_TAILLE : p.taille;
      const { cadre, yeuxHauteur } = taille === p.taille ? { cadre: p.cadre, yeuxHauteur: p.yeuxHauteur } : cadrePour(taille, yeux, source, ratio);
      const enTete = m.debut <= p.debutSec + 1e-6;
      sortie.push({
        ...p,
        debutSec: arrondi(m.debut),
        finSec: arrondi(m.fin),
        priseDebutSec: arrondi(p.priseDebutSec + (m.debut - p.debutSec)),
        priseFinSec: arrondi(p.priseDebutSec + (m.fin - p.debutSec)),
        taille,
        cadre,
        yeuxHauteur,
        ouverture: enTete ? p.ouverture : "punch-in",
        ...(m.zoom ? { zoomDemande: true } : {}),
      });
    }
  }
  // Un zoom à cheval sur deux plans du même passage gardé (aucune coupe entre eux) reste UN plan serré.
  const fusionnes: PlanCamera[] = [];
  for (const x of sortie) {
    const d = fusionnes[fusionnes.length - 1];
    if (d?.zoomDemande && x.zoomDemande && Math.abs(d.priseFinSec - x.priseDebutSec) < 2e-3) {
      d.finSec = x.finSec;
      d.priseFinSec = x.priseFinSec;
    } else fusionnes.push(x);
  }
  // Le plan qui suit (ou précède) un zoom ne reste pas aussi serré que lui : il repasse à 100 % (le zoom se voit).
  for (let k = 0; k < fusionnes.length; k++) {
    const x = fusionnes[k];
    const voisinZoom = fusionnes[k - 1]?.zoomDemande || fusionnes[k + 1]?.zoomDemande;
    if (x.zoomDemande || !voisinZoom || x.taille !== ZOOM_TAILLE) continue;
    const { cadre, yeuxHauteur } = cadrePour(100, yeuxDu(x, source), source, ratio);
    fusionnes[k] = { ...x, taille: 100, cadre, yeuxHauteur };
  }
  return fusionnes;
}
