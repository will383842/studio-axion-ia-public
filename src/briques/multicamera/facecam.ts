/**
 * BRIQUE MULTICAMÉRA — branchement sur le FACE CAMÉRA (mission H). PUR.
 *
 * Même brique que l'avocat, même réalisateur, mêmes contrôles. L'angle de face est la VRAIE vidéo de Will (piste
 * montée et cadrée) ; les angles 2 et 3 sont fabriqués par son double HeyGen sur le MÊME son (celui de la piste
 * montée), donc à la même horloge : sous-titres, cartes et écrans partagés ne bougent pas.
 * Option COUPÉE par défaut (réglage caché `facecam.multicamera`) : sans elle, `null` et rien ne change.
 */
import { realiserMulticamera, RYTHME_MULTICAMERA } from "./realisation";
import type { AngleMulticamera, PisteMulticamera } from "./types";

export interface EntreeMulticameraFacecam {
  /** Réglage `facecam.multicamera` ou consigne « Monteur, fais-le en 3 caméras ». Absent ou faux : rien. */
  actif?: boolean;
  /** Mots de la vidéo MONTÉE (temps du montage). */
  mots: readonly { mot: string; debutSec: number; finSec: number }[];
  /** Vidéo de chaque angle retenu (la face = la piste montée de Will). */
  sources: Partial<Record<AngleMulticamera, string>>;
  replis?: PisteMulticamera["replis"];
  dureeSec: number;
  /**
   * Bornes des passages posés (cartes plein écran, écrans partagés) : une coupe d'angle y est bienvenue, pour qu'un
   * passage reste sur un seul angle.
   */
  coupesPrefereesSec?: number[];
  rythme?: { minSec: number; maxSec: number };
  simulation?: boolean;
}

export function pisteMulticameraFacecam(e: EntreeMulticameraFacecam): PisteMulticamera | null {
  if (e.actif !== true || !e.sources.face) return null;
  const disponibles = (Object.keys(e.sources) as AngleMulticamera[]).filter((a) => !!e.sources[a]);
  const plans = realiserMulticamera({
    mots: e.mots.map((m) => ({ mot: m.mot, debutSec: m.debutSec, finSec: m.finSec })),
    anglesDisponibles: disponibles,
    dureeSec: e.dureeSec,
    rythme: e.rythme ?? RYTHME_MULTICAMERA,
    coupesPrefereesSec: e.coupesPrefereesSec ?? [],
  });
  return { version: 1, plans, sources: { ...e.sources }, replis: [...(e.replis ?? [])], ...(e.simulation ? { simulation: true as const } : {}) };
}

/** Ce que la composition reçoit (brique `composition`, `EntreeComposition.multicamera`) : jamais une clé simulée en réel. */
export function multicameraPourComposition(piste: PisteMulticamera | null | undefined, renduReel: boolean): { plans: PisteMulticamera["plans"]; sources: Partial<Record<"cote" | "contre-plongee", string>> } | undefined {
  if (!piste?.plans.length) return undefined;
  if (piste.simulation && renduReel) return undefined;
  const sources: Partial<Record<"cote" | "contre-plongee", string>> = {};
  if (piste.sources.cote) sources.cote = piste.sources.cote;
  if (piste.sources["contre-plongee"]) sources["contre-plongee"] = piste.sources["contre-plongee"];
  return Object.keys(sources).length ? { plans: piste.plans, sources } : undefined;
}
