/**
 * PISTES DU MOTION DESIGN AUTOUR DE L'ÉCRAN (lot J) — PUR.
 *
 * Deux sources, dans cet ordre : les CONSIGNES du plan données par Williams (zoom, clic, légende, surlignage, en % de
 * l'écran et en ms de sa parole), puis le PLAN DE SCÈNES du lot C. Dans le plan, les pièces qui désignent un geste à
 * l'écran (`zoom-camera`, `curseur` avec clic) deviennent un VRAI zoom ou un VRAI surlignage de clic sur l'écran réel ;
 * les autres pièces (niveau 1 et niveau 2) restent du motion posé sur la moitié écran. Le niveau 3 n'arrive jamais ici
 * (le validateur du lot C le replie tant que `CODE_LIBRE_ACTIF` est faux).
 */
import type { PlanValide, SceneValide } from "../../briques/plan-scenes/schema";
import type { ParametresPiece } from "../../briques/plan-scenes/catalogue";
import { FACTEUR_ZOOM_MAX, type ZoomEcran } from "./mise-en-page";

export interface ClicEcran {
  ms: number;
  x: number;
  y: number;
}

export interface SurlignageEcran {
  debutMs: number;
  finMs: number;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface LegendeEcran {
  debutMs: number;
  finMs: number;
  texte: string;
}

export interface PistesEcran {
  zooms: ZoomEcran[];
  clics: ClicEcran[];
  surlignages: SurlignageEcran[];
  legendes: LegendeEcran[];
}

export type ConsigneDemo =
  | { type: "zoom"; debutMs: number; finMs: number; x: number; y: number; facteur?: number }
  | { type: "clic"; ms: number; x: number; y: number }
  | { type: "legende"; debutMs: number; finMs: number; texte: string }
  | { type: "surligne"; debutMs: number; finMs: number; x: number; y: number; largeur: number; hauteur: number };

const pct = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null);
const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

/** Consignes lues une à une : une consigne mal formée est écartée avec une remarque, jamais un refus. */
export function lireConsignes(brut: unknown): { consignes: ConsigneDemo[]; remarques: string[] } {
  const consignes: ConsigneDemo[] = [];
  const remarques: string[] = [];
  for (const [i, c] of (Array.isArray(brut) ? brut : []).entries()) {
    const o = (c ?? {}) as Record<string, unknown>;
    const x = pct(o.x);
    const y = pct(o.y);
    const d = ms(o.debutMs);
    const f = ms(o.finMs);
    if (o.type === "zoom" && x !== null && y !== null && d !== null && f !== null && f > d) consignes.push({ type: "zoom", debutMs: d, finMs: f, x, y, ...(typeof o.facteur === "number" ? { facteur: o.facteur } : {}) });
    else if (o.type === "clic" && x !== null && y !== null && ms(o.ms) !== null) consignes.push({ type: "clic", ms: ms(o.ms)!, x, y });
    else if (o.type === "legende" && typeof o.texte === "string" && o.texte.trim() && d !== null && f !== null && f > d) consignes.push({ type: "legende", debutMs: d, finMs: f, texte: o.texte.trim().slice(0, 80) });
    else if (o.type === "surligne" && x !== null && y !== null && pct(o.largeur) && pct(o.hauteur) && d !== null && f !== null && f > d) consignes.push({ type: "surligne", debutMs: d, finMs: f, x, y, largeur: pct(o.largeur)!, hauteur: pct(o.hauteur)! });
    else remarques.push(`Consigne n° ${i + 1} illisible : ignorée.`);
  }
  return { consignes, remarques };
}

function dureeScene(s: SceneValide): number {
  return Math.max(1, s.finMs - s.debutMs);
}

function zoomDeLaPiece(s: SceneValide, p: ParametresPiece<"zoom-camera">, decalageMs = 0): ZoomEcran {
  const debutMs = Math.round(s.debutMs + decalageMs + p.moment * dureeScene(s));
  return { debutMs, finMs: Math.max(debutMs + 600, s.finMs), x: p.cible.x, y: p.cible.y, facteur: Math.min(FACTEUR_ZOOM_MAX, p.facteur) };
}

/** Pièces du plan qui désignent un geste à l'écran → zooms et clics réels. */
function gestesDuPlan(plan: PlanValide): { zooms: ZoomEcran[]; clics: ClicEcran[] } {
  const zooms: ZoomEcran[] = [];
  const clics: ClicEcran[] = [];
  for (const s of plan.scenes) {
    if (s.piece === "zoom-camera" && !(s.niveau === 2 && s.calques?.length)) zooms.push(zoomDeLaPiece(s, s.parametres));
    if (s.piece === "curseur" && s.parametres.clic && !(s.niveau === 2 && s.calques?.length)) {
      const fin = s.parametres.trajet.at(-1)!;
      clics.push({ ms: Math.round(s.debutMs + s.parametres.partDeplacement * dureeScene(s)), x: fin.x, y: fin.y });
    }
    for (const c of s.niveau === 2 ? (s.calques ?? []) : []) {
      if (c.piece === "zoom-camera") zooms.push(zoomDeLaPiece(s, c.parametres, c.debutMs));
    }
  }
  return { zooms, clics };
}

/** Le plan posé SUR l'écran : sans les pièces devenues zooms ou clics réels (elles dessineraient une fausse fenêtre). */
export function planPourCalque(plan: PlanValide): PlanValide {
  const gestuelle = (s: SceneValide) => !(s.niveau === 2 && s.calques?.length) && (s.piece === "zoom-camera" || s.piece === "curseur");
  return {
    ...plan,
    scenes: plan.scenes.filter((s) => !gestuelle(s)).map((s) => (s.niveau === 2 && s.calques ? { ...s, calques: s.calques.filter((c) => c.piece !== "zoom-camera") } : s)),
  };
}

/** Zooms sans chevauchement : la consigne de Williams passe avant le plan ; un zoom qui en chevauche un autre est écourté ou écarté. */
function sansChevauchement(zooms: ZoomEcran[]): ZoomEcran[] {
  const sortie: ZoomEcran[] = [];
  for (const z of zooms) {
    const debut = Math.max(z.debutMs, ...sortie.filter((a) => a.debutMs <= z.debutMs).map((a) => a.finMs));
    const fin = Math.min(z.finMs, ...sortie.filter((a) => a.debutMs > z.debutMs).map((a) => a.debutMs));
    if (fin - debut >= 600 && !sortie.some((a) => a.debutMs < fin && debut < a.finMs)) sortie.push({ ...z, debutMs: debut, finMs: fin });
  }
  return sortie.sort((a, b) => a.debutMs - b.debutMs);
}

export function pistesEcran(plan: PlanValide | undefined, consignes: readonly ConsigneDemo[]): PistesEcran {
  const gestes = plan ? gestesDuPlan(plan) : { zooms: [], clics: [] };
  const deWilliams = consignes.filter((c): c is Extract<ConsigneDemo, { type: "zoom" }> => c.type === "zoom").map((c) => ({ debutMs: c.debutMs, finMs: c.finMs, x: c.x, y: c.y, facteur: Math.min(FACTEUR_ZOOM_MAX, Math.max(1, c.facteur ?? 1.6)) }));
  return {
    zooms: sansChevauchement([...deWilliams, ...gestes.zooms]),
    clics: [...consignes.filter((c): c is Extract<ConsigneDemo, { type: "clic" }> => c.type === "clic").map(({ ms: m, x, y }) => ({ ms: m, x, y })), ...gestes.clics].sort((a, b) => a.ms - b.ms),
    surlignages: consignes.filter((c): c is Extract<ConsigneDemo, { type: "surligne" }> => c.type === "surligne").map(({ debutMs, finMs, x, y, largeur, hauteur }) => ({ debutMs, finMs, x, y, largeur, hauteur })),
    legendes: consignes.filter((c): c is Extract<ConsigneDemo, { type: "legende" }> => c.type === "legende").map(({ debutMs, finMs, texte }) => ({ debutMs, finMs, texte })),
  };
}
