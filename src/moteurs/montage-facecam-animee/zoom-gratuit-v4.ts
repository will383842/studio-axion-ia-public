/**
 * C8-Z09a : zoom gratuit de la v4, partie pure. Rien ne l'importe.
 * Le zoom ne touche jamais une plaquette (ni son entrée ni sa sortie).
 * Valeurs PROVISOIRES, réglées sur la planche avant/après C8-Z10 montrée à Williams (W-F : oui sur planche).
 * 0 € : un recadrage FFmpeg, aucun fournisseur.
 */
import { fenetresPermises } from "../../briques/zoom-gratuit/regles";
import type { Exclusion, FenetreZoom, OptionsZoom } from "../../briques/zoom-gratuit/types";

export const PARAM_ZOOM_GRATUIT_FA = "facecamAnimee.zoomGratuit";

/** Seul `true` exact allume ; toute autre valeur ou une lecture qui lève éteint. */
export async function zoomGratuitV4Actif(lire: (id: string, defaut: unknown) => Promise<unknown>): Promise<boolean> {
  try {
    return (await lire(PARAM_ZOOM_GRATUIT_FA, false)) === true;
  } catch {
    return false;
  }
}

export const MARGE_PLAQUETTE_ZOOM_V4_SEC = 0.3;

type PlanZoom = { elementsV4?: readonly { debut: number; fin: number }[] };

export function exclusionsV4(plan: PlanZoom): Exclusion[] {
  return (plan.elementsV4 ?? [])
    .map((e): Exclusion => ({
      debutSec: Math.max(0, e.debut - MARGE_PLAQUETTE_ZOOM_V4_SEC),
      finSec: e.fin + MARGE_PLAQUETTE_ZOOM_V4_SEC,
      raison: "plaquette",
    }))
    .sort((a, b) => a.debutSec - b.debutSec || a.finSec - b.finSec);
}

/** Provisoires (planche C8-Z10). */
export const OPTIONS_ZOOM_V4: Readonly<OptionsZoom> = Object.freeze({
  facteurMax: 1.06,
  dureeMinSec: 1.2,
  dureeMaxSec: 4,
  parMinuteMax: 4,
  ecartMinSec: 3,
  centre: Object.freeze({ x: 0.5, y: 0.34 }),
});

export function fenetresZoomV4(e: {
  actif: unknown;
  plan: PlanZoom;
  dureeSec: number;
  demandes: readonly FenetreZoom[];
  centre?: { x: number; y: number };
}): FenetreZoom[] {
  if (e.actif !== true) return [];
  return fenetresPermises([...e.demandes], exclusionsV4(e.plan), e.dureeSec, {
    ...OPTIONS_ZOOM_V4,
    ...(e.centre ? { centre: e.centre } : {}),
  });
}
