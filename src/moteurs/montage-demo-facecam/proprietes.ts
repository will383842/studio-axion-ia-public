/**
 * PROPRIÉTÉS DE LA COMPOSITION « DemoFacecam » (lot J) — PUR, imports de TYPES seulement, sans alias « @/ » : lu tel
 * quel par `studio-rendu/compositions/plan-scenes/DemoFacecam.tsx`.
 *
 * Mise en page : moitié / moitié sur fond ivoire. L'ÉCRAN RÉEL de Williams d'un côté (en haut en 4:5, 9:16 et 1:1 ; à
 * gauche en 16:9), sa FACECAM de l'autre. Le motion design (plan de scènes du lot C) est dessiné DANS la moitié de
 * l'écran seulement : il ne peut donc jamais passer devant le visage. Les zooms doux agrandissent l'écran réel, jamais
 * la facecam. Une seule vidéo déjà en écran partagé : elle remplit l'image, le plan évite la zone du visage.
 */
import type { DonneesCalque } from "../../briques/sous-titres/scene";
import type { FormatPlan, HabillagePlan, PlanValide } from "../../briques/plan-scenes/schema";

export const COMPOSITION_DEMO_FACECAM = "DemoFacecam";

/** Format maître (décision du lot J) : 4:5, puis les autres formats demandés. */
export const RATIO_MAITRE_DEMO = "4:5" as const;

export type RatioDemo = "9:16" | "1:1" | "4:5" | "16:9";
export type Disposition = "haut-bas" | "cote-a-cote";
/** `deux` : facecam + enregistrement d'écran ; `unique` : une vidéo déjà en écran partagé. */
export type ModeDemo = "deux" | "unique";

export interface Cadre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

const TAILLES: Record<RatioDemo, { largeur: number; hauteur: number }> = { "9:16": { largeur: 1080, hauteur: 1920 }, "4:5": { largeur: 1080, hauteur: 1350 }, "1:1": { largeur: 1080, hauteur: 1080 }, "16:9": { largeur: 1920, hauteur: 1080 } };

export function formatDemo(ratio: RatioDemo): FormatPlan {
  return { ...TAILLES[ratio], fps: 25 };
}

/** Paysage : côte à côte ; sinon l'écran en haut, la facecam en bas. */
export function dispositionDuRatio(ratio: RatioDemo): Disposition {
  return ratio === "16:9" ? "cote-a-cote" : "haut-bas";
}

/** Les deux moitiés (px entiers et pairs) : l'écran d'abord (haut ou gauche), la facecam ensuite. */
export function moitiesDemo(ratio: RatioDemo): { disposition: Disposition; ecran: Cadre; facecam: Cadre } {
  const { largeur, hauteur } = TAILLES[ratio];
  const disposition = dispositionDuRatio(ratio);
  if (disposition === "cote-a-cote") {
    const l = 2 * Math.floor(largeur / 4);
    return { disposition, ecran: { x: 0, y: 0, largeur: l, hauteur }, facecam: { x: l, y: 0, largeur: largeur - l, hauteur } };
  }
  const h = 2 * Math.floor(hauteur / 4);
  return { disposition, ecran: { x: 0, y: 0, largeur, hauteur: h }, facecam: { x: 0, y: h, largeur, hauteur: hauteur - h } };
}

/** Format du plan de scènes : la moitié de l'écran (deux vidéos) ou l'image entière (vidéo unique). */
export function formatPlanDemo(ratio: RatioDemo, mode: ModeDemo): FormatPlan {
  if (mode === "unique") return formatDemo(ratio);
  const { ecran } = moitiesDemo(ratio);
  return { largeur: ecran.largeur, hauteur: ecran.hauteur, fps: 25 };
}

/** Habillage de la démo : fond ivoire de la charte, accent terracotta (l'orange n'existe que sur noir). */
export const HABILLAGE_DEMO: HabillagePlan = { fond: "ivoire", accent: "terracotta" };
/** Ivoire de la charte (fond des deux moitiés). */
export const IVOIRE_CHARTE = "#F3EDE4";

/* ------------------------------------------------------------------ */
/* Zooms doux sur l'écran réel                                          */
/* ------------------------------------------------------------------ */

/** Zoom doux sur la zone où Williams agit (point en % de l'écran). Jamais sur la facecam. */
export interface ZoomEcran {
  debutMs: number;
  finMs: number;
  x: number;
  y: number;
  facteur: number;
  /** Scène du plan d'où vient le zoom. */
  sceneId: string;
}

/** Facteur maximal d'un zoom « doux ». */
export const FACTEUR_ZOOM_MAX = 1.35;
/** Rampe d'entrée et de sortie d'un zoom (ms). */
export const RAMPE_ZOOM_MS = 450;

const adoucir = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Zoom de l'écran à l'instant `ms` : facteur 1 hors zoom, montée et descente douces. */
export function zoomA(zooms: readonly ZoomEcran[], ms: number): { facteur: number; x: number; y: number } {
  const z = zooms.find((k) => ms >= k.debutMs && ms < k.finMs);
  if (!z) return { facteur: 1, x: 50, y: 50 };
  const rampe = Math.min(RAMPE_ZOOM_MS, (z.finMs - z.debutMs) / 2);
  const t = Math.min(adoucir((ms - z.debutMs) / rampe), adoucir((z.finMs - ms) / rampe));
  return { facteur: Math.round((1 + (z.facteur - 1) * t) * 1000) / 1000, x: z.x, y: z.y };
}

/* ------------------------------------------------------------------ */
/* Propriétés                                                           */
/* ------------------------------------------------------------------ */

export const DUREE_CARTE_FIN_DEMO_MS = 2500;
export const CARTE_FIN_DEMO = { titre: "Axion IA", sousTitre: "axion-ia.com" } as const;

/** Type (et non interface) : Remotion exige des propriétés assignables à `Record<string, unknown>`. */
export type ProprietesDemoFacecam = {
  mode: ModeDemo;
  format: FormatPlan;
  disposition: Disposition;
  /** Moitiés en px (mode `deux`) ; en mode `unique`, la vidéo remplit l'image. */
  ecran: Cadre;
  facecam: Cadre;
  /**
   * Adresses signées : elles arrivent par les ENTRÉES de la demande de rendu (`studio-rendu` les mêle aux propriétés).
   * `videoFacecam` porte le son de Williams ; `videoUnique` en mode unique.
   */
  videoFacecam?: string;
  videoEcran?: string;
  videoUnique?: string;
  /** Décalage de l'enregistrement d'écran sur la facecam (ms, positif : l'écran commence plus tard). */
  decalageEcranMs: number;
  /** Durée de la prise de Williams (ms) : jamais raccourcie. */
  dureeMs: number;
  /** Plan validé, au format du plan (`formatPlanDemo`), fond transparent : la vidéo passe dessous. */
  plan: PlanValide;
  zooms: ZoomEcran[];
  sousTitres?: DonneesCalque;
  fin: { titre: string; sousTitre: string };
  finMs: number;
};

export function imagesDemo(ms: number, fps: number): number {
  return Math.max(1, Math.ceil((ms * fps) / 1000));
}

/** Durée totale en images : la prise de Williams, puis la carte de fin. */
export function dureeImagesDemo(p: Pick<ProprietesDemoFacecam, "dureeMs" | "finMs" | "format">): number {
  return imagesDemo(p.dureeMs, p.format.fps) + imagesDemo(p.finMs, p.format.fps);
}
