/**
 * X1-10 — PAPIER DÉCOUPÉ ET RUBAN ADHÉSIF. PUR : bord déchiré par `hasard` (courbes.ts), aucune image, aucune texture.
 * Imports relatifs seulement (lu par le rendu). Même entrée = même image. Ajout pur : rien ne l'importe, non inscrit, éteint.
 */
import { CHARTE_AXION, avecOpacite } from "../../jetons-motion";
import { hasard } from "../courbes";
import type { ZoneObjet } from "./contrat";
import { verifierZone } from "./zones";

/** Amplitude maximale du bord déchiré, en % de la largeur du papier (plafond de la fiche : 2 %). */
export const AMPLITUDE_BORD_MAX_POURCENT = 2;
/** Nombre de points d'un bord, borné. */
export const POINTS_BORD_MAX = 200;
/** Ivoire, gris, blanc : seules teintes de papier. */
export const COULEURS_PAPIER = [CHARTE_AXION.ivoire, CHARTE_AXION.gris, "#FFFFFF"] as const;
/** Opacité du ruban adhésif (rectangle translucide ivoire). */
export const OPACITE_RUBAN = 0.7;

export interface PapierDecoupe {
  couleur: string;
  /** Décalages du bord déchiré, en % de la largeur, chacun dans [−2, 2]. */
  bord: number[];
  zone: ZoneObjet;
}

export interface RubanAdhesif {
  /** Rectangle en % du cadre, posé sur le bord haut de la zone. */
  boite: { x: number; y: number; largeur: number; hauteur: number };
  couleur: string;
  opacite: number;
}

const graineEntiere = (g: number): number => (Number.isFinite(g) ? Math.abs(Math.trunc(g)) % 1_000_003 : 0);

/** Décalages du bord déchiré : `n` points, chacun dans [−AMPLITUDE, AMPLITUDE] ; jamais d'exception. */
export function bordDechire(graine: number, n: number): number[] {
  const nb = Number.isFinite(n) ? Math.min(POINTS_BORD_MAX, Math.max(0, Math.floor(n))) : 0;
  const g = graineEntiere(graine);
  return Array.from({ length: nb }, (_, i) => (hasard(g * 31 + i) * 2 - 1) * AMPLITUDE_BORD_MAX_POURCENT);
}

/** Papier : refus (null) si la zone est invalide, touche le visage ou les sous-titres. */
export function papierDecoupe(p: { graine: number; zone: ZoneObjet; visage?: ZoneObjet; points?: number }): PapierDecoupe | null {
  if (verifierZone(p.zone, p.visage ? { visage: p.visage } : undefined) !== "ok") return null;
  const g = graineEntiere(p.graine);
  const couleur = COULEURS_PAPIER[Math.floor(hasard(g * 17 + 3) * COULEURS_PAPIER.length) % COULEURS_PAPIER.length];
  return { couleur, bord: bordDechire(g, p.points ?? 24), zone: { ...p.zone } };
}

/** Ruban : rectangle translucide ivoire, au centre du bord haut, jamais plus large que la zone. */
export function rubanAdhesif(zone: ZoneObjet): RubanAdhesif {
  const largeur = zone.largeur * 0.3;
  const hauteur = Math.min(zone.hauteur * 0.2, 4);
  return {
    boite: { x: zone.x + (zone.largeur - largeur) / 2, y: zone.y - hauteur / 2, largeur, hauteur },
    couleur: avecOpacite(CHARTE_AXION.ivoire, OPACITE_RUBAN),
    opacite: OPACITE_RUBAN,
  };
}

/** Règle « au plus 1 scène sur 3 » : nombre maximal de scènes avec papier découpé. */
export function scenesPapierAutorisees(nbScenes: number): number {
  return Number.isFinite(nbScenes) && nbScenes > 0 ? Math.floor(nbScenes / 3) : 0;
}

export function peutPoserPapier(dejaPosees: number, nbScenes: number): boolean {
  return Number.isFinite(dejaPosees) && dejaPosees >= 0 && dejaPosees < scenesPapierAutorisees(nbScenes);
}
