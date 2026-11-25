/**
 * RENDU PAR PLAGES (T-EXT-52d) — décisions PURES : quelles plages d'images rendre, comment recoller. 0 € : aucun appel,
 * aucun rendu, aucune écriture. Brique commune (DECISION 18/11 point 3) : appelable par tout générateur ; branchée sur le seul
 * tutoriel dans ce chantier. Elle ne lit qu'un `PlanValide` et des nombres.
 */
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { TRANSITION_MAX_MS } from "@/briques/plan-scenes/zones";

export interface PlageImages {
  debut: number;
  fin: number;
}

export interface PlagesARerendre {
  mode: "aucun" | "plages" | "entier";
  plages: PlageImages[];
}

/** Au-delà de cette part du film, mieux vaut tout rendre. */
const PART_MAX_PLAGES = 0.6;

export function plagesARerendre(
  plan: PlanValide,
  scenesTouchees: string[],
  e: { fps: 25; dureeTotaleImages: number; transitionMaxMs: number; imagesCle?: number[] },
): PlagesARerendre {
  const touchees = new Set(scenesTouchees);
  const scenes = plan.scenes.filter((s) => touchees.has(s.id));
  if (scenes.length === 0 || e.dureeTotaleImages <= 0) return { mode: "aucun", plages: [] };

  const dernier = e.dureeTotaleImages - 1;
  const bornes = (n: number) => Math.min(dernier, Math.max(0, n));
  // `transitionMaxMs` vient de TRANSITION_MAX_MS ; on ne dépasse jamais cette valeur.
  const transition = Math.ceil((Math.min(e.transitionMaxMs, TRANSITION_MAX_MS) * e.fps) / 1000);
  const cles = e.imagesCle?.length ? [...e.imagesCle].sort((a, b) => a - b) : undefined;

  const brutes = scenes
    .map((s) => ({
      debut: bornes(Math.floor((s.debutMs * e.fps) / 1000) - transition),
      fin: bornes(Math.ceil((s.finMs * e.fps) / 1000) + transition),
    }))
    .sort((a, b) => a.debut - b.debut);

  const elargies = brutes.map((p) => {
    if (!cles) return p;
    const avant = cles.filter((c) => c <= p.debut).pop() ?? 0;
    const apres = cles.find((c) => c >= p.fin) ?? dernier;
    return { debut: Math.min(avant, p.debut), fin: Math.max(apres, p.fin) };
  });

  const fusion: PlageImages[] = [];
  for (const p of elargies.sort((a, b) => a.debut - b.debut)) {
    const derniere = fusion[fusion.length - 1];
    if (derniere && p.debut <= derniere.fin + 1) derniere.fin = Math.max(derniere.fin, p.fin);
    else fusion.push({ ...p });
  }

  const total = fusion.reduce((n, p) => n + (p.fin - p.debut + 1), 0);
  if (total > PART_MAX_PLAGES * e.dureeTotaleImages) return { mode: "entier", plages: [] };
  return { mode: "plages", plages: fusion };
}

export type SegmentRecollage =
  | { source: "avant"; debut: number; fin: number }
  | { source: "plage"; index: number; debut: number; fin: number };

export interface PlanRecollage {
  segments: SegmentRecollage[];
  voix: "avant" | "aucune";
}

/**
 * Découpe la durée totale en segments ordonnés, sans trou ni recouvrement : les plages (rendus muets) et, entre elles, le
 * fichier d'avant. La voix d'avant, si fournie, est posée sur l'ensemble. Aucune demande de rendu ici (52c).
 */
export function planRecollage(e: {
  plages: PlageImages[];
  dureeTotaleImages: number;
  fichierAvant: string;
  voixAvant?: string;
}): PlanRecollage {
  const voix = e.voixAvant ? "avant" : "aucune";
  if (e.dureeTotaleImages <= 0) return { segments: [], voix };
  const dernier = e.dureeTotaleImages - 1;
  const triees = e.plages
    .map((p, index) => ({ index, debut: Math.max(0, p.debut), fin: Math.min(dernier, p.fin) }))
    .filter((p) => p.fin >= p.debut)
    .sort((a, b) => a.debut - b.debut);
  const segments: SegmentRecollage[] = [];
  let curseur = 0;
  for (const p of triees) {
    const debut = Math.max(p.debut, curseur);
    if (p.fin < debut) continue;
    if (debut > curseur) segments.push({ source: "avant", debut: curseur, fin: debut - 1 });
    segments.push({ source: "plage", index: p.index, debut, fin: p.fin });
    curseur = p.fin + 1;
  }
  if (curseur <= dernier) segments.push({ source: "avant", debut: curseur, fin: dernier });
  return { segments, voix };
}

/** Noms d'entrées de l'opération `recollage-plages` : le fichier d'avant, la voix d'avant, un morceau muet par plage. */
export const ENTREE_AVANT = "avant";
export const ENTREE_VOIX = "voix";
export const entreePlage = (index: number): string => `plage-${index}`;

export type SegmentParametres = { source: "avant"; debutSec: number; finSec: number } | { source: "plage"; entree: string; dureeSec: number };

/** Paramètres de l'opération `recollage-plages` (forme de `studio-rendu/src/operations/recollage-plages.ts`, recopiée : aucun import). */
export interface ParametresRecollage {
  segments: SegmentParametres[];
  avant: string;
  voix?: string;
  dureeSec: number;
}

/**
 * Traduit le plan de recollage (images, bornes comprises) vers les paramètres de l'opération `recollage-plages` (secondes, fin
 * exclue : image `fin` comprise = `(fin + 1) / fps`). `avant` et `voix` sont des NOMS d'entrées ; l'appelant les relie aux adresses.
 * La voix n'est nommée que si le plan la pose (`"avant"`). Aucune demande de rendu ici : l'appelant bâtit la demande.
 */
export function demandesRecollage(plan: PlanRecollage, e: { fps: 25; dureeTotaleImages: number }): ParametresRecollage {
  const sec = (images: number) => images / e.fps;
  const segments: SegmentParametres[] = plan.segments.map((s) =>
    s.source === "avant"
      ? { source: "avant", debutSec: sec(s.debut), finSec: sec(s.fin + 1) }
      : { source: "plage", entree: entreePlage(s.index), dureeSec: sec(s.fin - s.debut + 1) },
  );
  return { segments, avant: ENTREE_AVANT, ...(plan.voix === "avant" ? { voix: ENTREE_VOIX } : {}), dureeSec: sec(e.dureeTotaleImages) };
}
