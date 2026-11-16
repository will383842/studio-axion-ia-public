/**
 * Catalogue commun (C6-H1). Rien ne le lit : H3 le rendra, H2 le choisit. `TRANSITIONS` de `plan-scenes/zones.ts:9`
 * ne doit jamais être allongé (consigne du modèle, `generateur.ts`, schéma zod). Repli AM-05 : si la mesure de C6-H7a
 * dépasse le seuil, `glisse-flou` devient « fondu + scale(1.04) ».
 *
 * PUR : aucun hook, aucun hasard, imports relatifs seulement (dossier lu par le rendu). t ∈ [0, 1] : 0 = invisible ou
 * couvert, 1 = en place. Doux, sans dépassement. Couleurs de la charte seulement ; aucun son.
 */
import type { CSSProperties } from "react";
import { CHARTE_AXION, avecOpacite, entre } from "../../jetons-motion";
import type { NomCourbe } from "../jetons";
import { TRANSITION_MAX_MS, TRANSITION_MIN_MS } from "../../plan-scenes/zones";
import type { Emprise, FamilleSon, SensTransition } from "./types";

export const IDS_TRANSITIONS_COMMUNES = [
  "fondu",
  "glisse-haut",
  "glisse-bas",
  "glisse-gauche",
  "glisse-droite",
  "zoom-doux",
  "glisse-flou",
  "iris",
  "volet-ligne",
  "poussee",
  "reflet-entree",
  "volet-terracotta",
  "flash-ivoire",
  "glisse-flou-axe",
] as const;
export type IdTransitionCommune = (typeof IDS_TRANSITIONS_COMMUNES)[number];

export interface DefinitionTransition {
  id: IdTransitionCommune;
  nom: string;
  famille: "fondu" | "glisse" | "zoom" | "flou" | "decoupe" | "lumiere" | "couleur";
  dureeMs: [number, number];
  courbe: NomCourbe;
  emprise: Emprise;
  sonConseille: FamilleSon | null;
  attendMesure: boolean;
  style(t: number, sens: SensTransition, boite: { largeur: number; hauteur: number }): CSSProperties;
}

const r = (n: number) => Math.round(n * 100) / 100;
const borne = (t: number) => Math.min(1, Math.max(0, t));

/** Fondu + glissement horizontal ou vertical (mêmes valeurs que `effet()` de `rendu.tsx` pour les 4 historiques). */
const glisse = (axe: "X" | "Y", depart: number) => (t: number): CSSProperties => ({
  opacity: r(t),
  transform: `translate${axe}(${r(entre(depart, 0, t))}px)`,
});

const base = {
  sonConseille: null,
  attendMesure: false,
  emprise: "boite" as Emprise,
};

/** Palier de flou le plus proche de 12 × (1 − t) parmi 0, 6 et 12 px. */
function palierFlou(t: number): 0 | 6 | 12 {
  const v = 12 * (1 - borne(t));
  return v < 3 ? 0 : v < 9 ? 6 : 12;
}

export const TRANSITIONS_COMMUNES: Record<IdTransitionCommune, DefinitionTransition> = {
  fondu: {
    ...base, id: "fondu", nom: "Fondu", famille: "fondu", dureeMs: [TRANSITION_MIN_MS, 500], courbe: "douce",
    style: (t) => ({ opacity: r(t) }),
  },
  "glisse-haut": {
    ...base, id: "glisse-haut", nom: "Glissement vers le haut", famille: "glisse", dureeMs: [300, 600], courbe: "signature",
    style: glisse("Y", 40),
  },
  "glisse-bas": {
    ...base, id: "glisse-bas", nom: "Glissement vers le bas", famille: "glisse", dureeMs: [300, 600], courbe: "signature",
    style: glisse("Y", -40),
  },
  "glisse-gauche": {
    ...base, id: "glisse-gauche", nom: "Glissement vers la gauche", famille: "glisse", dureeMs: [300, 600], courbe: "signature",
    style: glisse("X", 60),
  },
  "glisse-droite": {
    ...base, id: "glisse-droite", nom: "Glissement vers la droite", famille: "glisse", dureeMs: [300, 600], courbe: "signature",
    style: glisse("X", -60),
  },
  "zoom-doux": {
    ...base, id: "zoom-doux", nom: "Zoom doux", famille: "zoom", dureeMs: [300, 600], courbe: "signature",
    style: (t) => ({ opacity: r(t), transform: `scale(${r(entre(0.94, 1, t))})` }),
  },
  "glisse-flou": {
    ...base, id: "glisse-flou", nom: "Glissement flou", famille: "flou", dureeMs: [240, 400], courbe: "signature", attendMesure: true,
    style: (t) => {
      const flou = palierFlou(t);
      return {
        opacity: r(t),
        transform: `translateY(${r(entre(24, 0, t))}px)`,
        ...(flou > 0 ? { filter: `blur(${flou}px)` } : {}),
      };
    },
  },
  iris: {
    ...base, id: "iris", nom: "Iris", famille: "decoupe", dureeMs: [400, 700], courbe: "glisse",
    style: (t) => (t >= 1 ? {} : { clipPath: `circle(${r(entre(0, 75, t))}% at 50% 50%)` }),
  },
  "volet-ligne": {
    ...base, id: "volet-ligne", nom: "Volet en ligne", famille: "decoupe", dureeMs: [400, 700], courbe: "glisse",
    style: (t) => (t >= 1 ? {} : { clipPath: `inset(0 ${r(entre(100, 0, t))}% 0 0)` }),
  },
  poussee: {
    ...base, id: "poussee", nom: "Poussée", famille: "glisse", dureeMs: [350, 650], courbe: "glisse",
    style: (t) => ({ opacity: r(t), transform: `translateX(${r(entre(30, 0, t))}px) scale(${r(entre(0.96, 1, t))})` }),
  },
  "reflet-entree": {
    ...base, id: "reflet-entree", nom: "Reflet d'entrée", famille: "lumiere", dureeMs: [400, 700], courbe: "douce",
    style: (t) => {
      if (t >= 1) return { opacity: 1 };
      const p = r(entre(-20, 120, t));
      return {
        opacity: r(t),
        backgroundImage: `linear-gradient(105deg, transparent ${r(p - 20)}%, ${avecOpacite(CHARTE_AXION.ivoire, 0.5)} ${p}%, transparent ${r(p + 20)}%)`,
      };
    },
  },
  "volet-terracotta": {
    ...base, id: "volet-terracotta", nom: "Volet terracotta", famille: "couleur", dureeMs: [400, 700], courbe: "glisse", emprise: "plein-cadre",
    style: (t) => (t >= 1 ? {} : { backgroundColor: CHARTE_AXION.terracotta, clipPath: `inset(0 ${r(entre(100, 0, t))}% 0 0)` }),
  },
  "flash-ivoire": {
    ...base, id: "flash-ivoire", nom: "Flash ivoire", famille: "lumiere", dureeMs: [TRANSITION_MIN_MS, 400], courbe: "douce",
    style: (t) => (t >= 1 ? {} : { boxShadow: `inset 0 0 0 9999px ${avecOpacite(CHARTE_AXION.ivoire, r(1 - t))}` }),
  },
  "glisse-flou-axe": {
    ...base, id: "glisse-flou-axe", nom: "Glissement flou sur un axe", famille: "flou", dureeMs: [240, 400], courbe: "signature", attendMesure: true,
    style: (t) => ({
      opacity: r(t),
      transform: `translateX(${r(entre(40, 0, t))}px) scaleX(${r(entre(1.08, 1, t))})`,
    }),
  },
};
