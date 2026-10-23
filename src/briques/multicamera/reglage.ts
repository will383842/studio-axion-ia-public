/**
 * BRIQUE MULTICAMÉRA — réglage caché `avocat.multicamera` (lot F4). PUR.
 *
 * Absent de l'écran, COUPÉ par défaut. Il s'allume pour toutes les vidéos avocat (`actif`) ou pour une seule vidéo par
 * la consigne « Monteur, fais-le en 3 caméras ». `reel` (faux par défaut) : tant qu'il est faux, tout passe par le
 * double de simulation, même option allumée. Les looks de chaque angle sont gardés par double (préparés une fois).
 */
import { estConsigneTroisCameras } from "./consigne";
import { ANGLES_GENERES, type AngleGenere } from "./types";

export const PARAM_MULTICAMERA_AVOCAT = "avocat.multicamera";
/** Mission H : même réglage caché pour le face caméra (coupé par défaut, même forme, même lecture tolérante). */
export const PARAM_MULTICAMERA_FACECAM = "facecam.multicamera";

/** Réglage caché de la multicaméra d'un format (`<format>.multicamera`). */
export function paramMulticamera(format: "avocat" | "facecam"): string {
  return format === "facecam" ? PARAM_MULTICAMERA_FACECAM : PARAM_MULTICAMERA_AVOCAT;
}

export interface ReglageMulticameraAvocat {
  actif: boolean;
  reel: boolean;
  /** Par double (identifiant chez le fournisseur) : le look de chaque angle fabriqué. */
  looks: Record<string, Partial<Record<AngleGenere, string>>>;
}

export const REGLAGE_MULTICAMERA_PAR_DEFAUT: ReglageMulticameraAvocat = { actif: false, reel: false, looks: {} };

const idSur = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 200;

/** Lecture tolérante : au moindre doute, l'option reste coupée et la simulation reste choisie. */
export function lireReglageMulticamera(brut: unknown): ReglageMulticameraAvocat {
  const o = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const looks: ReglageMulticameraAvocat["looks"] = {};
  if (o.looks && typeof o.looks === "object") {
    for (const [visage, parAngle] of Object.entries(o.looks as Record<string, unknown>)) {
      if (!idSur(visage) || !parAngle || typeof parAngle !== "object") continue;
      const garde: Partial<Record<AngleGenere, string>> = {};
      for (const a of ANGLES_GENERES) {
        const v = (parAngle as Record<string, unknown>)[a];
        if (idSur(v)) garde[a] = v;
      }
      if (Object.keys(garde).length) looks[visage] = garde;
    }
  }
  return { actif: o.actif === true, reel: o.reel === true, looks };
}

/** L'option vaut pour cette vidéo : réglage allumé, ou consigne « 3 caméras » dite au Monteur. */
export function multicameraDemandee(reglage: ReglageMulticameraAvocat, consignes: readonly string[] = []): boolean {
  return reglage.actif || consignes.some(estConsigneTroisCameras);
}
