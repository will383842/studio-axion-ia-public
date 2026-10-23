/**
 * BRIQUE MULTICAMÉRA — branchement sur le format avocat (lot F4). PUR.
 *
 * Option COUPÉE par défaut : sans elle, `pisteMulticameraAvocat` rend `null` et l'avocat est monté exactement comme
 * avant. Avec elle, elle rend une couche AU-DESSUS des plans de l'avocat, qui ne choisit que la SOURCE du visage :
 *  - les plans de l'avocat (zooms, cadrages, illustrations, incrustations) ne sont pas touchés : chaque coupe d'angle
 *    est attirée vers une fin de plan, pour que le zoom d'un plan reste sur un seul angle autant que possible ;
 *  - les sous-titres ne bougent pas : les trois angles parlent sur le même son, à la même horloge.
 */
import type { AngleMulticamera, PisteMulticamera } from "./types";
import { realiserMulticamera, RYTHME_MULTICAMERA } from "./realisation";

/** Le strict nécessaire des plans, mots et segments de l'avocat (types structurels : aucun couplage au moteur). */
export interface PlanAvocatMin {
  debutSec: number;
  finSec: number;
}
export interface MotAvocatMin {
  mot: string;
  debutSec: number;
  finSec: number;
  enValeur?: boolean;
  segmentId?: string;
}
export interface SegmentAvocatMin {
  id: string;
  bloc: string;
  emphase?: string[];
}

export interface EntreeMulticameraAvocat {
  /** Réglage `avocat.multicamera` ou consigne « Monteur, fais-le en 3 caméras ». Absent ou faux : rien. */
  actif?: boolean;
  plans: readonly PlanAvocatMin[];
  mots: readonly MotAvocatMin[];
  segments: readonly SegmentAvocatMin[];
  /** Résultat de la fabrication des angles (sources retenues, replis). */
  sources: Partial<Record<AngleMulticamera, string>>;
  replis?: PisteMulticamera["replis"];
  dureeSec?: number;
  rythme?: { minSec: number; maxSec: number };
}

export function pisteMulticameraAvocat(e: EntreeMulticameraAvocat): PisteMulticamera | null {
  if (e.actif !== true || !e.sources.face) return null;
  const blocDe = new Map(e.segments.map((s) => [s.id, s.bloc]));
  const disponibles = (Object.keys(e.sources) as AngleMulticamera[]).filter((a) => !!e.sources[a]);
  const plans = realiserMulticamera({
    mots: e.mots.map((m) => ({ mot: m.mot, debutSec: m.debutSec, finSec: m.finSec, enValeur: m.enValeur, bloc: m.segmentId ? blocDe.get(m.segmentId) : undefined })),
    anglesDisponibles: disponibles,
    dureeSec: e.dureeSec ?? Math.max(0, ...e.plans.map((p) => p.finSec)),
    rythme: e.rythme ?? RYTHME_MULTICAMERA,
    coupesPrefereesSec: e.plans.slice(1).map((p) => p.debutSec),
    emphases: e.segments.flatMap((s) => s.emphase ?? []).flatMap((x) => x.split(/\s+/)),
  });
  return { version: 1, plans, sources: { ...e.sources }, replis: [...(e.replis ?? [])] };
}
