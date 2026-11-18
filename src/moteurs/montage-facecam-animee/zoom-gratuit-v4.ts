/**
 * C8-Z09a : zoom gratuit de la v4, partie pure. Rien ne l'importe.
 * Le zoom ne touche jamais une plaquette (ni son entrée ni sa sortie).
 * Valeurs PROVISOIRES, réglées sur la planche avant/après C8-Z10 montrée à Williams (W-F : oui sur planche).
 * 0 € : un recadrage FFmpeg, aucun fournisseur.
 * C8-Z09b-a : demandes aux raccords et forme du rendu, purs ; branchement C8-Z09b-b/c.
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

/** Provisoire (planche C8-Z10) : léger rapproché « punch-in » à un raccord de la prise montée sur deux. */
export const RACCORD_ZOOM_V4 = Object.freeze({ dureeSec: 2, facteur: 1.05, unSurDeux: true });

const auMillieme = (n: number): number => Math.round(n * 1000) / 1000;

/** Demandes aux raccords (sauts d'image de la coupe de silence), dans le temps de la prise MONTÉE : t_k = Σ_{i<k} (fin_i − debut_i), k ≥ 1, un sur deux (k impair). */
export function demandesRaccordsV4(gardes: readonly { debutSec: number; finSec: number }[]): FenetreZoom[] {
  const demandes: FenetreZoom[] = [];
  let t = 0;
  for (let k = 1; k < gardes.length; k++) {
    t += gardes[k - 1].finSec - gardes[k - 1].debutSec;
    if (RACCORD_ZOOM_V4.unSurDeux && k % 2 === 0) continue;
    demandes.push({
      debutSec: auMillieme(t),
      finSec: auMillieme(t + RACCORD_ZOOM_V4.dureeSec),
      facteur: RACCORD_ZOOM_V4.facteur,
      type: "punch-in",
    });
  }
  return demandes;
}

const dimensionOk = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n % 2 === 0;

/** Forme envoyée au rendu : { debutSec, finSec, facteur } recopiée (= FenetreZoomRendu, studio-rendu/src/composition/zoom-prise.ts:7), sans rien importer de studio-rendu (D2-15). */
export function zoomsPriseV4(e: {
  actif: unknown;
  plan: PlanZoom;
  gardes: readonly { debutSec: number; finSec: number }[];
  dureeSec: number;
  largeur?: number;
  hauteur?: number;
}): { fenetres: { debutSec: number; finSec: number; facteur: number }[]; largeur: number; hauteur: number } | undefined {
  if (e.actif !== true) return undefined;
  if (!dimensionOk(e.largeur) || !dimensionOk(e.hauteur)) return undefined;
  const fenetres = fenetresZoomV4({
    actif: e.actif,
    plan: e.plan,
    dureeSec: e.dureeSec,
    demandes: demandesRaccordsV4(e.gardes),
  }).map((f) => ({ debutSec: f.debutSec, finSec: f.finSec, facteur: f.facteur }));
  if (fenetres.length === 0) return undefined;
  return { fenetres, largeur: e.largeur, hauteur: e.hauteur };
}
