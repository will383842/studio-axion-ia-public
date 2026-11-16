/**
 * SUIVI D'ÉCRAN → CLICS ET ZOOMS DE LA DÉMO FACECAM — PUR, NON CÂBLÉ.
 *
 * Transforme un `SuiviSourceEcran` (G15-01) en `ClicEcran[]` (pistes.ts) et `ZoomEcran[]` (mise-en-page.ts).
 * Absent (`null`) → listes vides : le comportement d'aujourd'hui. Aucun accès disque, aucun appel, ne lève jamais.
 * Règles : coordonnées en % bornées 0-100 ; au plus un zoom par clic, centré sur le clic, facteur ≤ FACTEUR_ZOOM_MAX ;
 * jamais deux zooms qui se chevauchent (les clics proches fusionnent) ; aucun zoom qui montre une zone marquée privée.
 */
import type { SuiviSourceEcran, ZoneSuivi } from "../../domaine/source-ecran";
import type { ClicEcran } from "./pistes";
import { FACTEUR_ZOOM_MAX, type ZoomEcran } from "./mise-en-page";

export interface OptionsSuiviEcran {
  /** Décalage de synchro ajouté à chaque instant du suivi (ms, peut être négatif). Défaut 0. */
  decalageMs?: number;
  /** Facteur de zoom demandé, plafonné à FACTEUR_ZOOM_MAX. Défaut 1.6. */
  facteur?: number;
  /** Durée du zoom avant le clic (ms). Défaut 600. */
  avantMs?: number;
  /** Durée du zoom après le clic (ms). Défaut 1400. */
  apresMs?: number;
  /** `false` : clics seulement, aucun zoom. Seul `false` éteint les zooms. */
  zoom?: boolean;
}

export interface PistesDepuisSuivi {
  clics: ClicEcran[];
  zooms: ZoomEcran[];
}

const FACTEUR_DEFAUT = 1.6;
const AVANT_DEFAUT_MS = 600;
const APRES_DEFAUT_MS = 1400;

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const borner = (v: number) => Math.min(100, Math.max(0, v));
const arrondi = (v: number) => Math.round(v * 100) / 100;

/** Le zoom (fenêtre de temps + zone visible autour du centre) montre-t-il une zone privée ? */
function montreZonePrivee(zones: readonly ZoneSuivi[], debutMs: number, finMs: number, x: number, y: number, facteur: number): boolean {
  const demi = 50 / facteur;
  const gauche = Math.max(0, x - demi);
  const droite = Math.min(100, x + demi);
  const haut = Math.max(0, y - demi);
  const bas = Math.min(100, y + demi);
  return zones.some(
    (z) =>
      z.debutMs < finMs && z.finMs > debutMs &&
      z.x < droite && z.x + z.largeur > gauche && z.y < bas && z.y + z.hauteur > haut,
  );
}

export function pistesDepuisSuivi(suivi: SuiviSourceEcran | null | undefined, options: OptionsSuiviEcran = {}): PistesDepuisSuivi {
  const vide: PistesDepuisSuivi = { clics: [], zooms: [] };
  try {
    if (!suivi || !Array.isArray(suivi.clics) || suivi.clics.length === 0) return vide;
    const decalage = fini(options.decalageMs) ? options.decalageMs : 0;
    const facteur = Math.min(FACTEUR_ZOOM_MAX, Math.max(1, fini(options.facteur) ? options.facteur : FACTEUR_DEFAUT));
    const avant = fini(options.avantMs) && options.avantMs >= 0 ? options.avantMs : AVANT_DEFAUT_MS;
    const apres = fini(options.apresMs) && options.apresMs > 0 ? options.apresMs : APRES_DEFAUT_MS;
    const zones = Array.isArray(suivi.zones) ? suivi.zones : [];

    const clics: ClicEcran[] = suivi.clics
      .filter((c) => c && fini(c.tMs) && fini(c.x) && fini(c.y))
      .map((c) => ({ ms: Math.max(0, Math.round(c.tMs + decalage)), x: arrondi(borner(c.x)), y: arrondi(borner(c.y)) }))
      .sort((a, b) => a.ms - b.ms);

    if (options.zoom === false) return { clics, zooms: [] };

    // Un zoom par clic, puis fusion des fenêtres qui se touchent (centre = moyenne des clics fusionnés).
    const groupes: { debutMs: number; finMs: number; xs: number[]; ys: number[] }[] = [];
    for (const c of clics) {
      const debutMs = Math.max(0, c.ms - avant);
      const finMs = c.ms + apres;
      const dernier = groupes[groupes.length - 1];
      if (dernier && debutMs < dernier.finMs) {
        dernier.finMs = Math.max(dernier.finMs, finMs);
        dernier.xs.push(c.x);
        dernier.ys.push(c.y);
      } else groupes.push({ debutMs, finMs, xs: [c.x], ys: [c.y] });
    }
    const zooms: ZoomEcran[] = [];
    for (const g of groupes) {
      const x = arrondi(g.xs.reduce((s, v) => s + v, 0) / g.xs.length);
      const y = arrondi(g.ys.reduce((s, v) => s + v, 0) / g.ys.length);
      if (montreZonePrivee(zones, g.debutMs, g.finMs, x, y, facteur)) continue;
      zooms.push({ debutMs: g.debutMs, finMs: g.finMs, x, y, facteur });
    }
    return { clics, zooms };
  } catch {
    return vide;
  }
}
