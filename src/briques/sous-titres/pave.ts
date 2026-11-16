/**
 * C2-U7a : mot-clé en pavé (plaque derrière un mot de la ligne). PUR, sans React ni Remotion, aucun import `@/` :
 * lu par le rendu. Éteint par défaut : seul un style portant `texteEcran.pave` appelle `motsAPlaque`.
 */
import { estNombre, MOTS_FORTS, normaliser } from "./typographie";

/** Règle de choix des mots (copie de `texte-ecran.ts`, sans import). */
export type ReglePave = "forts" | "chiffres" | "forts-et-chiffres";

/** Plaque : marge de chaque côté du mot et rayon des coins, en em (taille de la lettre). */
export const PAVE = { margeXEm: 0.18, margeYEm: 0.04, rayonEm: 0.16 };

/**
 * Indices des mots à plaque d'un groupe : au plus un (le premier qui convient), jamais le mot `souligne` déjà
 * marqué. Liste vide si aucun mot ne convient.
 */
export function motsAPlaque(segment: { mots: { mot: string }[]; souligne?: number | null }, regle: ReglePave): number[] {
  const fort = regle !== "chiffres";
  const chiffre = regle !== "forts";
  for (let k = 0; k < segment.mots.length; k++) {
    if (k === segment.souligne) continue;
    const mot = segment.mots[k].mot;
    if ((chiffre && estNombre(mot)) || (fort && MOTS_FORTS.has(normaliser(mot)))) return [k];
  }
  return [];
}

/** C2-U7b : animation de la plaque. Éteint ici : rien ne l'allume (le branchement est une fiche suivante). */
export const PAVE_ANIME_ACTIF = false;

/**
 * Valeurs d'animation : inclinaison de -2° (plaque « posée de travers » à la main, jamais plus de 4° pour rester
 * lisible), entrée de 0,18 s (assez brève pour ne pas retarder le mot, assez longue pour être vue à 30 i/s : ~5
 * images), départ à 60 % de la taille.
 */
export const PAVE_ANIM = { inclinaisonDeg: -2, dureeEntreeS: 0.18, echelleDepart: 0.6 };

export type BoitePave = { xPx: number; yPx: number; largeurPx: number; hauteurPx: number };
export type GeometriePave = {
  x: number; y: number; largeur: number; hauteur: number; rayon: number;
  inclinaisonDeg: number; echelle: number; opacite: number;
};

/** Progression douce 0→1 (sortie progressive, cubique) de l'entrée, fonction pure du temps. */
const progression = (t: number): number => {
  const u = Math.min(1, Math.max(0, t / PAVE_ANIM.dureeEntreeS));
  return 1 - (1 - u) ** 3;
};

/**
 * Plaque inclinée d'un mot. `boite` = boîte du mot sans la marge ; `t` = secondes depuis le début du mot dit.
 * `null` avant le mot. Mêmes marges que la plaque CSS de C2-U7a.
 */
export function geometriePave(boite: BoitePave, taillePx: number, t: number): GeometriePave | null {
  if (t < 0) return null;
  const mx = PAVE.margeXEm * taillePx;
  const my = PAVE.margeYEm * taillePx;
  const p = progression(t);
  return {
    x: boite.xPx - mx,
    y: boite.yPx - my,
    largeur: boite.largeurPx + 2 * mx,
    hauteur: boite.hauteurPx + 2 * my,
    rayon: PAVE.rayonEm * taillePx,
    inclinaisonDeg: PAVE_ANIM.inclinaisonDeg,
    echelle: PAVE_ANIM.echelleDepart + (1 - PAVE_ANIM.echelleDepart) * p,
    opacite: p,
  };
}

/**
 * Instants (s, arrondis à l'image) où la plaque change d'aspect : une valeur par image de `debutS` à
 * `debutS + dureeEntreeS`. Triés, sans doublon. Non appelée ici.
 */
export function instantsPaves(paves: { debutS: number }[], fps: number): number[] {
  const images = new Set<number>();
  for (const { debutS } of paves) {
    const premiere = Math.round(debutS * fps);
    const derniere = Math.round((debutS + PAVE_ANIM.dureeEntreeS) * fps);
    for (let i = premiere; i <= derniere; i++) images.add(i);
  }
  return [...images].sort((a, b) => a - b).map((i) => +(i / fps).toFixed(4));
}
